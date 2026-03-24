--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: organization_members_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."organization_members_status" AS ENUM (
    'active',
    'inactive',
    'deleted'
);


--
-- Name: organizations_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."organizations_status" AS ENUM (
    'active',
    'inactive',
    'deleted'
);


--
-- Name: payments_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."payments_status" AS ENUM (
    'active',
    'inactive',
    'deleted'
);


--
-- Name: projects_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."projects_status" AS ENUM (
    'active',
    'inactive',
    'deleted'
);


--
-- Name: users_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."users_status" AS ENUM (
    'active',
    'inactive',
    'deleted'
);


--
-- Name: wallet_accounts_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."wallet_accounts_status" AS ENUM (
    'active',
    'inactive',
    'deleted'
);


--
-- Name: wallet_connections_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."wallet_connections_status" AS ENUM (
    'active',
    'inactive',
    'deleted'
);


--
-- Name: create_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (
    user_id,
    created_at,
    updated_at,
    status,
    primary_email_identity
  )
  VALUES (
    NEW.id,
    now() AT TIME ZONE 'utc',
    now() AT TIME ZONE 'utc',
    'active',
    (
      SELECT id
      FROM auth.identities
      WHERE user_id = NEW.id
      ORDER BY (provider = 'email') DESC, created_at ASC
      LIMIT 1
    )
  );

  RETURN NEW;

EXCEPTION WHEN others THEN
  INSERT INTO public.debug_log (message)
  VALUES (
    'create_user_profile failed: user_id=' || NEW.id ||
    ', error=' || SQLERRM
  );

  RETURN NEW;
END;
$$;


--
-- Name: ensure_primary_email_exists(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ensure_primary_email_exists"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If we just removed the primary email or marked it as removed
  IF (OLD.is_primary AND (NEW.is_removed OR TG_OP = 'DELETE')) THEN
    -- Find another email that's not removed and make it primary
    WITH updated_email AS (
      SELECT id
      FROM user_emails
      WHERE user_id = OLD.user_id
        AND is_removed = FALSE
        AND id != OLD.id
      LIMIT 1
    )
    UPDATE user_emails
    SET is_primary = TRUE
    WHERE id IN (SELECT id FROM updated_email);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: ensure_primary_wallet_exists(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ensure_primary_wallet_exists"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If we just removed the primary wallet or marked it as removed
  IF (OLD.is_primary AND (NEW.is_removed OR TG_OP = 'DELETE')) THEN
    -- Find another wallet that's not removed and make it primary
    WITH updated AS (
      SELECT id
      FROM wallet_accounts
      WHERE user_id = OLD.user_id
        AND is_removed = FALSE
        AND id != OLD.id
      LIMIT 1
    )
    UPDATE wallet_accounts
    SET is_primary = TRUE
    WHERE id IN (SELECT id FROM updated);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: ensure_single_primary_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ensure_single_primary_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE user_emails
    SET is_primary = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: ensure_single_primary_wallet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ensure_single_primary_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE wallet_accounts
    SET is_primary = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: get_active_org_members(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_active_org_members"("org_id" integer) RETURNS TABLE("user_id" "uuid", "full_name" "text", "avatar_url" "text", "role_id" integer, "is_public" boolean)
    LANGUAGE "sql"
    AS $$
  select
    u.user_id,
    u.full_name,
    u.avatar_url,
    om.role_id,
    u.is_public
  from organization_members om
  join users u on om.user_id = u.user_id
  where om.organization_id = org_id
    and om.status = 'active'
    and om.deleted_at is null;
$$;


--
-- Name: increment_invite_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."increment_invite_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.invited_by_code is not null then
    update public.invitation_codes
    set usage_count = usage_count + 1
    where code = NEW.invited_by_code;
  end if;
  return NEW;
end;
$$;


--
-- Name: log_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."log_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Ensure the `updated_by` column is populated
  NEW.updated_by = auth.uid(); -- This can be adjusted to pull from `auth.uid()` or any custom field
  
  insert into public.audit_log (
    table_name,
    action,
    record_id,
    user_id,
    old_data,
    new_data
  ) values (
    TG_TABLE_NAME,
    TG_OP,
    (case when TG_OP = 'DELETE' then OLD.id else NEW.id end),
    NEW.updated_by,  -- Log the user who made the change
    to_jsonb(OLD),
    to_jsonb(NEW)
  );

  return NEW;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_by(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_updated_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  NEW.updated_by := auth.uid();
  return NEW;
end;
$$;


--
-- Name: soft_delete_organization_members(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."soft_delete_organization_members"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update organization_members
  set deleted_at = now(),
      status = 'deleted',
      updated_by = auth.uid()
  where id = p_id;
end;
$$;


--
-- Name: soft_delete_organizations(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."soft_delete_organizations"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update organizations
  set deleted_at = now(),
      status = 'deleted',
      updated_by = auth.uid()
  where id = p_id;
end;
$$;


--
-- Name: soft_delete_payments(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."soft_delete_payments"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update payments
  set deleted_at = now(),
      status = 'deleted',
      updated_by = auth.uid()
  where id = p_id;
end;
$$;


--
-- Name: soft_delete_projects(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."soft_delete_projects"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update projects
  set deleted_at = now(),
      status = 'deleted',
      updated_by = auth.uid()
  where id = p_id;
end;
$$;


--
-- Name: soft_delete_users("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."soft_delete_users"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update users
  set deleted_at = now(),
      status = 'deleted',
      updated_by = auth.uid()
  where user_id = p_id;
end;
$$;


--
-- Name: soft_delete_wallet_accounts(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."soft_delete_wallet_accounts"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update wallet_accounts
  set deleted_at = now(),
      status = 'deleted',
      updated_by = auth.uid()
  where id = p_id;
end;
$$;


--
-- Name: soft_delete_wallet_connections(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."soft_delete_wallet_connections"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update wallet_connections
  set deleted_at = now(),
      status = 'deleted',
      updated_by = auth.uid()
  where id = p_id;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."audit_log" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "action" "text" NOT NULL,
    "record_id" bigint,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."audit_log" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."blog_posts" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" integer DEFAULT 1 NOT NULL,
    "published_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_support" boolean DEFAULT false,
    "category" "text",
    "subtitle" "text",
    "picture" "text" DEFAULT 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg'::"text",
    "sort_order_within_category" smallint
);


--
-- Name: blog_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."blog_posts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."blog_posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cron_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."cron_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "status" "text",
    "note" "text"
);


--
-- Name: debug_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."debug_log" (
    "id" bigint NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: debug_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."debug_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: debug_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."debug_log_id_seq" OWNED BY "public"."debug_log"."id";


--
-- Name: invitation_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invitation_codes" (
    "code" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(6), 'hex'::"text") NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "max_uses" integer,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: monthly_network_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."monthly_network_stats" (
    "id" bigint NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "total_funds" numeric NOT NULL,
    "project_count" integer NOT NULL,
    "user_count" integer NOT NULL,
    "avg_salary" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: monthly_network_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."monthly_network_stats" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."monthly_network_stats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."newsletter_subscribers" (
    "id" bigint NOT NULL,
    "email" "text" NOT NULL,
    "subscribed_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text")
);


--
-- Name: newsletter_subscribers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."newsletter_subscribers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: newsletter_subscribers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."newsletter_subscribers_id_seq" OWNED BY "public"."newsletter_subscribers"."id";


--
-- Name: newsletter_subscribers_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."newsletter_subscribers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."newsletter_subscribers_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."organization_invitations" (
    "id" bigint NOT NULL,
    "organization_id" integer,
    "email" "text" NOT NULL,
    "role_id" integer,
    "token" "uuid" DEFAULT "gen_random_uuid"(),
    "status_id" integer,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "expires_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "invited_by" "uuid" DEFAULT "auth"."uid"()
);


--
-- Name: organization_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."organization_invitations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."organization_invitations_id_seq" OWNED BY "public"."organization_invitations"."id";


--
-- Name: organization_invitations_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."organization_invitations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organization_invitations_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."organization_members" (
    "id" bigint NOT NULL,
    "organization_id" integer NOT NULL,
    "role_id" integer DEFAULT 2 NOT NULL,
    "joined_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "role_assigned_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."organization_members_status" DEFAULT 'active'::"public"."organization_members_status"
);


--
-- Name: organization_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."organization_members_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."organization_members_id_seq" OWNED BY "public"."organization_members"."id";


--
-- Name: organization_members_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."organization_members" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organization_members_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."organizations" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "founded" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."organizations_status" DEFAULT 'active'::"public"."organizations_status"
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."organizations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."organizations_id_seq" OWNED BY "public"."organizations"."id";


--
-- Name: organizations_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."organizations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organizations_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: participant_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."participant_roles" (
    "id" bigint NOT NULL,
    "participant_id" bigint NOT NULL,
    "role_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: participant_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."participant_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."participant_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."participants" (
    "id" bigint NOT NULL,
    "project_id" bigint NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "is_admin" boolean,
    "is_favorite" boolean
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payment_methods" (
    "id" bigint NOT NULL,
    "project_id" integer,
    "method_id" integer,
    "is_default" boolean DEFAULT false,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_by" "uuid"
);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."payment_methods_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."payment_methods_id_seq" OWNED BY "public"."payment_methods"."id";


--
-- Name: payment_methods_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."payment_methods" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."payment_methods_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payments" (
    "id" bigint NOT NULL,
    "project_id" integer,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "revenue" numeric(15,2) NOT NULL,
    "payment_amount" numeric(15,2) NOT NULL,
    "payment_percentage" numeric(5,2) NOT NULL,
    "payment_method_id" integer,
    "status_id" integer,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "paid_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "confirmed_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "notes" "text",
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."payments_status" DEFAULT 'active'::"public"."payments_status"
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."payments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."payments_id_seq" OWNED BY "public"."payments"."id";


--
-- Name: payments_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."payments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."payments_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."project_categories" (
    "project_id" integer NOT NULL,
    "category_id" integer NOT NULL
);


--
-- Name: ref_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_categories" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "parent_category" "text",
    "usage_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "updated_by" integer
);


--
-- Name: project_category_count; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."project_category_count" WITH ("security_invoker"='on') AS
 SELECT "pc"."category_id",
    "rc"."name" AS "category_name",
    "count"("pc"."project_id") AS "project_count"
   FROM ("public"."project_categories" "pc"
     JOIN "public"."ref_categories" "rc" ON (("pc"."category_id" = "rc"."id")))
  GROUP BY "pc"."category_id", "rc"."name";


--
-- Name: project_stats_yearly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."project_stats_yearly" (
    "id" bigint NOT NULL,
    "project_id" integer NOT NULL,
    "unique_user_count" integer,
    "yearly_revenue" numeric NOT NULL,
    "contributed_amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "year" smallint,
    "pledged_percentage" numeric,
    "actual_percentage" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("yearly_revenue" = (0)::numeric) THEN (0)::numeric
    ELSE COALESCE(("contributed_amount" / "yearly_revenue"), (999)::numeric)
END) STORED,
    "updated_by" integer
);


--
-- Name: project_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."project_stats_yearly" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."project_stats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_stats_monthly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."project_stats_monthly" (
    "id" bigint NOT NULL,
    "project_id" integer NOT NULL,
    "unique_user_count" integer,
    "monthly_revenue" numeric NOT NULL,
    "contributed_amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pledged_percentage" numeric,
    "year" smallint,
    "month" smallint,
    "actual_percentage" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("monthly_revenue" = (0)::numeric) THEN (0)::numeric
    ELSE COALESCE((("contributed_amount" / "monthly_revenue") * (100)::numeric), (999)::numeric)
END) STORED
);


--
-- Name: project_stats_monthly_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."project_stats_monthly" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."project_stats_monthly_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_stats_rolling12; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."project_stats_rolling12" AS
 WITH "date_range" AS (
         SELECT
                CASE
                    WHEN (EXTRACT(day FROM CURRENT_DATE) <= (10)::numeric) THEN ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) - '1 year'::interval)
                    ELSE (("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval) - '1 year'::interval)
                END AS "start_date",
                CASE
                    WHEN (EXTRACT(day FROM CURRENT_DATE) <= (10)::numeric) THEN ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) - '1 day'::interval)
                    ELSE (("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval) - '1 day'::interval)
                END AS "end_date"
        ), "summary" AS (
         SELECT "project_stats_monthly"."project_id",
            "sum"("project_stats_monthly"."monthly_revenue") AS "total_monthly_revenue",
            "sum"("project_stats_monthly"."contributed_amount") AS "total_contributed_amount",
            "avg"("project_stats_monthly"."pledged_percentage") AS "average_pledged_percentage",
            (("sum"("project_stats_monthly"."contributed_amount") / NULLIF("sum"("project_stats_monthly"."monthly_revenue"), (0)::numeric)) * (100)::numeric) AS "actual_percentage",
            (("to_char"("min"("date_trunc"('month'::"text", ("to_date"(((("project_stats_monthly"."year")::"text" || '-'::"text") || ("project_stats_monthly"."month")::"text"), 'YYYY-MM'::"text"))::timestamp with time zone)), 'Mon YYYY'::"text") || ' - '::"text") || "to_char"("max"("date_trunc"('month'::"text", ("to_date"(((("project_stats_monthly"."year")::"text" || '-'::"text") || ("project_stats_monthly"."month")::"text"), 'YYYY-MM'::"text"))::timestamp with time zone)), 'Mon YYYY'::"text")) AS "period"
           FROM "public"."project_stats_monthly"
          WHERE ((ROW(("project_stats_monthly"."year")::numeric, ("project_stats_monthly"."month")::numeric) >= ROW(EXTRACT(year FROM ( SELECT "date_range"."start_date"
                   FROM "date_range")), EXTRACT(month FROM ( SELECT "date_range"."start_date"
                   FROM "date_range")))) AND (ROW(("project_stats_monthly"."year")::numeric, ("project_stats_monthly"."month")::numeric) <= ROW(EXTRACT(year FROM ( SELECT "date_range"."end_date"
                   FROM "date_range")), EXTRACT(month FROM ( SELECT "date_range"."end_date"
                   FROM "date_range")))))
          GROUP BY "project_stats_monthly"."project_id"
        )
 SELECT "summary"."project_id",
    "summary"."total_monthly_revenue",
    "summary"."total_contributed_amount",
    "summary"."average_pledged_percentage",
    "summary"."actual_percentage",
    "summary"."period"
   FROM "summary";


--
-- Name: project_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."project_users" (
    "id" bigint NOT NULL,
    "is_favourite" boolean,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "project_id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL
);


--
-- Name: project_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."project_users" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."project_users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."projects" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "detailed_description" "text",
    "logo_url" "text",
    "website" "text",
    "organization_id" integer,
    "is_public" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_percentage" numeric(5,2) DEFAULT 1.00,
    "payment_periodicity_id" integer,
    "payment_custom_days" integer,
    "default_payment_method_id" integer,
    "category_id" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."projects_status" DEFAULT 'active'::"public"."projects_status",
    "cumulative_revenue" numeric DEFAULT 0,
    "cumulative_donated" numeric DEFAULT 0,
    "percent_revenue_donated" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("cumulative_revenue" > (0)::numeric) THEN ("cumulative_donated" / "cumulative_revenue")
    ELSE (0)::numeric
END) STORED,
    "email" "text",
    "billing_email" "text",
    "billing_frequency" "text",
    "slug" "text"
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."projects_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."projects_id_seq" OWNED BY "public"."projects"."id";


--
-- Name: projects_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."projects" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."projects_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_categories_id_seq" OWNED BY "public"."ref_categories"."id";


--
-- Name: ref_categories_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_categories" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_categories_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_chains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_chains" (
    "id" bigint NOT NULL,
    "chain_id" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: ref_chains_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_chains" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_chains_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_genders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_genders" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: ref_genders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_genders_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_genders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_genders_id_seq" OWNED BY "public"."ref_genders"."id";


--
-- Name: ref_genders_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_genders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_genders_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_interests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_interests" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "usage_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ref_interests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_interests_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_interests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_interests_id_seq" OWNED BY "public"."ref_interests"."id";


--
-- Name: ref_interests_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_interests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_interests_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_invitation_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_invitation_statuses" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: ref_invitation_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_invitation_statuses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_invitation_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_invitation_statuses_id_seq" OWNED BY "public"."ref_invitation_statuses"."id";


--
-- Name: ref_invitation_statuses_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_invitation_statuses" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_invitation_statuses_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_locations" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "country" "text",
    "region" "text",
    "usage_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text")
);


--
-- Name: ref_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_locations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_locations_id_seq" OWNED BY "public"."ref_locations"."id";


--
-- Name: ref_locations_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_locations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_locations_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_notification_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_notification_types" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: ref_notification_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_notification_types_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_notification_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_notification_types_id_seq" OWNED BY "public"."ref_notification_types"."id";


--
-- Name: ref_notification_types_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_notification_types" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_notification_types_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_occupations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_occupations" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "usage_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ref_occupations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_occupations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_occupations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_occupations_id_seq" OWNED BY "public"."ref_occupations"."id";


--
-- Name: ref_occupations_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_occupations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_occupations_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_payment_methods" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: ref_payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_payment_methods_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_payment_methods_id_seq" OWNED BY "public"."ref_payment_methods"."id";


--
-- Name: ref_payment_methods_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_payment_methods" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_payment_methods_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_payment_periodicities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_payment_periodicities" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: ref_payment_periodicities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_payment_periodicities_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_payment_periodicities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_payment_periodicities_id_seq" OWNED BY "public"."ref_payment_periodicities"."id";


--
-- Name: ref_payment_periodicities_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_payment_periodicities" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_payment_periodicities_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_payment_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_payment_statuses" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: ref_payment_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_payment_statuses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_payment_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_payment_statuses_id_seq" OWNED BY "public"."ref_payment_statuses"."id";


--
-- Name: ref_payment_statuses_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_payment_statuses" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_payment_statuses_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_roles" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "display_order" integer
);


--
-- Name: ref_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."ref_roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."ref_roles_id_seq" OWNED BY "public"."ref_roles"."id";


--
-- Name: ref_roles_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_roles_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_skills" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "usage_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ref_skills_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_skills" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_skills_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_social_platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ref_social_platforms" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "usage_count" integer DEFAULT 0 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_selectable" boolean DEFAULT false NOT NULL
);


--
-- Name: ref_social_platforms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."ref_social_platforms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_social_platforms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: support_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."support_requests" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "category" "text" NOT NULL,
    "message" "text" NOT NULL,
    "ip_address" "text" NOT NULL,
    "user_id" "uuid"
);


--
-- Name: support_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."support_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."support_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: team_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."team_roles" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "required_skills" "text"[],
    "location" "text" DEFAULT 'Remote'::"text",
    "tags" "text"[]
);


--
-- Name: team_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."team_roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: team_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."team_roles_id_seq" OWNED BY "public"."team_roles"."id";


--
-- Name: user_identities; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."user_identities" WITH ("security_invoker"='on') AS
 SELECT "i"."user_id",
    "i"."provider",
    "i"."provider_id",
    "i"."identity_data",
    "i"."created_at",
    ("i"."identity_data" ->> 'email'::"text") AS "email"
   FROM "auth"."identities" "i";


--
-- Name: user_interests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_interests" (
    "interest_id" integer NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text")
);


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_notifications" (
    "id" bigint NOT NULL,
    "type_id" integer,
    "content" "jsonb" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "read_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text")
);


--
-- Name: user_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."user_notifications_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."user_notifications_id_seq" OWNED BY "public"."user_notifications"."id";


--
-- Name: user_notifications_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."user_notifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_notifications_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_project_participation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."participants" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_project_participation_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_skills" (
    "skill_id" integer NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text")
);


--
-- Name: user_social_platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_social_platforms" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "social_platform_id" bigint NOT NULL,
    "handle" "text" NOT NULL,
    "profile_url" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_social_platforms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."user_social_platforms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_social_platforms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."users" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "cubid_id" "uuid",
    "full_name" "text",
    "avatar_url" "text",
    "birth_year" integer,
    "gender_id" integer,
    "location_id" integer,
    "occupation_id" integer,
    "will_contribute" boolean,
    "contribution_details" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "primary_email_identity" "uuid",
    "id" integer NOT NULL,
    "invited_by_code" "text",
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."users_status" DEFAULT 'active'::"public"."users_status",
    "cubid_score" numeric DEFAULT 0,
    "lifetime_sweat_equity" numeric DEFAULT 0,
    "is_public" boolean DEFAULT true,
    "display_name" "text",
    "birthdate" "date",
    "is_pfp_public" boolean DEFAULT true NOT NULL,
    "is_name_public" boolean DEFAULT true NOT NULL,
    "is_birthyear_public" boolean DEFAULT false NOT NULL,
    "is_birthday_public" boolean DEFAULT false NOT NULL,
    "is_gender_public" boolean DEFAULT false NOT NULL,
    "is_occupation_public" boolean DEFAULT false NOT NULL,
    "is_location_public" boolean DEFAULT false NOT NULL,
    "email" "text",
    "age" "text",
    "bio" "text"
);


--
-- Name: users_sequential_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."users" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."users_sequential_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallet_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."wallet_accounts" (
    "id" bigint NOT NULL,
    "wallet_address" "text" NOT NULL,
    "wallet_type" "text" DEFAULT 'ethereum'::"text" NOT NULL,
    "wallet_name" "text",
    "is_primary" boolean DEFAULT false,
    "is_removed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "is_for_project" boolean DEFAULT false,
    "project_id" integer,
    "is_verified" boolean DEFAULT false,
    "chain_id" bigint,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."wallet_accounts_status" DEFAULT 'active'::"public"."wallet_accounts_status"
);


--
-- Name: wallet_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."wallet_accounts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."wallet_accounts_id_seq" OWNED BY "public"."wallet_accounts"."id";


--
-- Name: wallet_accounts_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."wallet_accounts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."wallet_accounts_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallet_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."wallet_connections" (
    "id" bigint NOT NULL,
    "account_id" bigint NOT NULL,
    "connected_at" timestamp with time zone DEFAULT "now"(),
    "gas_balance" bigint,
    "chain_id" bigint,
    "user_id" "uuid",
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "status" "public"."wallet_connections_status" DEFAULT 'active'::"public"."wallet_connections_status"
);


--
-- Name: wallet_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."wallet_connections" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."wallet_connections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: debug_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."debug_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."debug_log_id_seq"'::"regclass");


--
-- Name: team_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."team_roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."team_roles_id_seq"'::"regclass");


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");


--
-- Name: cron_logs cron_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cron_logs"
    ADD CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id");


--
-- Name: debug_log debug_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."debug_log"
    ADD CONSTRAINT "debug_log_pkey" PRIMARY KEY ("id");


--
-- Name: invitation_codes invitation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("code");


--
-- Name: monthly_network_stats monthly_network_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_network_stats"
    ADD CONSTRAINT "monthly_network_stats_pkey" PRIMARY KEY ("id");


--
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");


--
-- Name: organization_invitations organization_invitations_organization_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_email_key" UNIQUE ("organization_id", "email");


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id");


--
-- Name: organization_invitations organization_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_token_key" UNIQUE ("token");


--
-- Name: organization_members organization_members_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_id_key" UNIQUE ("id");


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id", "user_id");


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");


--
-- Name: participant_roles participant_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."participant_roles"
    ADD CONSTRAINT "participant_roles_pkey" PRIMARY KEY ("participant_id", "role_id");


--
-- Name: participants participants_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_id_key" UNIQUE ("id");


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");


--
-- Name: project_categories project_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_categories"
    ADD CONSTRAINT "project_categories_pkey" PRIMARY KEY ("project_id", "category_id");


--
-- Name: project_stats_monthly project_stats_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_stats_monthly"
    ADD CONSTRAINT "project_stats_monthly_pkey" PRIMARY KEY ("id");


--
-- Name: project_stats_yearly project_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_stats_yearly"
    ADD CONSTRAINT "project_stats_pkey" PRIMARY KEY ("id");


--
-- Name: project_users project_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_users"
    ADD CONSTRAINT "project_users_pkey" PRIMARY KEY ("project_id", "user_id");


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");


--
-- Name: projects projects_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_slug_key" UNIQUE ("slug");


--
-- Name: ref_categories ref_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_categories"
    ADD CONSTRAINT "ref_categories_name_key" UNIQUE ("name");


--
-- Name: ref_categories ref_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_categories"
    ADD CONSTRAINT "ref_categories_pkey" PRIMARY KEY ("id");


--
-- Name: ref_chains ref_chains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_chains"
    ADD CONSTRAINT "ref_chains_pkey" PRIMARY KEY ("id");


--
-- Name: ref_genders ref_genders_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_genders"
    ADD CONSTRAINT "ref_genders_name_key" UNIQUE ("name");


--
-- Name: ref_genders ref_genders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_genders"
    ADD CONSTRAINT "ref_genders_pkey" PRIMARY KEY ("id");


--
-- Name: ref_interests ref_interests_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_interests"
    ADD CONSTRAINT "ref_interests_name_key" UNIQUE ("name");


--
-- Name: ref_interests ref_interests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_interests"
    ADD CONSTRAINT "ref_interests_pkey" PRIMARY KEY ("id");


--
-- Name: ref_invitation_statuses ref_invitation_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_invitation_statuses"
    ADD CONSTRAINT "ref_invitation_statuses_code_key" UNIQUE ("code");


--
-- Name: ref_invitation_statuses ref_invitation_statuses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_invitation_statuses"
    ADD CONSTRAINT "ref_invitation_statuses_name_key" UNIQUE ("name");


--
-- Name: ref_invitation_statuses ref_invitation_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_invitation_statuses"
    ADD CONSTRAINT "ref_invitation_statuses_pkey" PRIMARY KEY ("id");


--
-- Name: ref_locations ref_locations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_locations"
    ADD CONSTRAINT "ref_locations_name_key" UNIQUE ("name");


--
-- Name: ref_locations ref_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_locations"
    ADD CONSTRAINT "ref_locations_pkey" PRIMARY KEY ("id");


--
-- Name: ref_notification_types ref_notification_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_notification_types"
    ADD CONSTRAINT "ref_notification_types_code_key" UNIQUE ("code");


--
-- Name: ref_notification_types ref_notification_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_notification_types"
    ADD CONSTRAINT "ref_notification_types_name_key" UNIQUE ("name");


--
-- Name: ref_notification_types ref_notification_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_notification_types"
    ADD CONSTRAINT "ref_notification_types_pkey" PRIMARY KEY ("id");


--
-- Name: ref_occupations ref_occupations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_occupations"
    ADD CONSTRAINT "ref_occupations_name_key" UNIQUE ("name");


--
-- Name: ref_occupations ref_occupations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_occupations"
    ADD CONSTRAINT "ref_occupations_pkey" PRIMARY KEY ("id");


--
-- Name: ref_payment_methods ref_payment_methods_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_methods"
    ADD CONSTRAINT "ref_payment_methods_code_key" UNIQUE ("code");


--
-- Name: ref_payment_methods ref_payment_methods_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_methods"
    ADD CONSTRAINT "ref_payment_methods_name_key" UNIQUE ("name");


--
-- Name: ref_payment_methods ref_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_methods"
    ADD CONSTRAINT "ref_payment_methods_pkey" PRIMARY KEY ("id");


--
-- Name: ref_payment_periodicities ref_payment_periodicities_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_periodicities"
    ADD CONSTRAINT "ref_payment_periodicities_code_key" UNIQUE ("code");


--
-- Name: ref_payment_periodicities ref_payment_periodicities_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_periodicities"
    ADD CONSTRAINT "ref_payment_periodicities_name_key" UNIQUE ("name");


--
-- Name: ref_payment_periodicities ref_payment_periodicities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_periodicities"
    ADD CONSTRAINT "ref_payment_periodicities_pkey" PRIMARY KEY ("id");


--
-- Name: ref_payment_statuses ref_payment_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_statuses"
    ADD CONSTRAINT "ref_payment_statuses_code_key" UNIQUE ("code");


--
-- Name: ref_payment_statuses ref_payment_statuses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_statuses"
    ADD CONSTRAINT "ref_payment_statuses_name_key" UNIQUE ("name");


--
-- Name: ref_payment_statuses ref_payment_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_payment_statuses"
    ADD CONSTRAINT "ref_payment_statuses_pkey" PRIMARY KEY ("id");


--
-- Name: ref_roles ref_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_roles"
    ADD CONSTRAINT "ref_roles_name_key" UNIQUE ("name");


--
-- Name: ref_roles ref_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_roles"
    ADD CONSTRAINT "ref_roles_pkey" PRIMARY KEY ("id");


--
-- Name: ref_skills ref_skills_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_skills"
    ADD CONSTRAINT "ref_skills_id_key" UNIQUE ("id");


--
-- Name: ref_skills ref_skills_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_skills"
    ADD CONSTRAINT "ref_skills_name_key" UNIQUE ("name");


--
-- Name: ref_skills ref_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_skills"
    ADD CONSTRAINT "ref_skills_pkey" PRIMARY KEY ("id");


--
-- Name: ref_social_platforms ref_social_platforms_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_social_platforms"
    ADD CONSTRAINT "ref_social_platforms_code_key" UNIQUE ("code");


--
-- Name: ref_social_platforms ref_social_platforms_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_social_platforms"
    ADD CONSTRAINT "ref_social_platforms_name_key" UNIQUE ("name");


--
-- Name: ref_social_platforms ref_social_platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_social_platforms"
    ADD CONSTRAINT "ref_social_platforms_pkey" PRIMARY KEY ("id");


--
-- Name: support_requests support_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id");


--
-- Name: team_roles team_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."team_roles"
    ADD CONSTRAINT "team_roles_pkey" PRIMARY KEY ("id");


--
-- Name: team_roles team_roles_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."team_roles"
    ADD CONSTRAINT "team_roles_title_key" UNIQUE ("title");


--
-- Name: project_stats_monthly unique_year_month_project_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_stats_monthly"
    ADD CONSTRAINT "unique_year_month_project_id" UNIQUE ("year", "month", "project_id");


--
-- Name: project_stats_yearly unique_yr_mth_project_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_stats_yearly"
    ADD CONSTRAINT "unique_yr_mth_project_id" UNIQUE ("year", "project_id");


--
-- Name: user_interests user_interests_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_unique" UNIQUE ("user_id", "interest_id");


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");


--
-- Name: participants user_project_participation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "user_project_participation_pkey" PRIMARY KEY ("project_id", "user_id");


--
-- Name: user_skills user_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_skills_pkey" PRIMARY KEY ("skill_id", "user_id");


--
-- Name: user_social_platforms user_social_platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_social_platforms"
    ADD CONSTRAINT "user_social_platforms_pkey" PRIMARY KEY ("id");


--
-- Name: users users_cubid_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_cubid_id_key" UNIQUE ("cubid_id");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");


--
-- Name: users users_sequential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_sequential_id_key" UNIQUE ("id");


--
-- Name: users users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_user_id_key" UNIQUE ("user_id");


--
-- Name: wallet_accounts wallet_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: wallet_connections wallet_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_pkey" PRIMARY KEY ("id");


--
-- Name: idx_active_organization_members; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_active_organization_members" ON "public"."organization_members" USING "btree" ("status") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."organization_members_status"));


--
-- Name: idx_active_organizations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_active_organizations" ON "public"."organizations" USING "btree" ("status") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."organizations_status"));


--
-- Name: idx_active_payments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_active_payments" ON "public"."payments" USING "btree" ("status") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."payments_status"));


--
-- Name: idx_active_projects; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_active_projects" ON "public"."projects" USING "btree" ("status") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."projects_status"));


--
-- Name: idx_active_users; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_active_users" ON "public"."users" USING "btree" ("status") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."users_status"));


--
-- Name: idx_active_wallet_accounts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_active_wallet_accounts" ON "public"."wallet_accounts" USING "btree" ("status") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."wallet_accounts_status"));


--
-- Name: idx_active_wallet_connections; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_active_wallet_connections" ON "public"."wallet_connections" USING "btree" ("status") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."wallet_connections_status"));


--
-- Name: idx_one_primary_social_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_one_primary_social_per_user" ON "public"."user_social_platforms" USING "btree" ("user_id") WHERE ("is_primary" = true);


--
-- Name: idx_organization_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_organization_invitations_email" ON "public"."organization_invitations" USING "btree" ("email");


--
-- Name: idx_organization_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_organization_invitations_token" ON "public"."organization_invitations" USING "btree" ("token");


--
-- Name: idx_organization_members_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_organization_members_org_id" ON "public"."organization_members" USING "btree" ("organization_id");


--
-- Name: idx_payment_methods_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_methods_project_id" ON "public"."payment_methods" USING "btree" ("project_id");


--
-- Name: idx_payments_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payments_project_id" ON "public"."payments" USING "btree" ("project_id");


--
-- Name: idx_project_categories_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_project_categories_category_id" ON "public"."project_categories" USING "btree" ("category_id");


--
-- Name: idx_project_categories_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_project_categories_project_id" ON "public"."project_categories" USING "btree" ("project_id");


--
-- Name: idx_projects_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_projects_organization_id" ON "public"."projects" USING "btree" ("organization_id");


--
-- Name: idx_user_contribution_skills_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_contribution_skills_skill_id" ON "public"."user_skills" USING "btree" ("skill_id");


--
-- Name: idx_user_interests_interest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_interests_interest_id" ON "public"."user_interests" USING "btree" ("interest_id");


--
-- Name: idx_wallet_accounts_wallet_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wallet_accounts_wallet_address" ON "public"."wallet_accounts" USING "btree" ("wallet_address");


--
-- Name: organization_members audit_organization_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_organization_members" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: organizations audit_organizations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_organizations" AFTER INSERT OR DELETE OR UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: payment_methods audit_payment_methods; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_payment_methods" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: payments audit_payments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_payments" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: projects audit_projects; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_projects" AFTER INSERT OR DELETE OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: users audit_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_users" AFTER INSERT OR DELETE OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: wallet_accounts audit_wallet_accounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_wallet_accounts" AFTER INSERT OR DELETE OR UPDATE ON "public"."wallet_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: wallet_connections audit_wallet_connections; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_wallet_connections" AFTER INSERT OR DELETE OR UPDATE ON "public"."wallet_connections" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: wallet_accounts audit_wallets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_wallets" AFTER INSERT OR DELETE OR UPDATE ON "public"."wallet_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();


--
-- Name: users increment_invite_code_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "increment_invite_code_usage" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."increment_invite_usage"();


--
-- Name: wallet_accounts maintain_primary_wallet; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "maintain_primary_wallet" AFTER DELETE OR UPDATE ON "public"."wallet_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_primary_wallet_exists"();


--
-- Name: monthly_network_stats set_monthly_network_stats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_monthly_network_stats_updated_at" BEFORE UPDATE ON "public"."monthly_network_stats" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: organization_invitations set_organization_invitations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_organization_invitations_updated_at" BEFORE UPDATE ON "public"."organization_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: organization_members set_organization_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_organization_members_updated_at" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: organization_members set_organization_members_updated_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_organization_members_updated_by" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();


--
-- Name: organizations set_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: organizations set_organizations_updated_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_organizations_updated_by" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();


--
-- Name: payment_methods set_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_payment_methods_updated_at" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: payment_methods set_payment_methods_updated_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_payment_methods_updated_by" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();


--
-- Name: payments set_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: project_stats_yearly set_project_stats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_project_stats_updated_at" BEFORE UPDATE ON "public"."project_stats_yearly" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: projects set_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: ref_categories set_ref_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_ref_categories_updated_at" BEFORE UPDATE ON "public"."ref_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: ref_locations set_ref_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_ref_locations_updated_at" BEFORE UPDATE ON "public"."ref_locations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: ref_skills set_ref_skills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_ref_skills_updated_at" BEFORE UPDATE ON "public"."ref_skills" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: wallet_accounts set_single_primary_wallet; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_single_primary_wallet" BEFORE INSERT OR UPDATE ON "public"."wallet_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_primary_wallet"();


--
-- Name: user_interests set_user_interests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_user_interests_updated_at" BEFORE UPDATE ON "public"."user_interests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: user_notifications set_user_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_user_notifications_updated_at" BEFORE UPDATE ON "public"."user_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: participants set_user_project_participation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_user_project_participation_updated_at" BEFORE UPDATE ON "public"."participants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: user_skills set_user_skills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_user_skills_updated_at" BEFORE UPDATE ON "public"."user_skills" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: user_social_platforms set_user_socials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_user_socials_updated_at" BEFORE UPDATE ON "public"."user_social_platforms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: users set_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: users set_users_updated_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_users_updated_by" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();


--
-- Name: wallet_accounts set_wallet_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_wallet_accounts_updated_at" BEFORE UPDATE ON "public"."wallet_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: wallet_accounts set_wallet_accounts_updated_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_wallet_accounts_updated_by" BEFORE UPDATE ON "public"."wallet_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();


--
-- Name: wallet_connections set_wallet_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_wallet_connections_updated_at" BEFORE UPDATE ON "public"."wallet_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: wallet_connections set_wallet_connections_updated_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_wallet_connections_updated_by" BEFORE UPDATE ON "public"."wallet_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id");


--
-- Name: invitation_codes fk_invitation_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "fk_invitation_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;


--
-- Name: users fk_invited_by_code; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "fk_invited_by_code" FOREIGN KEY ("invited_by_code") REFERENCES "public"."invitation_codes"("code") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_social_platforms fk_user_social_platforms_platform; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_social_platforms"
    ADD CONSTRAINT "fk_user_social_platforms_platform" FOREIGN KEY ("social_platform_id") REFERENCES "public"."ref_social_platforms"("id") ON DELETE CASCADE;


--
-- Name: user_social_platforms fk_user_social_platforms_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_social_platforms"
    ADD CONSTRAINT "fk_user_social_platforms_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;


--
-- Name: organization_invitations organization_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("user_id");


--
-- Name: organization_invitations organization_invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;


--
-- Name: organization_invitations organization_invitations_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ref_roles"("id") ON UPDATE CASCADE;


--
-- Name: organization_invitations organization_invitations_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."ref_invitation_statuses"("id") ON UPDATE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;


--
-- Name: organization_members organization_members_role_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_role_assigned_by_fkey" FOREIGN KEY ("role_assigned_by") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE;


--
-- Name: organization_members organization_members_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ref_roles"("id") ON UPDATE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: participant_roles participant_roles_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."participant_roles"
    ADD CONSTRAINT "participant_roles_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id");


--
-- Name: participant_roles participant_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."participant_roles"
    ADD CONSTRAINT "participant_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ref_roles"("id");


--
-- Name: payment_methods payment_methods_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "public"."ref_payment_methods"("id") ON UPDATE CASCADE;


--
-- Name: payment_methods payment_methods_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;


--
-- Name: payments payments_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."ref_payment_methods"("id") ON UPDATE CASCADE;


--
-- Name: payments payments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;


--
-- Name: payments payments_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."ref_payment_statuses"("id") ON UPDATE CASCADE;


--
-- Name: project_categories project_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_categories"
    ADD CONSTRAINT "project_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."ref_categories"("id") ON UPDATE CASCADE;


--
-- Name: project_categories project_categories_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_categories"
    ADD CONSTRAINT "project_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;


--
-- Name: project_stats_monthly project_stats_monthly_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_stats_monthly"
    ADD CONSTRAINT "project_stats_monthly_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");


--
-- Name: project_stats_yearly project_stats_yearly_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_stats_yearly"
    ADD CONSTRAINT "project_stats_yearly_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");


--
-- Name: project_users project_users_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_users"
    ADD CONSTRAINT "project_users_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");


--
-- Name: project_users project_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."project_users"
    ADD CONSTRAINT "project_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE;


--
-- Name: projects projects_default_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_default_payment_method_id_fkey" FOREIGN KEY ("default_payment_method_id") REFERENCES "public"."ref_payment_methods"("id") ON UPDATE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE;


--
-- Name: projects projects_payment_periodicity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_payment_periodicity_id_fkey" FOREIGN KEY ("payment_periodicity_id") REFERENCES "public"."ref_payment_periodicities"("id") ON UPDATE CASCADE;


--
-- Name: ref_categories ref_categories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ref_categories"
    ADD CONSTRAINT "ref_categories_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");


--
-- Name: support_requests support_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_skills user_contribution_skills_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_contribution_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_interests user_interests_interest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "public"."ref_interests"("id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_interests user_interests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."ref_notification_types"("id") ON UPDATE CASCADE;


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: participants user_project_participation_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "user_project_participation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");


--
-- Name: participants user_project_participation_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "user_project_participation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_skills user_skills_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."ref_skills"("id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_gender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_gender_id_fkey" FOREIGN KEY ("gender_id") REFERENCES "public"."ref_genders"("id") ON UPDATE CASCADE;


--
-- Name: users users_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."ref_locations"("id") ON UPDATE CASCADE;


--
-- Name: users users_occupation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_occupation_id_fkey" FOREIGN KEY ("occupation_id") REFERENCES "public"."ref_occupations"("id") ON UPDATE CASCADE;


--
-- Name: users users_primary_email_identity_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_primary_email_identity_fkey" FOREIGN KEY ("primary_email_identity") REFERENCES "auth"."identities"("id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: wallet_accounts wallet_accounts_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "public"."ref_chains"("id");


--
-- Name: wallet_accounts wallet_accounts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");


--
-- Name: wallet_accounts wallet_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wallet_connections wallet_connections_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "public"."ref_chains"("id");


--
-- Name: wallet_connections wallet_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wallet_connections wallet_connections_wallet_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_wallet_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."wallet_accounts"("id");


--
-- Name: cron_logs Allow inserts from service role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow inserts from service role" ON "public"."cron_logs" FOR INSERT TO "anon" WITH CHECK (true);


--
-- Name: audit_log audit_log_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit_log_read_all" ON "public"."audit_log" FOR SELECT USING (true);


--
-- Name: cron_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."cron_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: invitation_codes invitation_codes_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invitation_codes_read_all" ON "public"."invitation_codes" FOR SELECT USING (true);


--
-- Name: newsletter_subscribers newsletter_subscribers_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "newsletter_subscribers_read_all" ON "public"."newsletter_subscribers" FOR SELECT USING (true);


--
-- Name: organization_invitations organization_invitations_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organization_invitations_org_policy" ON "public"."organization_invitations" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "organization_invitations"."organization_id")))));


--
-- Name: organization_members organization_members_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organization_members_org_policy" ON "public"."organization_members" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "organization_members"."organization_id")))));


--
-- Name: organizations organizations_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organizations_org_policy" ON "public"."organizations" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "organizations"."id")))));


--
-- Name: participant_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."participant_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods payment_methods_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_methods_read_all" ON "public"."payment_methods" FOR SELECT USING (true);


--
-- Name: project_categories project_categories_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "project_categories_read_all" ON "public"."project_categories" FOR SELECT USING (true);


--
-- Name: projects projects_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "projects_org_policy" ON "public"."projects" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "projects"."organization_id")))));


--
-- Name: payments public_payments_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public_payments_read_all" ON "public"."payments" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: ref_categories ref_categories_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_categories_read_all" ON "public"."ref_categories" FOR SELECT USING (true);


--
-- Name: ref_genders ref_genders_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_genders_read_all" ON "public"."ref_genders" FOR SELECT USING (true);


--
-- Name: ref_interests ref_interests_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_interests_read_all" ON "public"."ref_interests" FOR SELECT USING (true);


--
-- Name: ref_invitation_statuses ref_invitation_statuses_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_invitation_statuses_read_all" ON "public"."ref_invitation_statuses" FOR SELECT USING (true);


--
-- Name: ref_locations ref_locations_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_locations_read_all" ON "public"."ref_locations" FOR SELECT USING (true);


--
-- Name: ref_notification_types ref_notification_types_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_notification_types_read_all" ON "public"."ref_notification_types" FOR SELECT USING (true);


--
-- Name: ref_occupations ref_occupations_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_occupations_read_all" ON "public"."ref_occupations" FOR SELECT USING (true);


--
-- Name: ref_payment_methods ref_payment_methods_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_payment_methods_read_all" ON "public"."ref_payment_methods" FOR SELECT USING (true);


--
-- Name: ref_payment_periodicities ref_payment_periodicities_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_payment_periodicities_read_all" ON "public"."ref_payment_periodicities" FOR SELECT USING (true);


--
-- Name: ref_payment_statuses ref_payment_statuses_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_payment_statuses_read_all" ON "public"."ref_payment_statuses" FOR SELECT USING (true);


--
-- Name: ref_roles ref_roles_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_roles_read_all" ON "public"."ref_roles" FOR SELECT USING (true);


--
-- Name: ref_skills ref_skills_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ref_skills_read_all" ON "public"."ref_skills" FOR SELECT USING (true);


--
-- Name: user_interests user_interests_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_interests_user_policy" ON "public"."user_interests" USING (("user_id" = "auth"."uid"()));


--
-- Name: user_notifications user_notifications_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_notifications_user_policy" ON "public"."user_notifications" USING (("user_id" = "auth"."uid"()));


--
-- Name: participants user_project_participation_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_project_participation_user_policy" ON "public"."participants" USING (("user_id" = "auth"."uid"()));


--
-- Name: user_skills user_skills_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_skills_user_policy" ON "public"."user_skills" USING (("user_id" = "auth"."uid"()));


--
-- Name: users users_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users_user_policy" ON "public"."users" USING (("user_id" = "auth"."uid"()));


--
-- Name: wallet_accounts wallet_accounts_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "wallet_accounts_user_policy" ON "public"."wallet_accounts" USING (("user_id" = "auth"."uid"()));


--
-- Name: wallet_connections wallet_connections_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "wallet_connections_user_policy" ON "public"."wallet_connections" USING (("user_id" = "auth"."uid"()));


--
-- PostgreSQL database dump complete
--
