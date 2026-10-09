-- OAuth 2.1 authorization server for delegated access (#266 stage 2).
--
-- Design decisions, recorded here because the schema enforces them:
--   * Scopes are an enum, not free text: the public API's scope vocabulary is a contract, so adding
--     one is a reviewed migration rather than a row anyone can insert.
--   * Clients are curated. There is no dynamic registration (RFC 7591); an operator inserts a row.
--     Redirect URIs live in a child table so every URI is validated on its own row, and they are
--     matched exactly at authorization time, never by prefix or pattern.
--   * Nothing bearer-shaped is stored in the clear. Authorization codes, access tokens, refresh
--     tokens and client secrets are kept as SHA-256 hashes, so a database reader cannot replay them.
--   * PKCE is mandatory and S256 only.
--   * Every table is service-role only: RLS is enabled and no privilege is granted to anon or
--     authenticated, because these rows are the credentials themselves. No audit trigger is
--     attached: these tables must not be copied into audit_log.

create type public.oauth_scope as enum ('profile:read', 'awards:read', 'payout-routes:read');

create table public.oauth_clients (
  id bigint generated always as identity primary key,
  client_id text not null unique check (client_id ~ '^[a-z0-9][a-z0-9_-]{7,63}$'),
  client_secret_sha256 text check (client_secret_sha256 ~ '^[0-9a-f]{64}$'),
  client_type text not null default 'public' check (client_type in ('public', 'confidential')),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (length(description) <= 500),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  client_uri text check (client_uri is null or client_uri ~ '^https://'),
  allowed_scopes public.oauth_scope[] not null check (array_length(allowed_scopes, 1) between 1 and 16),
  is_sandbox boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A confidential client must carry a secret; a public client must not.
  constraint oauth_clients_secret_matches_type check (
    (client_type = 'confidential' and client_secret_sha256 is not null)
    or (client_type = 'public' and client_secret_sha256 is null)
  )
);

-- https only, except an IPv4/IPv6 loopback for a native development client, and never a fragment.
create table public.oauth_client_redirect_uris (
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  redirect_uri text not null check (
    (redirect_uri ~ '^https://[^#]+$' or redirect_uri ~ '^http://(127\.0\.0\.1|\[::1\])(:[0-9]{1,5})?/[^#]*$')
    and length(redirect_uri) <= 2000
  ),
  created_at timestamptz not null default now(),
  primary key (client_id, redirect_uri)
);

-- A person's standing consent for one client. Scopes are what they actually approved, which may be
-- narrower than what the client asked for.
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

-- An authorization request that passed validation and is waiting for the person to decide. The
-- client-controlled values are held here instead of being carried through the consent UI.
create table public.oauth_authorization_requests (
  id bigint generated always as identity primary key,
  request_sha256 text not null unique check (request_sha256 ~ '^[0-9a-f]{64}$'),
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  scopes public.oauth_scope[] not null check (array_length(scopes, 1) between 1 and 16),
  state text check (length(state) <= 512),
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43,128}$'),
  code_challenge_method text not null default 'S256' check (code_challenge_method = 'S256'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.oauth_authorization_codes (
  id bigint generated always as identity primary key,
  code_sha256 text not null unique check (code_sha256 ~ '^[0-9a-f]{64}$'),
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_id bigint not null references public.oauth_grants(id) on delete cascade,
  redirect_uri text not null,
  scopes public.oauth_scope[] not null check (array_length(scopes, 1) between 1 and 16),
  code_challenge text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method = 'S256'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.oauth_tokens (
  id bigint generated always as identity primary key,
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  token_type text not null check (token_type in ('access', 'refresh')),
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_id bigint not null references public.oauth_grants(id) on delete cascade,
  scopes public.oauth_scope[] not null check (array_length(scopes, 1) between 1 and 16),
  -- Refresh tokens rotate single-use: the replaced row records which row replaced it, so presenting
  -- an already rotated refresh token is detectable rather than merely invalid.
  rotated_to_id bigint references public.oauth_tokens(id) on delete set null,
  issued_from_code_id bigint references public.oauth_authorization_codes(id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_grants_user_idx on public.oauth_grants (user_id) where revoked_at is null;
create index oauth_authorization_requests_expiry_idx on public.oauth_authorization_requests (expires_at);
create index oauth_authorization_codes_expiry_idx on public.oauth_authorization_codes (expires_at);
create index oauth_tokens_grant_idx on public.oauth_tokens (grant_id, token_type) where revoked_at is null;
create index oauth_tokens_expiry_idx on public.oauth_tokens (expires_at) where revoked_at is null;

-- Expired single-use rows are dead weight once they can no longer be redeemed. Scheduling this is
-- stage 5 work; the function exists so the schedule is a one-liner and the retention rule has one
-- definition. Revoked and expired tokens are kept for 30 days so a revocation is still explicable.
create or replace function public.oauth_purge_expired()
returns table (requests_deleted bigint, codes_deleted bigint, tokens_deleted bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requests bigint;
  v_codes bigint;
  v_tokens bigint;
begin
  delete from public.oauth_authorization_requests where expires_at < now() - interval '1 day';
  get diagnostics v_requests = row_count;
  delete from public.oauth_authorization_codes where expires_at < now() - interval '1 day';
  get diagnostics v_codes = row_count;
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
  foreach oauth_table in array array['oauth_clients', 'oauth_client_redirect_uris', 'oauth_grants', 'oauth_authorization_requests', 'oauth_authorization_codes', 'oauth_tokens']
  loop
    execute format('alter table public.%I enable row level security', oauth_table);
    execute format('revoke all on table public.%I from anon, authenticated', oauth_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', oauth_table);
  end loop;
end $$;

revoke all on function public.oauth_purge_expired() from public, anon, authenticated;
grant execute on function public.oauth_purge_expired() to service_role;
