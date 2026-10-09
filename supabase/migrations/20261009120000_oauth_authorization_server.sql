-- Delegated access through Cubid cross-app access (#266 stage 2).
--
-- FundLoop is a *resource app*: a requesting client (WondrBot) obtains an identity assertion grant
-- (ID-JAG) from Cubid and redeems it here for a FundLoop access token. Consent is captured at Cubid,
-- in Passport, so FundLoop runs no authorization endpoint and no consent page of its own, and there
-- is no authorization code and no PKCE challenge to store. The contract is
-- ~/src/cubid/cubid-monorepo/docs/engineering/oidc-cross-app-access.md.
--
-- Design decisions, recorded here because the schema enforces them:
--   * Scopes are an enum, not free text: the scope vocabulary is a contract, so adding one is a
--     reviewed migration rather than a row anyone can insert.
--   * Requesting clients are curated. There is no dynamic registration; an operator inserts a row.
--   * Nothing bearer-shaped is stored in the clear. Access tokens, refresh tokens and client
--     secrets are kept as SHA-256 hashes, so a database reader cannot replay them.
--   * An assertion is single use: its jti is recorded, and the unique constraint is what makes a
--     replay fail rather than application code checking first.
--   * A Cubid pairwise subject is the only identifier that arrives in an assertion, so the mapping
--     from subject to FundLoop user is explicit, and an unmapped subject is a denial.
--   * Every table is service-role only: RLS is enabled and no privilege is granted to anon or
--     authenticated, because these rows are the credentials themselves. No audit trigger is
--     attached: these tables must not be copied into audit_log.

create type public.oauth_scope as enum ('profile:read', 'awards:read', 'payout-routes:read');

create table public.oauth_clients (
  id bigint generated always as identity primary key,
  client_id text not null unique check (client_id ~ '^[a-z0-9][a-z0-9_-]{7,63}$'),
  client_secret_sha256 text check (client_secret_sha256 ~ '^[0-9a-f]{64}$'),
  -- Confidential only. Redemption is a server-to-server call authenticated by the client, and the
  -- Cubid contract refuses a public client for the exchange on the same reasoning.
  client_type text not null default 'confidential' check (client_type = 'confidential'),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (length(description) <= 500),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  client_uri text check (client_uri is null or client_uri ~ '^https://'),
  -- The `client_id` claim an assertion carries is the client's id *at Cubid*, which need not equal
  -- its id here, so the accepted value is stored explicitly rather than assumed to match.
  cubid_client_id text not null unique check (length(btrim(cubid_client_id)) between 1 and 255),
  allowed_scopes public.oauth_scope[] not null check (array_length(allowed_scopes, 1) between 1 and 16),
  is_sandbox boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A client that cannot authenticate cannot redeem, so the secret is not optional.
  constraint oauth_clients_secret_present check (client_secret_sha256 is not null)
);

-- The local record of a requesting client's standing access for one person. The consent itself lives
-- at Cubid; this row is created on the first successful redemption and is what a revocation event
-- kills, so FundLoop can stop honouring tokens without waiting to ask Cubid anything.
create table public.oauth_grants (
  id bigint generated always as identity primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scopes public.oauth_scope[] not null check (array_length(scopes, 1) between 1 and 16),
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (client_id, user_id)
);

-- A Cubid pairwise subject for FundLoop, mapped to the FundLoop user it belongs to. Cubid derives
-- this subject per resource app and nothing else in an assertion identifies the person, so without a
-- row here a valid assertion maps to nobody. Rows are written by Sign in with Cubid or by linking an
-- existing account, never inferred from an email address: inferring it would defeat the pairwise
-- scheme's purpose, which is that FundLoop cannot correlate a person across sibling apps.
create table public.cubid_oidc_subjects (
  id bigint generated always as identity primary key,
  issuer text not null check (issuer ~ '^https://'),
  subject text not null check (length(subject) between 1 and 255),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz,
  -- One subject is one person per issuer, and one person holds one subject per issuer.
  unique (issuer, subject),
  unique (issuer, user_id)
);

-- Redeemed assertion identifiers. The insert is the replay check: a second redemption of the same
-- assertion violates the unique constraint instead of racing a read.
create table public.oauth_assertion_jtis (
  jti text not null primary key check (length(jti) between 1 and 255),
  issuer text not null,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  subject text not null,
  redeemed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.oauth_tokens (
  id bigint generated always as identity primary key,
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  -- Access tokens only. A client renews by redeeming a fresh ID-JAG, so consent is re-checked at
  -- Cubid on every renewal instead of being extended here by a refresh token of our own.
  token_type text not null default 'access' check (token_type = 'access'),
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_id bigint not null references public.oauth_grants(id) on delete cascade,
  scopes public.oauth_scope[] not null check (array_length(scopes, 1) between 1 and 16),
  -- The assertion this token was issued against, so a revocation event can be traced to what it
  -- invalidated.
  issued_from_assertion_jti text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_grants_user_idx on public.oauth_grants (user_id) where revoked_at is null;
create index oauth_assertion_jtis_expiry_idx on public.oauth_assertion_jtis (expires_at);
create index cubid_oidc_subjects_user_idx on public.cubid_oidc_subjects (user_id);
create index oauth_tokens_grant_idx on public.oauth_tokens (grant_id, token_type) where revoked_at is null;
create index oauth_tokens_expiry_idx on public.oauth_tokens (expires_at) where revoked_at is null;

-- Expired single-use rows are dead weight once they can no longer be redeemed. Scheduling this is
-- stage 5 work; the function exists so the schedule is a one-liner and the retention rule has one
-- definition. Revoked and expired tokens are kept for 30 days so a revocation is still explicable.
create or replace function public.oauth_purge_expired()
returns table (assertion_jtis_deleted bigint, reserved bigint, tokens_deleted bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requests bigint;
  v_codes bigint;
  v_tokens bigint;
begin
  -- A redeemed jti only has to be remembered until the assertion it names could no longer be
  -- replayed; Cubid gives them a five-minute lifetime.
  delete from public.oauth_assertion_jtis where expires_at < now() - interval '1 day';
  get diagnostics v_requests = row_count;
  v_codes := 0;
  delete from public.oauth_tokens where expires_at < now() - interval '30 days' and coalesce(revoked_at, expires_at) < now() - interval '30 days';
  get diagnostics v_tokens = row_count;
  return query select v_requests, v_codes, v_tokens;
end;
$$;

-- Credentials, not application data: service-role only on every table. RLS is enabled so the hosted
-- ensure_rls behaviour and our own policy suite agree that no client role can reach them.
do $$
declare
  oauth_table text;
begin
  foreach oauth_table in array array['oauth_clients', 'oauth_grants', 'oauth_assertion_jtis', 'cubid_oidc_subjects', 'oauth_tokens']
  loop
    execute format('alter table public.%I enable row level security', oauth_table);
    execute format('revoke all on table public.%I from anon, authenticated', oauth_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', oauth_table);
  end loop;
end $$;

revoke all on function public.oauth_purge_expired() from public, anon, authenticated;
grant execute on function public.oauth_purge_expired() to service_role;
