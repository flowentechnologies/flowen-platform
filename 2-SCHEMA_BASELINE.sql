DO $baseline$
DECLARE actual text;
BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) THEN
 SELECT schema_fingerprint INTO actual FROM (WITH items AS (
SELECT 'relation:'||c.relname AS key, jsonb_build_object('kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity)::text AS value FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
UNION ALL SELECT 'column:'||c.relname||'.'||a.attname,jsonb_build_object('position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m')
UNION ALL SELECT 'constraint:'||c.relname||'.'||x.conname,pg_get_constraintdef(x.oid,true) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
UNION ALL SELECT 'index:'||c.relname,pg_get_indexdef(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'
UNION ALL SELECT 'policy:'||tablename||'.'||policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)::text FROM pg_policies WHERE schemaname='public'
UNION ALL SELECT 'function:'||p.oid::regprocedure::text,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.classid='pg_proc'::regclass AND d.deptype='e')
UNION ALL SELECT 'trigger:'||n.nspname||'.'||c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid,true) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND t.tgname IN ('on_auth_user_created','on_auth_user_email_change')))
UNION ALL SELECT 'enum:'||t.typname||'.'||e.enumsortorder,e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
UNION ALL SELECT 'storage-policy:'||policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)::text FROM pg_policies WHERE schemaname='storage'
) SELECT md5(string_agg(key||'='||value,E'\n' ORDER BY key COLLATE "C")) AS schema_fingerprint FROM items) f;
 IF actual <> '0cb654fe658b9376cddfa9eaae689042' THEN RAISE EXCEPTION 'Existing schema differs from verified baseline: %', actual; END IF;
 RETURN;
 END IF;
 EXECUTE $ddl$
SET check_function_bodies=false;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: admin_action_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admin_action_item_status AS ENUM (
    'open',
    'done'
);


--
-- Name: campaign_contact_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.campaign_contact_type AS ENUM (
    'mp',
    'influencer',
    'journalist',
    'clinician',
    'ngo'
);


--
-- Name: campaign_milestone_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.campaign_milestone_status AS ENUM (
    'upcoming',
    'in_progress',
    'achieved',
    'delayed'
);


--
-- Name: campaign_outreach_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.campaign_outreach_status AS ENUM (
    'identified',
    'contacted',
    'responded',
    'meeting_booked',
    'supporting',
    'declined'
);


--
-- Name: cron_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cron_run_status AS ENUM (
    'running',
    'success',
    'failed',
    'skipped'
);


--
-- Name: disfluency_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.disfluency_type AS ENUM (
    'block',
    'repetition',
    'prolongation',
    'easy_onset'
);


--
-- Name: gdpr_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gdpr_request_status AS ENUM (
    'pending',
    'acknowledged',
    'in_progress',
    'completed',
    'rejected'
);


--
-- Name: gdpr_request_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gdpr_request_type AS ENUM (
    'access',
    'erasure',
    'portability',
    'rectification',
    'restriction'
);


--
-- Name: shift_period; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_period AS ENUM (
    'morning',
    'afternoon',
    'evening',
    'night'
);


--
-- Name: staff_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.staff_role AS ENUM (
    'owner',
    'admin',
    'developer',
    'support',
    'analyst',
    'clinical',
    'marketing'
);


--
-- Name: staff_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.staff_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'trialing',
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'unpaid'
);


--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_tier AS ENUM (
    'founding',
    'standard',
    'public_funds',
    'vocali_freemium'
);


--
-- Name: ticket_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_category AS ENUM (
    'general',
    'billing',
    'technical',
    'clinical',
    'account',
    'bug'
);


--
-- Name: ticket_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'in_progress',
    'waiting',
    'resolved',
    'closed'
);


--
-- Name: workflow_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_run_status AS ENUM (
    'success',
    'failed',
    'skipped',
    'running',
    'pending'
);


--
-- Name: workflow_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_status AS ENUM (
    'active',
    'paused',
    'draft'
);


--
-- Name: apply_gdpr_erasure(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_gdpr_erasure(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Reject if called by an authenticated user trying to erase someone else's data.
    -- Service-role calls have auth.uid() = NULL and are unrestricted.
    IF auth.uid() IS NOT NULL AND auth.uid() != target_user_id THEN
        RAISE EXCEPTION 'Access denied: you may only request erasure of your own data';
    END IF;

    -- Anonymise profile PII
    UPDATE public.profiles SET
        display_name             = NULL,
        email                    = NULL,
        id_verified              = false,
        id_verified_at           = NULL,
        didit_session_id         = NULL,
        gdpr_consent_at          = NULL,
        gdpr_consent_version     = NULL,
        marketing_consent        = false,
        marketing_consent_at     = NULL,
        data_erasure_completed_at = NOW(),
        pacer_default_bpm        = 60.0,
        laryngeal_sensitivity    = 0.50,
        updated_at               = NOW()
    WHERE id = target_user_id;

    -- Remove personally-linked telemetry logs
    DELETE FROM public.telemetry_logs WHERE user_id = target_user_id;

    -- Remove session snapshots (contain real-time voice biomarkers)
    DELETE FROM public.session_snapshots WHERE user_id = target_user_id;

    -- Retain practice_sessions aggregate counts for model integrity but
    -- null out any direct identifiers if they exist.
    UPDATE public.practice_sessions SET
        average_latency_ms = NULL
    WHERE user_id = target_user_id;

    -- Remove direct messages
    DELETE FROM public.slp_messages
    WHERE from_user_id = target_user_id OR to_user_id = target_user_id;

    -- Remove notification history
    DELETE FROM public.notification_log WHERE user_id = target_user_id;
END;
$$;


--
-- Name: create_default_retention_policy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_retention_policy() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
    INSERT INTO public.data_retention_policies (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;


--
-- Name: get_cron_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cron_summary() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select pg_catalog.jsonb_build_object(
    'total',           COUNT(*),
    'successful',      COUNT(*) filter (where status::text = 'success'),
    'failed',          COUNT(*) filter (where status::text != 'success'),
    'avg_duration_ms', ROUND(AVG(duration_ms)::numeric, 0),
    'max_duration_ms', MAX(duration_ms),
    'min_duration_ms', MIN(duration_ms),
    'last_run_at',     MAX(started_at),
    'distinct_jobs',   COUNT(distinct job_id)
  )
  from public.cron_runs;
$$;


--
-- Name: get_db_size(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_db_size() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'db_bytes',   pg_catalog.pg_database_size(pg_catalog.current_database()),
    'db_size',    pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(pg_catalog.current_database()))
  );
$$;


--
-- Name: get_pageview_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pageview_summary() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select pg_catalog.jsonb_build_object(
    'total',           COUNT(*),
    'today',           COUNT(*) filter (where created_at >= (now() at time zone 'utc')::date),
    'week',            COUNT(*) filter (where created_at >= now() - interval '7 days'),
    'month',           COUNT(*) filter (where created_at >= now() - interval '30 days'),
    'unique_sessions', COUNT(distinct session_id) filter (where created_at >= now() - interval '30 days')
  )
  from public.page_views;
$$;


--
-- Name: get_table_sizes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_table_sizes() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'name',   t.tablename,
      'bytes',  pg_catalog.pg_total_relation_size(pg_catalog.quote_ident(t.tablename)),
      'pretty', pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(pg_catalog.quote_ident(t.tablename)))
    )
    order by pg_catalog.pg_total_relation_size(pg_catalog.quote_ident(t.tablename)) desc
  )
  from pg_catalog.pg_tables t
  where t.schemaname = 'public'
  limit 10;
$$;


--
-- Name: get_user_id_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_id_by_email(p_email text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (id, brand, tier)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'brand', 'flowen'),
        COALESCE(
            (NEW.raw_user_meta_data->>'tier')::subscription_tier,
            'standard'
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;


--
-- Name: increment_deck_view_count(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_deck_view_count(p_invite_id uuid, p_last_viewed_at timestamp with time zone) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE deck_invites
  SET
    view_count     = COALESCE(view_count, 0) + 1,
    last_viewed_at = p_last_viewed_at
  WHERE id = p_invite_id;
$$;


--
-- Name: increment_workflow_run_count(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_workflow_run_count(wf_id uuid, ran_at timestamp with time zone) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  UPDATE public.workflow_definitions
  SET
    run_count   = run_count + 1,
    last_run_at = ran_at,
    updated_at  = ran_at
  WHERE id = wf_id;
$$;


--
-- Name: notify_slp_new_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_slp_new_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  recipient_role text;
  sender_name    text;
begin
  select role into recipient_role from profiles where id = new.to_user_id;
  if recipient_role in ('clinician', 'slp') then
    select coalesce(display_name, email) into sender_name from profiles where id = new.from_user_id;
    insert into slp_notifications (slp_user_id, type, title, body, link, priority)
    values (
      new.to_user_id,
      'new_message',
      'New message from ' || coalesce(sender_name, 'a patient'),
      left(new.content, 140),
      '/dashboard/messages',
      'normal'
    );
  end if;
  return new;
end;
$$;


--
-- Name: notify_slp_session_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_slp_session_completed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  patient_name text;
  assignment   record;
begin
  select coalesce(display_name, email) into patient_name from profiles where id = new.user_id;
  for assignment in
    select slp_user_id from slp_assignments where patient_user_id = new.user_id
  loop
    insert into slp_notifications (slp_user_id, type, title, body, link, priority)
    values (
      assignment.slp_user_id,
      'session_completed',
      coalesce(patient_name, 'A patient') || ' completed a practice session',
      'Stage ' || new.stage_id || ' - ' || round((new.duration_seconds / 60.0)::numeric, 1) || ' min - '
        || coalesce(new.total_blocks_detected, 0) || ' blocks detected',
      '/dashboard/clinician',
      'normal'
    );
  end loop;
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: sync_profile_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: trg_marketing_attribution_meta_capi(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_marketing_attribution_meta_capi() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'net'
    AS $$
BEGIN
  IF OLD.user_id IS NULL
     AND NEW.user_id IS NOT NULL
     AND (NEW.meta_event_sent IS NULL OR NEW.meta_event_sent = FALSE)
  THEN
    PERFORM net.http_post(
      url := 'https://www.flowen.digital/api/webhooks/track-meta',
      body := jsonb_build_object(
        'type',       'UPDATE',
        'table',      'marketing_attribution',
        'schema',     'public',
        'record',     row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      ),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer 1d481fa9bd563c6fe694c7e51b677a89a4118e4b37a970e5ba41fc1d4698a527'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: ad_platform_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_platform_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    stat_date date NOT NULL,
    campaign_id text,
    campaign_name text,
    adset_id text,
    adset_name text,
    ad_id text,
    ad_name text,
    creative_id text,
    spend_pence integer DEFAULT 0 NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    reach integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    link_clicks integer DEFAULT 0 NOT NULL,
    ctr numeric(8,4),
    cpc_pence integer,
    cpm_pence integer,
    frequency numeric(6,3),
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    leads integer DEFAULT 0,
    registrations integer DEFAULT 0
);


--
-- Name: admin_action_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_action_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    status public.admin_action_item_status DEFAULT 'open'::public.admin_action_item_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by text
);


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    CONSTRAINT admin_notifications_priority_check CHECK ((priority = ANY (ARRAY['high'::text, 'normal'::text, 'low'::text]))),
    CONSTRAINT admin_notifications_type_check CHECK ((type = ANY (ARRAY['inbox_new'::text, 'draft_pending'::text, 'vendor_invoice'::text, 'crm_new'::text, 'system'::text, 'booking_new'::text])))
);


--
-- Name: affiliate_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    ip_hash text,
    user_agent text,
    landing_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: affiliate_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    conversion_id uuid,
    amount_pence integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    description text,
    payout_id uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT affiliate_commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: affiliate_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    referred_user_id uuid,
    event_type text DEFAULT 'signup'::text NOT NULL,
    subscription_id text,
    amount_pence integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT affiliate_conversions_event_type_check CHECK ((event_type = ANY (ARRAY['signup'::text, 'subscription'::text, 'renewal'::text])))
);


--
-- Name: affiliate_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    amount_pence integer NOT NULL,
    commission_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    payment_ref text,
    notes text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT affiliate_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text])))
);


--
-- Name: affiliates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    tier text DEFAULT 'standard'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    commission_pct numeric(5,2) DEFAULT 20.00 NOT NULL,
    recurring_months integer DEFAULT 3 NOT NULL,
    channel text,
    website text,
    notes text,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT affiliates_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'rejected'::text]))),
    CONSTRAINT affiliates_tier_check CHECK ((tier = ANY (ARRAY['standard'::text, 'premium'::text, 'partner'::text])))
);


--
-- Name: ai_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_type text NOT NULL,
    inbox_item_id uuid,
    crm_contact_id uuid,
    to_address text NOT NULL,
    from_alias text NOT NULL,
    subject text,
    body_text text NOT NULL,
    confidence_pct integer DEFAULT 0 NOT NULL,
    model text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    gmail_message_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_drafts_confidence_pct_check CHECK (((confidence_pct >= 0) AND (confidence_pct <= 100))),
    CONSTRAINT ai_drafts_draft_type_check CHECK ((draft_type = ANY (ARRAY['reply'::text, 'outreach'::text]))),
    CONSTRAINT ai_drafts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'sent'::text, 'edited_sent'::text])))
);


--
-- Name: alert_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    message text NOT NULL,
    sent boolean DEFAULT false NOT NULL,
    error text
);


--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    rule_type text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    threshold_days integer,
    threshold_count integer,
    threshold_pct numeric(5,2),
    recipient_email text NOT NULL,
    last_triggered_at timestamp with time zone,
    last_checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_rules_rule_type_check CHECK ((rule_type = ANY (ARRAY['grant_deadline'::text, 'gdpr_overdue'::text, 'hazard_open_critical'::text, 'user_retention_drop'::text, 'at_risk_users'::text, 'mrr_drop'::text, 'no_new_signups'::text])))
);


--
-- Name: anonymized_telemetry_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anonymized_telemetry_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_hash text NOT NULL,
    disfluency_type text NOT NULL,
    entropy_score double precision NOT NULL,
    mel_spectrogram_latents jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    CONSTRAINT anonymized_telemetry_features_disfluency_type_check CHECK ((disfluency_type = ANY (ARRAY['Block'::text, 'Repetition'::text, 'Prolongation'::text, 'Fluent'::text])))
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    key_prefix text NOT NULL,
    key_hash text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    folder text DEFAULT 'general'::text NOT NULL,
    filename text NOT NULL,
    storage_path text NOT NULL,
    public_url text NOT NULL,
    file_size bigint,
    mime_type text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_email text,
    actor_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    metadata jsonb,
    ip_address text,
    severity text DEFAULT 'info'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    severity text NOT NULL,
    category text NOT NULL,
    actor_id text NOT NULL,
    actor_role text NOT NULL,
    action text NOT NULL,
    resource_id text,
    ip_address text,
    user_agent text,
    metadata jsonb,
    hash text,
    CONSTRAINT audit_logs_severity_check CHECK ((severity = ANY (ARRAY['INFO'::text, 'WARNING'::text, 'CRITICAL'::text, 'SECURITY_ALERT'::text])))
);


--
-- Name: backup_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL,
    tables_backed text[] DEFAULT '{}'::text[] NOT NULL,
    total_rows bigint DEFAULT 0 NOT NULL,
    storage_bytes bigint DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    error text,
    storage_path text,
    CONSTRAINT backup_log_status_check CHECK ((status = ANY (ARRAY['success'::text, 'partial'::text, 'failed'::text])))
);


--
-- Name: bookkeeping_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookkeeping_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    source_ref text,
    title text NOT NULL,
    summary text,
    proposed_payload jsonb NOT NULL,
    confidence_pct integer,
    model text,
    xero_result jsonb,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    applied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    entity text NOT NULL,
    CONSTRAINT bookkeeping_drafts_draft_type_check CHECK ((draft_type = ANY (ARRAY['stripe_sync'::text, 'categorize'::text, 'vat_reconciliation'::text, 'expense_from_email'::text, 'dla_journal'::text, 'share_capital_setoff'::text, 'vendor_dla'::text]))),
    CONSTRAINT bookkeeping_drafts_entity_check CHECK ((entity = ANY (ARRAY['group'::text, 'ip'::text, 'speech-technologies'::text, 'labs'::text]))),
    CONSTRAINT bookkeeping_drafts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'applied'::text])))
);


--
-- Name: TABLE bookkeeping_drafts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bookkeeping_drafts IS 'Proposed bookkeeping actions (Stripe->Xero sync, bank transaction categorisation, VAT/intercompany reconciliation, expense-from-email) awaiting admin approval. Mirrors ai_drafts: status starts pending, and only an explicit PATCH .../approve in /api/admin/bookkeeping/drafts is allowed to write to Xero.';


--
-- Name: cal_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cal_bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    uid text NOT NULL,
    trigger_event text NOT NULL,
    event_type_title text,
    organizer_email text,
    attendee_email text,
    attendee_name text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    status text,
    crm_contact_id uuid,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE cal_bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cal_bookings IS 'Raw log of Cal.com webhook deliveries (currently BOOKING_CREATED only) — one row per booking, uid-deduplicated so a webhook retry never double-processes.';


--
-- Name: campaign_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type public.campaign_contact_type NOT NULL,
    organisation text,
    constituency text,
    platform text,
    followers_count integer,
    email text,
    notes text,
    status public.campaign_outreach_status DEFAULT 'identified'::public.campaign_outreach_status NOT NULL,
    contacted_at timestamp with time zone,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaign_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    target_date date,
    achieved_date date,
    status public.campaign_milestone_status DEFAULT 'upcoming'::public.campaign_milestone_status NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaign_press_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_press_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    publication text NOT NULL,
    url text,
    published_date date,
    sentiment text DEFAULT 'neutral'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaign_press_links_sentiment_check CHECK ((sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text])))
);


--
-- Name: cap_table_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cap_table_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holder_name text NOT NULL,
    holder_type text DEFAULT 'founder'::text NOT NULL,
    instrument text DEFAULT 'ordinary_shares'::text NOT NULL,
    shares bigint,
    share_class text,
    price_per_share_pence integer,
    amount_pence bigint,
    valuation_cap_pence bigint,
    discount_pct numeric(5,2),
    interest_rate_pct numeric(5,2),
    vesting_start date,
    vesting_months integer,
    cliff_months integer,
    seis_eligible boolean DEFAULT false NOT NULL,
    eis_eligible boolean DEFAULT false NOT NULL,
    certificate_ref text,
    issued_at date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cap_table_entries_holder_type_check CHECK ((holder_type = ANY (ARRAY['founder'::text, 'investor'::text, 'employee'::text, 'advisor'::text, 'pool'::text]))),
    CONSTRAINT cap_table_entries_instrument_check CHECK ((instrument = ANY (ARRAY['ordinary_shares'::text, 'preference_shares'::text, 'safe_note'::text, 'convertible_loan'::text, 'emi_option'::text, 'unapproved_option'::text, 'warrant'::text])))
);


--
-- Name: company_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity text NOT NULL,
    record_type text NOT NULL,
    value text NOT NULL,
    issued_by text,
    issued_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_records_entity_check CHECK ((entity = ANY (ARRAY['group'::text, 'ip'::text, 'labs'::text, 'speech-technologies'::text]))),
    CONSTRAINT company_records_record_type_check CHECK ((record_type = ANY (ARRAY['corporation_tax_utr'::text, 'vat_number'::text, 'paye_reference'::text, 'companies_house_auth_code'::text, 'other'::text])))
);


--
-- Name: TABLE company_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.company_records IS 'General company identifiers (UTR, VAT number, PAYE reference, Companies House auth code) per Flowen group entity. Admin-editable at /admin/company-records.';


--
-- Name: compliance_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    framework text NOT NULL,
    item_code text NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    notes text,
    evidence_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_items_framework_check CHECK ((framework = ANY (ARRAY['dcb0129'::text, 'dtac'::text, 'dspt'::text, 'mhra'::text, 'wcag'::text, 'insurance'::text, 'safeguarding'::text]))),
    CONSTRAINT compliance_items_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'complete'::text, 'not_applicable'::text, 'blocked'::text])))
);


--
-- Name: consent_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_type text NOT NULL,
    consent_version text,
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consent_audit_log_event_type_check CHECK ((event_type = ANY (ARRAY['gdpr_consent_granted'::text, 'gdpr_consent_withdrawn'::text, 'marketing_consent_granted'::text, 'marketing_consent_withdrawn'::text, 'telemetry_opt_in'::text, 'telemetry_opt_out'::text, 'erasure_requested'::text, 'erasure_completed'::text, 'kyc_initiated'::text, 'kyc_approved'::text, 'kyc_declined'::text])))
);


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anonymous_id text,
    user_id uuid,
    decision text NOT NULL,
    purposes text[] DEFAULT '{}'::text[] NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consent_records_decision_check CHECK ((decision = ANY (ARRAY['all'::text, 'necessary'::text]))),
    CONSTRAINT consent_records_identity_check CHECK (((anonymous_id IS NOT NULL) OR (user_id IS NOT NULL)))
);


--
-- Name: consistency_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consistency_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    check_type text NOT NULL,
    status text NOT NULL,
    summary text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consistency_checks_check_type_check CHECK ((check_type = ANY (ARRAY['billing'::text, 'marketing'::text, 'venture'::text]))),
    CONSTRAINT consistency_checks_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'discrepancy'::text, 'error'::text])))
);


--
-- Name: conversion_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversion_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    milestone text NOT NULL,
    external_id text DEFAULT ''::text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crm_contact_id uuid NOT NULL,
    type text NOT NULL,
    body text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_activities_type_check CHECK ((type = ANY (ARRAY['email_inbound'::text, 'email_outbound'::text, 'call'::text, 'meeting'::text, 'note'::text, 'stage_change'::text])))
);


--
-- Name: crm_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    email text NOT NULL,
    company text,
    category text DEFAULT 'other'::text NOT NULL,
    stage text DEFAULT 'new'::text NOT NULL,
    source text,
    last_contact_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deal_value_pence bigint,
    deal_currency text DEFAULT 'gbp'::text,
    job_title text,
    company_domain text,
    linkedin_url text,
    country text,
    phone text,
    why_hot text,
    became_hot_at timestamp with time zone,
    explee_person_id text,
    stage_auto_managed boolean DEFAULT true NOT NULL,
    CONSTRAINT crm_contacts_category_check CHECK ((category = ANY (ARRAY['investor'::text, 'grant'::text, 'nhs_partner'::text, 'press'::text, 'affiliate'::text, 'vendor'::text, 'sales_lead'::text, 'clinician_lead'::text, 'other'::text]))),
    CONSTRAINT crm_contacts_stage_check CHECK ((stage = ANY (ARRAY['new'::text, 'contacted'::text, 'in_discussion'::text, 'won'::text, 'lost'::text])))
);


--
-- Name: COLUMN crm_contacts.stage_auto_managed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crm_contacts.stage_auto_managed IS 'true while stage is kept in sync with Explee''s own outreach signals; set to false the moment a human manually changes stage via the CRM UI, and never touched by automation again.';


--
-- Name: cron_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id text NOT NULL,
    status public.cron_run_status DEFAULT 'running'::public.cron_run_status NOT NULL,
    triggered_by text DEFAULT 'schedule'::text NOT NULL,
    duration_ms integer,
    result jsonb,
    error text,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    auth_user_id uuid
);


--
-- Name: data_retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_retention_policies (
    user_id uuid NOT NULL,
    session_retention_days integer DEFAULT 90 NOT NULL,
    telemetry_retention_days integer DEFAULT 90 NOT NULL,
    snapshot_retention_days integer DEFAULT 30 NOT NULL,
    auto_anonymise boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_room_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_room_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    filename text NOT NULL,
    storage_path text NOT NULL,
    file_size bigint,
    mime_type text,
    version text DEFAULT 'v1'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT data_room_documents_category_check CHECK ((category = ANY (ARRAY['financial'::text, 'legal'::text, 'clinical'::text, 'technical'::text, 'corporate'::text, 'regulatory'::text])))
);


--
-- Name: data_room_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_room_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investor_name text NOT NULL,
    investor_email text NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    access_level text DEFAULT 'standard'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_accessed_at timestamp with time zone,
    access_count integer DEFAULT 0 NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT data_room_invites_access_level_check CHECK ((access_level = ANY (ARRAY['standard'::text, 'full'::text])))
);


--
-- Name: deck_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deck_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investor_name text NOT NULL,
    investor_email text,
    firm text,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    last_viewed_at timestamp with time zone,
    variant text DEFAULT 'detailed'::text NOT NULL,
    CONSTRAINT deck_invites_variant_check CHECK ((variant = ANY (ARRAY['detailed'::text, 'simple'::text])))
);


--
-- Name: deck_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deck_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invite_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text
);


--
-- Name: deploy_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deploy_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deployment_id text NOT NULL,
    commit_sha text,
    branch text,
    build_secs integer,
    feat_items integer DEFAULT 0 NOT NULL,
    users_emailed integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changelog_items jsonb
);


--
-- Name: COLUMN deploy_log.changelog_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.deploy_log.changelog_items IS 'The actual parsed feat:/fix:/perf:/security:/policy: items from this deploy''s commit message — [{type, title, description}]. Null for deploys with no user-facing items (chore/docs/refactor/etc). Lets investor-update drafting (and anything else) describe real shipped work instead of just a count.';


--
-- Name: explee_analytics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_analytics_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id integer NOT NULL,
    total_emails_sent integer NOT NULL,
    total_replies integer NOT NULL,
    total_auto_replies integer NOT NULL,
    overall_reply_rate_pct numeric NOT NULL,
    total_hot_leads integer NOT NULL,
    total_spend_usd numeric NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: explee_campaign_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_campaign_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id text NOT NULL,
    campaign_name text NOT NULL,
    prospect_ids uuid[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    campaign_id integer,
    error text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT explee_campaign_imports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE explee_campaign_imports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.explee_campaign_imports IS 'One row per "create an Explee campaign from selected prospects" action — tracks the async import task until Explee reports the new campaign_id.';


--
-- Name: explee_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_campaigns (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    status text,
    status_reason text,
    daily_budget_usd numeric,
    emails_sent integer DEFAULT 0 NOT NULL,
    total_replies integer DEFAULT 0 NOT NULL,
    reply_rate_pct numeric,
    hot_leads integer DEFAULT 0 NOT NULL,
    spend_usd numeric,
    cost_per_lead_usd numeric,
    leads_pool_used integer,
    leads_pool_total integer,
    leads_pool_pending integer,
    collected_leads_total integer,
    cold_lost integer,
    manual_status_counts jsonb,
    synced_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: explee_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id integer NOT NULL,
    person_id text NOT NULL,
    email text,
    name text,
    latest_subject text,
    latest_sent_at timestamp with time zone,
    latest_reply_at timestamp with time zone,
    latest_intent text,
    sent_count integer DEFAULT 0 NOT NULL,
    reply_count integer DEFAULT 0 NOT NULL,
    crm_contact_id uuid,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    can_reply boolean,
    reply_blocked_reason text,
    needs_reply boolean DEFAULT false NOT NULL,
    explee_note text,
    explee_note_updated_at timestamp with time zone,
    explee_note_updated_by text,
    profile_synced_at timestamp with time zone
);


--
-- Name: COLUMN explee_contacts.can_reply; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.explee_contacts.can_reply IS 'Whether POST .../reply is currently allowed for this contact (Explee''s compliance gate) — false once unsubscribed, or if they never replied at all.';


--
-- Name: COLUMN explee_contacts.needs_reply; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.explee_contacts.needs_reply IS 'True when this person is in Explee''s own tab=need_reply set for its campaign — a real reply awaiting a human answer, not a heuristic we derived ourselves. Recomputed every sync run from a dedicated per-campaign fetch.';


--
-- Name: COLUMN explee_contacts.explee_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.explee_contacts.explee_note IS 'The team-shared free-text note Explee''s own AutoGTM inbox shows for this lead (GET/POST .../note) — distinct from crm_contacts.notes, which is Flowen''s own CRM note field.';


--
-- Name: COLUMN explee_contacts.profile_synced_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.explee_contacts.profile_synced_at IS 'When this row last had its LeadProfile (job title/company/LinkedIn/country/phone/note) fetched via the thread endpoint. Null means never — used to prioritise a bounded backfill batch each run rather than a one-off script, since normal syncing only re-fetches a thread when sent/reply activity actually changed.';


--
-- Name: explee_dedup_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_dedup_lists (
    id text NOT NULL,
    kind text NOT NULL,
    source text DEFAULT 'crm_contacts'::text NOT NULL,
    total integer NOT NULL,
    invalid_count integer DEFAULT 0 NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT explee_dedup_lists_kind_check CHECK ((kind = ANY (ARRAY['people'::text, 'companies'::text])))
);


--
-- Name: TABLE explee_dedup_lists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.explee_dedup_lists IS 'Immutable Explee dedup lists this app has created — the most recent kind=''people'' row is automatically passed as exclude_lists on every new prospecting search, so results already in the CRM are excluded and never charged.';


--
-- Name: explee_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id integer NOT NULL,
    person_id text NOT NULL,
    message_id text,
    type text NOT NULL,
    from_email text,
    to_email text,
    subject text,
    body_text text,
    intent text,
    status text,
    in_reply_to text,
    sent_at timestamp with time zone,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT explee_messages_type_check CHECK ((type = ANY (ARRAY['sent'::text, 'reply'::text])))
);


--
-- Name: explee_prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    search_id uuid NOT NULL,
    first_name text,
    last_name text,
    title text,
    linkedin_url text,
    company_name text,
    company_domain text,
    email text,
    email_status text,
    imported_campaign_id integer,
    imported_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE explee_prospects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.explee_prospects IS 'Enriched people found by a search — only rows with a found email are ever stored, matching what find-and-enrich itself returns.';


--
-- Name: explee_searches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explee_searches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    people_filters jsonb,
    company_filters jsonb,
    max_contacts integer NOT NULL,
    preset text DEFAULT 'basic'::text NOT NULL,
    credits_charged numeric,
    error text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    excluded_total integer,
    CONSTRAINT explee_searches_preset_check CHECK ((preset = ANY (ARRAY['basic'::text, 'premium'::text]))),
    CONSTRAINT explee_searches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE explee_searches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.explee_searches IS 'One row per find-and-enrich job run from /admin/prospecting — the filters used, Explee''s task_id, and how many credits it ended up costing.';


--
-- Name: COLUMN explee_searches.excluded_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.explee_searches.excluded_total IS 'How many candidates were skipped because they matched the dedup list passed in exclude_lists — never enriched, never charged. Null when no dedup list was applied to this search.';


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT false NOT NULL,
    rollout_pct integer DEFAULT 100 NOT NULL,
    allowed_tiers text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_flags_rollout_pct_check CHECK (((rollout_pct >= 0) AND (rollout_pct <= 100)))
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text DEFAULT 'general'::text NOT NULL,
    rating smallint,
    comment text,
    page text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: gdpr_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gdpr_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email text NOT NULL,
    user_name text,
    request_type public.gdpr_request_type NOT NULL,
    status public.gdpr_request_status DEFAULT 'pending'::public.gdpr_request_status NOT NULL,
    details text,
    internal_notes text,
    sla_due_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    acknowledged_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: gmail_oauth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_oauth_tokens (
    id text DEFAULT 'admin'::text NOT NULL,
    mailbox text DEFAULT 'admin@flowen.digital'::text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    scope text,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: google_analytics_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_analytics_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id text NOT NULL,
    stat_date date NOT NULL,
    source text,
    medium text,
    campaign text,
    sessions integer DEFAULT 0 NOT NULL,
    users integer DEFAULT 0 NOT NULL,
    new_users integer DEFAULT 0 NOT NULL,
    bounce_rate double precision,
    avg_session_duration double precision,
    conversions integer DEFAULT 0 NOT NULL,
    page_views integer DEFAULT 0 NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    funder text NOT NULL,
    grant_type text DEFAULT 'innovate_uk'::text NOT NULL,
    amount_pence integer,
    awarded_pence integer,
    status text DEFAULT 'researching'::text NOT NULL,
    deadline date,
    submitted_at date,
    decision_date date,
    lead_contact text,
    reference_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grants_grant_type_check CHECK ((grant_type = ANY (ARRAY['innovate_uk'::text, 'sbri'::text, 'nihr'::text, 'wellcome'::text, 'horizon'::text, 'seis_eis'::text, 'private'::text, 'other'::text]))),
    CONSTRAINT grants_status_check CHECK ((status = ANY (ARRAY['researching'::text, 'drafting'::text, 'submitted'::text, 'under_review'::text, 'awarded'::text, 'rejected'::text, 'withdrawn'::text])))
);


--
-- Name: handoff_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handoff_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_email text NOT NULL,
    author_name text,
    shift public.shift_period DEFAULT 'morning'::public.shift_period NOT NULL,
    summary text NOT NULL,
    action_items text,
    flags text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: hazard_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hazard_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hazard_ref text NOT NULL,
    hazard_description text NOT NULL,
    affected_pathway text NOT NULL,
    cause text DEFAULT ''::text NOT NULL,
    effect text DEFAULT ''::text NOT NULL,
    severity integer NOT NULL,
    likelihood integer NOT NULL,
    risk_score integer NOT NULL,
    risk_level text NOT NULL,
    mitigation text DEFAULT ''::text NOT NULL,
    residual_severity integer NOT NULL,
    residual_likelihood integer NOT NULL,
    residual_risk_score integer NOT NULL,
    residual_risk_level text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hazard_log_likelihood_check CHECK (((likelihood >= 1) AND (likelihood <= 5))),
    CONSTRAINT hazard_log_residual_likelihood_check CHECK (((residual_likelihood >= 1) AND (residual_likelihood <= 5))),
    CONSTRAINT hazard_log_residual_risk_level_check CHECK ((residual_risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT hazard_log_residual_severity_check CHECK (((residual_severity >= 1) AND (residual_severity <= 5))),
    CONSTRAINT hazard_log_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT hazard_log_severity_check CHECK (((severity >= 1) AND (severity <= 5))),
    CONSTRAINT hazard_log_status_check CHECK ((status = ANY (ARRAY['open'::text, 'mitigated'::text, 'accepted'::text, 'closed'::text])))
);


--
-- Name: inbox_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbox_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gmail_message_id text NOT NULL,
    gmail_thread_id text NOT NULL,
    alias text NOT NULL,
    from_address text NOT NULL,
    from_name text,
    to_addresses jsonb DEFAULT '[]'::jsonb NOT NULL,
    subject text,
    snippet text,
    body_text text,
    received_at timestamp with time zone NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    is_billing boolean DEFAULT false NOT NULL,
    vendor_name text,
    crm_contact_id uuid,
    status text DEFAULT 'unread'::text NOT NULL,
    labels_applied jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gmail_category text,
    CONSTRAINT inbox_items_category_check CHECK ((category = ANY (ARRAY['general'::text, 'billing'::text, 'crm'::text, 'press'::text, 'security'::text, 'support'::text, 'careers'::text, 'affiliates'::text, 'other'::text]))),
    CONSTRAINT inbox_items_gmail_category_check CHECK ((gmail_category = ANY (ARRAY['primary'::text, 'social'::text, 'promotions'::text, 'updates'::text, 'forums'::text, 'spam'::text]))),
    CONSTRAINT inbox_items_status_check CHECK ((status = ANY (ARRAY['unread'::text, 'read'::text, 'responded'::text, 'archived'::text])))
);


--
-- Name: insurance_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_type text NOT NULL,
    provider text,
    policy_number text,
    entity text,
    coverage_amount_pence bigint,
    start_date date,
    end_date date,
    document_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE insurance_policies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.insurance_policies IS 'Insurance register — deliberately starts empty. No policy has ever existed in this codebase; this gives one a real home instead of the absence being invisible. NHS/institutional procurement will ask for professional indemnity and clinical negligence cover as standard due diligence before contracting.';


--
-- Name: investor_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investor_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient_count integer DEFAULT 0 NOT NULL,
    kpis_snapshot jsonb
);


--
-- Name: investors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    firm text,
    email text,
    stage text DEFAULT 'researched'::text NOT NULL,
    last_contact_at timestamp with time zone,
    next_action text,
    amount_pence integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT investors_stage_check CHECK ((stage = ANY (ARRAY['researched'::text, 'contacted'::text, 'warm'::text, 'in_diligence'::text, 'term_sheet'::text, 'committed'::text, 'passed'::text, 'on_hold'::text])))
);


--
-- Name: ip_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_type text NOT NULL,
    name text NOT NULL,
    description text,
    jurisdiction text,
    status text DEFAULT 'unregistered'::text NOT NULL,
    filing_date date,
    registration_number text,
    renewal_date date,
    estimated_value_pence integer,
    owner text DEFAULT 'Flowen Technologies Ltd'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ip_audit_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_audit_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'not_started'::text NOT NULL,
    risk_level text DEFAULT 'medium'::text NOT NULL,
    priority integer DEFAULT 3 NOT NULL,
    assignee text,
    due_date date,
    evidence_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ip_audit_items_category_check CHECK ((category = ANY (ARRAY['patents'::text, 'trademarks'::text, 'ai_models'::text, 'data_datasets'::text, 'software'::text, 'trade_secrets'::text, 'contracts'::text]))),
    CONSTRAINT ip_audit_items_risk_level_check CHECK ((risk_level = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text, 'none'::text]))),
    CONSTRAINT ip_audit_items_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'complete'::text, 'blocked'::text, 'waived'::text])))
);


--
-- Name: ip_funding_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_funding_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_type text NOT NULL,
    name text NOT NULL,
    provider text NOT NULL,
    description text,
    status text DEFAULT 'researching'::text NOT NULL,
    min_amount_pence integer,
    max_amount_pence integer,
    deadline date,
    url text,
    lead_contact text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ip_funding_items_program_type_check CHECK ((program_type = ANY (ARRAY['grant'::text, 'loan'::text, 'tax_relief'::text, 'licensing'::text, 'partnership'::text, 'legal_aid'::text, 'equity'::text]))),
    CONSTRAINT ip_funding_items_status_check CHECK ((status = ANY (ARRAY['researching'::text, 'eligible'::text, 'applied'::text, 'in_progress'::text, 'awarded'::text, 'rejected'::text, 'not_eligible'::text, 'on_hold'::text])))
);


--
-- Name: ip_model_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_model_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_name text DEFAULT 'Disfluent ASR Engine'::text NOT NULL,
    version text NOT NULL,
    description text,
    training_clips integer,
    accuracy_pct numeric(5,2),
    latency_ms integer,
    deployed boolean DEFAULT false NOT NULL,
    deployed_at timestamp with time zone,
    deprecated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_attribution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_attribution (
    anonymous_id uuid NOT NULL,
    user_id uuid,
    gclid text,
    fbclid text,
    ttclid text,
    msclkid text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    referrer text,
    landing_page text,
    ip_address text,
    user_agent text,
    converted_at timestamp with time zone,
    conversion_type text,
    meta_event_sent boolean DEFAULT false NOT NULL,
    meta_sent_at timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    google_event_sent boolean DEFAULT false NOT NULL,
    google_sent_at timestamp with time zone,
    signup_event_id uuid,
    meta_last_error text,
    google_last_error text
);


--
-- Name: marketing_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section text NOT NULL,
    finding text NOT NULL,
    evidence text NOT NULL,
    recommended_action text NOT NULL,
    confidence text NOT NULL,
    risk text NOT NULL,
    expected_impact text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    data_snapshot jsonb,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by uuid,
    rejected_at timestamp with time zone,
    rejected_by uuid,
    executed_at timestamp with time zone,
    execution_status text,
    dismissed_at timestamp with time zone,
    CONSTRAINT marketing_recommendations_confidence_check CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT marketing_recommendations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'executed'::text, 'dismissed'::text])))
);


--
-- Name: nhs_block_pledges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nhs_block_pledges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    icb_name text NOT NULL,
    contact_name text,
    patients_covered integer,
    contract_value_pence integer,
    status text DEFAULT 'verbal'::text NOT NULL,
    expected_start_date date,
    actual_start_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nhs_block_pledges_status_check CHECK ((status = ANY (ARRAY['verbal'::text, 'written'::text, 'signed'::text, 'live'::text])))
);


--
-- Name: nhs_icb_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nhs_icb_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    icb_name text NOT NULL,
    region text,
    stage text DEFAULT 'prospecting'::text NOT NULL,
    contact_name text,
    contact_email text,
    contact_role text,
    last_contact_at timestamp with time zone,
    next_action text,
    patient_population integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nhs_icb_contacts_stage_check CHECK ((stage = ANY (ARRAY['prospecting'::text, 'engaged'::text, 'proposal'::text, 'pilot'::text, 'contract'::text, 'declined'::text])))
);


--
-- Name: nhs_slp_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nhs_slp_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    organisation text,
    role text,
    region text,
    signup_date timestamp with time zone DEFAULT now() NOT NULL,
    activated boolean DEFAULT false NOT NULL,
    patient_referrals integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb
);


--
-- Name: nps_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nps_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    score smallint,
    comment text,
    source text DEFAULT 'email'::text NOT NULL,
    survey_token text,
    sent_at timestamp with time zone,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nps_responses_score_check CHECK (((score >= 0) AND (score <= 10)))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contract_reference text NOT NULL,
    total_allocated_seats integer DEFAULT 20000 NOT NULL,
    used_seats integer DEFAULT 0 NOT NULL,
    contract_start_date date NOT NULL,
    contract_end_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid NOT NULL,
    path text NOT NULL,
    referrer text,
    country text,
    city text
);


--
-- Name: practice_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practice_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand text NOT NULL,
    duration_seconds integer NOT NULL,
    total_blocks_detected integer DEFAULT 0,
    total_repetitions_detected integer DEFAULT 0,
    total_prolongations_detected integer DEFAULT 0,
    average_latency_ms numeric(6,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    stage_id smallint DEFAULT 1 NOT NULL,
    transcript text,
    audio_storage_path text,
    audio_storage_provider text DEFAULT 'supabase'::text NOT NULL,
    CONSTRAINT practice_sessions_audio_storage_provider_check CHECK ((audio_storage_provider = ANY (ARRAY['supabase'::text, 'r2'::text]))),
    CONSTRAINT practice_sessions_stage_id_check CHECK (((stage_id >= 1) AND (stage_id <= 5)))
);


--
-- Name: COLUMN practice_sessions.transcript; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.practice_sessions.transcript IS 'Full text transcript of the session produced by the Web Speech API (finalTranscript). NULL when captions were not active or not supported by the browser.';


--
-- Name: COLUMN practice_sessions.audio_storage_provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.practice_sessions.audio_storage_provider IS 'Which storage backend audio_storage_path lives in. Existing rows default to supabase (Supabase Storage session-recordings bucket); new uploads write r2 (Cloudflare R2) once STORAGE_R2_* env vars are configured. See src/lib/r2.ts.';


--
-- Name: processed_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_webhook_events (
    event_id text NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    brand text NOT NULL,
    tier public.subscription_tier DEFAULT 'standard'::public.subscription_tier NOT NULL,
    organization_id uuid,
    opt_in_telemetry boolean DEFAULT false NOT NULL,
    daily_practice_limit_mins integer DEFAULT 15,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id_verified boolean DEFAULT true NOT NULL,
    id_verified_at timestamp with time zone,
    didit_session_id text,
    gdpr_consent_at timestamp with time zone,
    gdpr_consent_version text,
    marketing_consent boolean DEFAULT false NOT NULL,
    marketing_consent_at timestamp with time zone,
    data_erasure_requested_at timestamp with time zone,
    data_erasure_completed_at timestamp with time zone,
    data_residency_region text DEFAULT 'UK-GBR'::text NOT NULL,
    data_controller_entity text DEFAULT 'Flowen Ltd'::text NOT NULL,
    pacer_default_bpm numeric(5,2) DEFAULT 60.0,
    laryngeal_sensitivity numeric(3,2) DEFAULT 0.50,
    is_admin boolean DEFAULT false NOT NULL,
    display_name text,
    onboarding_complete boolean DEFAULT false NOT NULL,
    email_reminders boolean DEFAULT true NOT NULL,
    streak_notifications boolean DEFAULT true NOT NULL,
    reminder_hour smallint DEFAULT 9 NOT NULL,
    role text DEFAULT 'patient'::text NOT NULL,
    email text,
    early_access boolean DEFAULT false NOT NULL,
    date_of_birth date,
    country_of_residence text DEFAULT 'GB'::text NOT NULL,
    phone_number text,
    employer_name text,
    hcpc_number text,
    institution_name text,
    address_line1 text,
    address_line2 text,
    address_city text,
    address_postcode text,
    address_region text,
    address_verified_at timestamp with time zone,
    voice_clone_id text,
    voice_clone_name text,
    voice_cloned_at timestamp with time zone,
    consent_data_collection boolean DEFAULT false NOT NULL,
    consent_data_collection_at timestamp with time zone,
    consent_data_collection_version text,
    social_follow_verified_at timestamp with time zone,
    CONSTRAINT profiles_laryngeal_sensitivity_check CHECK (((laryngeal_sensitivity >= 0.0) AND (laryngeal_sensitivity <= 1.0))),
    CONSTRAINT profiles_reminder_hour_check CHECK (((reminder_hour >= 0) AND (reminder_hour <= 23)))
);


--
-- Name: COLUMN profiles.date_of_birth; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.date_of_birth IS 'User date of birth — used for age verification (18+ consent) and clinical calibration';


--
-- Name: COLUMN profiles.country_of_residence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.country_of_residence IS 'ISO 3166-1 alpha-2 country code — affects funding eligibility (AtW, DSA, NHS) and data residency';


--
-- Name: COLUMN profiles.phone_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.phone_number IS 'Optional contact number — used for Access to Work coordination and clinical support';


--
-- Name: COLUMN profiles.employer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.employer_name IS 'Employer name for users on the Access to Work funded pathway';


--
-- Name: COLUMN profiles.hcpc_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.hcpc_number IS 'HCPC registration number for clinician-role users';


--
-- Name: COLUMN profiles.institution_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.institution_name IS 'University or NHS Trust name for DSA/NHS-funded pathway users';


--
-- Name: COLUMN profiles.address_line1; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.address_line1 IS 'First line of home address — collected during KYC onboarding';


--
-- Name: COLUMN profiles.address_line2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.address_line2 IS 'Second line of home address (optional)';


--
-- Name: COLUMN profiles.address_city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.address_city IS 'Town or city of home address';


--
-- Name: COLUMN profiles.address_postcode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.address_postcode IS 'UK postcode — validated against Postcodes.io during onboarding';


--
-- Name: COLUMN profiles.address_region; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.address_region IS 'Region / county returned by Postcodes.io at validation time';


--
-- Name: COLUMN profiles.address_verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.address_verified_at IS 'Timestamp when postcode was confirmed valid by Postcodes.io lookup';


--
-- Name: COLUMN profiles.voice_clone_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.voice_clone_id IS 'ElevenLabs voice_id for the user''s cloned voice. NULL = no clone yet.';


--
-- Name: recommendation_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recommendation_id uuid NOT NULL,
    action text NOT NULL,
    previous_value jsonb,
    new_value jsonb,
    evidence text,
    approved_by uuid,
    approved_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_status text DEFAULT 'pending'::text NOT NULL,
    executed_at timestamp with time zone,
    error_detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_actions_execution_status_check CHECK ((execution_status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: roadmap_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roadmap_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phase text NOT NULL,
    category text DEFAULT 'product'::text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'planned'::text NOT NULL,
    target_date date,
    completed_at date,
    owner text,
    priority text DEFAULT 'medium'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roadmap_milestones_category_check CHECK ((category = ANY (ARRAY['product'::text, 'compliance'::text, 'commercial'::text, 'fundraising'::text, 'team'::text]))),
    CONSTRAINT roadmap_milestones_phase_check CHECK ((phase = ANY (ARRAY['launch'::text, 'nhs_pilot'::text, 'scale'::text]))),
    CONSTRAINT roadmap_milestones_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT roadmap_milestones_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'complete'::text, 'blocked'::text, 'deferred'::text])))
);


--
-- Name: safeguarding_concerns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.safeguarding_concerns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    raised_by text,
    patient_user_id uuid,
    category text DEFAULT 'other'::text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    escalated_to text,
    resolution_notes text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE safeguarding_concerns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.safeguarding_concerns IS 'Safeguarding concern log — the record a real safeguarding policy needs to point to. Distinct from hazard_log (DCB0129 clinical-software safety hazards) and gdpr_requests (data-subject rights): this is about a person''s welfare, not a system defect or a data request.';


--
-- Name: seis_eis_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seis_eis_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    advance_assurance_status text DEFAULT 'drafted'::text NOT NULL,
    advance_assurance_submitted_at date,
    advance_assurance_reference text,
    consolidated_gross_assets_pence bigint,
    total_fte numeric,
    first_trading_date date,
    prior_eis_vct_investment boolean,
    prior_eis_vct_notes text,
    seis1_filed boolean DEFAULT false NOT NULL,
    seis1_filed_at date,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seis_eis_status_advance_assurance_status_check CHECK ((advance_assurance_status = ANY (ARRAY['drafted'::text, 'submitted'::text, 'granted'::text, 'declined'::text])))
);


--
-- Name: TABLE seis_eis_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.seis_eis_status IS 'Live-tracked SEIS Advance Assurance status for Flowen Group Ltd, replacing the [FILL IN] placeholders in the static application letter (src/lib/ip-docs/content.tsx). Admin-editable at /admin/seis-eis.';


--
-- Name: session_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    snapshot_at timestamp with time zone DEFAULT now() NOT NULL,
    pacer_bpm numeric(5,2),
    target_bpm numeric(5,2),
    pacer_phase text,
    rms_level numeric(6,4),
    peak_rms numeric(6,4),
    fundamental_freq_hz numeric(7,2),
    laryngeal_tension_index numeric(4,3),
    is_voice_active boolean DEFAULT false,
    block_detected boolean DEFAULT false,
    block_duration_ms integer,
    pipeline_latency_ms numeric(6,2),
    CONSTRAINT session_snapshots_laryngeal_tension_index_check CHECK (((laryngeal_tension_index >= 0.0) AND (laryngeal_tension_index <= 1.0))),
    CONSTRAINT session_snapshots_pacer_phase_check CHECK ((pacer_phase = ANY (ARRAY['inhale'::text, 'hold'::text, 'exhale'::text, 'rest'::text])))
);


--
-- Name: slp_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slp_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slp_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by text,
    notes text
);


--
-- Name: slp_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slp_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    content text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT slp_messages_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 2000)))
);


--
-- Name: slp_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slp_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slp_user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    priority text DEFAULT 'normal'::text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: slp_session_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slp_session_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    slp_user_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_user_id uuid
);


--
-- Name: social_platform_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_platform_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    stat_date date NOT NULL,
    followers integer,
    follower_delta integer,
    reach integer,
    impressions integer,
    views integer,
    likes integer,
    comments integer,
    shares integer,
    saves integer,
    engagement_rate numeric(6,4),
    website_clicks integer,
    profile_visits integer,
    watch_time_secs bigint,
    attributed_waitlist integer DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_platform_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_platform_tokens (
    platform text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    board_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    post_id text NOT NULL,
    content_type text,
    hook text,
    cta text,
    campaign text,
    creator_type text,
    published_at timestamp with time zone,
    views integer,
    reach integer,
    impressions integer,
    likes integer,
    comments integer,
    shares integer,
    saves integer,
    watch_time_secs bigint,
    website_clicks integer,
    attributed_waitlist integer DEFAULT 0,
    attributed_revenue_pence integer DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_publish_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_publish_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    series text NOT NULL,
    day_num integer,
    platform text NOT NULL,
    caption text NOT NULL,
    hashtags text DEFAULT ''::text NOT NULL,
    asset_path text NOT NULL,
    asset_public_url text,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    published_at timestamp with time zone,
    external_post_id text,
    error_message text,
    attempt_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_publish_queue_platform_check CHECK ((platform = ANY (ARRAY['instagram'::text, 'facebook'::text, 'linkedin'::text, 'pinterest'::text, 'snapchat'::text]))),
    CONSTRAINT social_publish_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'published'::text, 'failed'::text, 'manual_pending'::text, 'manual_done'::text, 'skipped'::text])))
);


--
-- Name: TABLE social_publish_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.social_publish_queue IS 'Cross-platform social publishing queue (distinct from social_posts, which is post-performance analytics). Instagram/Facebook rows are auto-published by /api/cron/social-publish via the Meta Graph API. LinkedIn rows are semi-automated: sit at status=manual_pending and surface in /admin/social for the admin to copy-paste and mark manual_done — LinkedIn Company Page auto-posting requires Marketing Developer Platform approval, which is enterprise-gated and was not pursued.';


--
-- Name: staff_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    role public.staff_role DEFAULT 'admin'::public.staff_role NOT NULL,
    department text,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    invited_by_email text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: staff_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_members (
    id uuid NOT NULL,
    role public.staff_role DEFAULT 'admin'::public.staff_role NOT NULL,
    department text,
    title text,
    bio text,
    status public.staff_status DEFAULT 'active'::public.staff_status NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stage_progressions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stage_progressions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    from_week smallint NOT NULL,
    to_week smallint NOT NULL,
    sessions_count integer NOT NULL,
    avg_bpm numeric(5,2),
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sub_processors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_processors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    purpose text NOT NULL,
    data_categories text NOT NULL,
    location text NOT NULL,
    safeguard text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE sub_processors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sub_processors IS 'The real, current list of sub-processors shown on /dpa and referenced in the privacy policy — admin-editable via /admin/sub-processors instead of hardcoded in page.tsx, so adding a new vendor (e.g. an AI provider) cannot silently go undisclosed again.';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id text NOT NULL,
    user_id uuid NOT NULL,
    status public.subscription_status NOT NULL,
    price_id text NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    customer_id uuid,
    tier_interval text
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    priority public.ticket_priority DEFAULT 'normal'::public.ticket_priority NOT NULL,
    category public.ticket_category DEFAULT 'general'::public.ticket_category NOT NULL,
    user_email text NOT NULL,
    user_name text,
    assigned_to text,
    internal_notes text,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    sla_due_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: system_error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_error_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    environment character varying(50) DEFAULT 'production'::character varying NOT NULL,
    source character varying(100) NOT NULL,
    error_code character varying(100),
    message text NOT NULL,
    stack_trace text,
    metadata jsonb DEFAULT '{}'::jsonb,
    resolved boolean DEFAULT false NOT NULL
);


--
-- Name: telemetry_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetry_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    audio_clip_r2_path text,
    disfluency_type public.disfluency_type NOT NULL,
    confidence_score numeric(4,3) NOT NULL,
    acoustic_embedding extensions.vector(512),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    from_admin boolean DEFAULT false NOT NULL,
    author text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tracking_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracking_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_key text NOT NULL,
    label text NOT NULL,
    icon text DEFAULT '📊'::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    consent_required boolean DEFAULT true NOT NULL,
    pixel_id text,
    head_html text,
    body_html text,
    server_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 99 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: training_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_samples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    storage_path text NOT NULL,
    format text DEFAULT 'audio/webm'::text NOT NULL,
    duration_seconds integer,
    sample_rate_hz integer,
    transcript text,
    disfluency_events jsonb,
    stage_id integer,
    consent_version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: treatment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slp_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    prescribed_stages integer[] DEFAULT '{1}'::integer[] NOT NULL,
    sessions_per_week integer DEFAULT 3 NOT NULL,
    minutes_per_session integer DEFAULT 10 NOT NULL,
    phase text DEFAULT 'Establishment'::text NOT NULL,
    goals text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_programme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_programme (
    user_id uuid NOT NULL,
    current_week integer DEFAULT 1 NOT NULL,
    week_started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_weeks integer[] DEFAULT '{}'::integer[] NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: valuation_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    berkus_sound_idea integer DEFAULT 25000000 NOT NULL,
    berkus_prototype integer DEFAULT 30000000 NOT NULL,
    berkus_management_team integer DEFAULT 20000000 NOT NULL,
    berkus_strategic_rel integer DEFAULT 15000000 NOT NULL,
    berkus_product_rollout integer DEFAULT 10000000 NOT NULL,
    scorecard_median_pence bigint DEFAULT 150000000 NOT NULL,
    scorecard_team numeric DEFAULT 1.0 NOT NULL,
    scorecard_market_size numeric DEFAULT 1.0 NOT NULL,
    scorecard_product_tech numeric DEFAULT 1.0 NOT NULL,
    scorecard_competition numeric DEFAULT 1.0 NOT NULL,
    scorecard_marketing numeric DEFAULT 1.0 NOT NULL,
    scorecard_investment_need numeric DEFAULT 1.0 NOT NULL,
    scorecard_other numeric DEFAULT 1.0 NOT NULL,
    arr_multiple numeric DEFAULT 7.0 NOT NULL,
    vc_exit_valuation_pence bigint DEFAULT 2000000000 NOT NULL,
    vc_investment_pence bigint DEFAULT 75000000 NOT NULL,
    vc_years_to_exit integer DEFAULT 5 NOT NULL,
    vc_required_irr numeric DEFAULT 40.0 NOT NULL,
    comp_arr_multiple_low numeric DEFAULT 5.0 NOT NULL,
    comp_arr_multiple_high numeric DEFAULT 12.0 NOT NULL,
    comp_baseline_pence bigint DEFAULT 200000000 NOT NULL,
    comp_traction_premium_pct numeric DEFAULT 0 NOT NULL,
    dcf_discount_rate numeric DEFAULT 35.0 NOT NULL,
    dcf_terminal_multiple numeric DEFAULT 4.0 NOT NULL,
    dcf_year1_revenue_pence bigint DEFAULT 0 NOT NULL,
    dcf_year2_revenue_pence bigint DEFAULT 0 NOT NULL,
    dcf_year3_revenue_pence bigint DEFAULT 0 NOT NULL,
    nhs_price_per_patient_pence integer DEFAULT 60000 NOT NULL,
    nhs_patients_per_icb integer DEFAULT 500 NOT NULL,
    nhs_icb_count integer DEFAULT 3 NOT NULL,
    nhs_probability_pct numeric DEFAULT 25.0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: valuation_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    low_pence bigint NOT NULL,
    mid_pence bigint NOT NULL,
    high_pence bigint NOT NULL,
    method_outputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    mrr_pence bigint,
    total_users integer,
    round_context text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inbox_item_id uuid,
    vendor_name text NOT NULL,
    amount_pence bigint,
    currency text DEFAULT 'gbp'::text,
    invoice_date date,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: venture_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venture_config (
    id integer DEFAULT 1 NOT NULL,
    round_type text,
    target_raise_pence integer,
    committed_pence integer,
    valuation_cap_pence integer,
    instrument text,
    seis_advance_assurance boolean DEFAULT false NOT NULL,
    seis_limit_remaining_pence integer,
    eis_eligible boolean DEFAULT false NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    monthly_burn_pence integer,
    cash_in_bank_pence integer,
    last_updated_at timestamp with time zone,
    CONSTRAINT single_row CHECK ((id = 1)),
    CONSTRAINT venture_config_instrument_check CHECK ((instrument = ANY (ARRAY['safe'::text, 'convertible_note'::text, 'equity'::text]))),
    CONSTRAINT venture_config_round_type_check CHECK ((round_type = ANY (ARRAY['pre_seed'::text, 'seed'::text, 'seed_bridge'::text, 'series_a'::text])))
);


--
-- Name: visitor_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    converted boolean DEFAULT false NOT NULL,
    country text,
    city text,
    region text,
    landing_page text,
    referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    page_view_count integer DEFAULT 0 NOT NULL
);


--
-- Name: waitlist_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    source text DEFAULT 'waitlist_page'::text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_at timestamp with time zone,
    invite_token text,
    invite_expires_at timestamp with time zone,
    converted_at timestamp with time zone
);


--
-- Name: workflow_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    trigger_type text NOT NULL,
    trigger_config jsonb,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    status public.workflow_status DEFAULT 'draft'::public.workflow_status NOT NULL,
    last_run_at timestamp with time zone,
    run_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workflow_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    status public.workflow_run_status NOT NULL,
    triggered_by text DEFAULT 'manual'::text NOT NULL,
    context jsonb,
    result jsonb,
    error text,
    duration_ms integer,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    user_id uuid,
    current_step integer DEFAULT 1 NOT NULL,
    next_step_at timestamp with time zone
);


--
-- Name: xero_oauth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xero_oauth_tokens (
    entity text NOT NULL,
    tenant_id text,
    tenant_name text,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    scope text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT xero_oauth_tokens_entity_check CHECK ((entity = ANY (ARRAY['group'::text, 'ip'::text, 'speech-technologies'::text, 'labs'::text])))
);


--
-- Name: TABLE xero_oauth_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.xero_oauth_tokens IS 'One row per connected Flowen group company (entity = group/ip/speech-technologies/labs — see src/lib/flowen-entities.ts), refreshed by getValidXeroAccess(entity). No RLS policies — service-role (adminDb) access only, same as gmail_oauth_tokens.';


--
-- Name: ad_platform_stats ad_platform_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_platform_stats
    ADD CONSTRAINT ad_platform_stats_pkey PRIMARY KEY (id);


--
-- Name: ad_platform_stats ad_platform_stats_unique_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_platform_stats
    ADD CONSTRAINT ad_platform_stats_unique_key UNIQUE (platform, stat_date, campaign_id, adset_id, ad_id);


--
-- Name: admin_action_items admin_action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_action_items
    ADD CONSTRAINT admin_action_items_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: affiliate_clicks affiliate_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id);


--
-- Name: affiliate_commissions affiliate_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_conversions affiliate_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_conversions
    ADD CONSTRAINT affiliate_conversions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_payouts affiliate_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);


--
-- Name: affiliates affiliates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_code_key UNIQUE (code);


--
-- Name: affiliates affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);


--
-- Name: ai_drafts ai_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_drafts
    ADD CONSTRAINT ai_drafts_pkey PRIMARY KEY (id);


--
-- Name: alert_history alert_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_history
    ADD CONSTRAINT alert_history_pkey PRIMARY KEY (id);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- Name: anonymized_telemetry_features anonymized_telemetry_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anonymized_telemetry_features
    ADD CONSTRAINT anonymized_telemetry_features_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: asset_files asset_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_pkey PRIMARY KEY (id);


--
-- Name: asset_files asset_files_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_storage_path_key UNIQUE (storage_path);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_log backup_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_log
    ADD CONSTRAINT backup_log_pkey PRIMARY KEY (id);


--
-- Name: bookkeeping_drafts bookkeeping_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookkeeping_drafts
    ADD CONSTRAINT bookkeeping_drafts_pkey PRIMARY KEY (id);


--
-- Name: cal_bookings cal_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cal_bookings
    ADD CONSTRAINT cal_bookings_pkey PRIMARY KEY (id);


--
-- Name: cal_bookings cal_bookings_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cal_bookings
    ADD CONSTRAINT cal_bookings_uid_key UNIQUE (uid);


--
-- Name: campaign_contacts campaign_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_contacts
    ADD CONSTRAINT campaign_contacts_pkey PRIMARY KEY (id);


--
-- Name: campaign_milestones campaign_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_milestones
    ADD CONSTRAINT campaign_milestones_pkey PRIMARY KEY (id);


--
-- Name: campaign_press_links campaign_press_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_press_links
    ADD CONSTRAINT campaign_press_links_pkey PRIMARY KEY (id);


--
-- Name: cap_table_entries cap_table_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cap_table_entries
    ADD CONSTRAINT cap_table_entries_pkey PRIMARY KEY (id);


--
-- Name: company_records company_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_records
    ADD CONSTRAINT company_records_pkey PRIMARY KEY (id);


--
-- Name: compliance_items compliance_items_framework_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_framework_item_code_key UNIQUE (framework, item_code);


--
-- Name: compliance_items compliance_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_pkey PRIMARY KEY (id);


--
-- Name: consent_audit_log consent_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_pkey PRIMARY KEY (id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: consistency_checks consistency_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consistency_checks
    ADD CONSTRAINT consistency_checks_pkey PRIMARY KEY (id);


--
-- Name: conversion_milestones conversion_milestones_milestone_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversion_milestones
    ADD CONSTRAINT conversion_milestones_milestone_external_id_key UNIQUE (milestone, external_id);


--
-- Name: conversion_milestones conversion_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversion_milestones
    ADD CONSTRAINT conversion_milestones_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_contacts crm_contacts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_email_key UNIQUE (email);


--
-- Name: crm_contacts crm_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);


--
-- Name: cron_runs cron_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_runs
    ADD CONSTRAINT cron_runs_pkey PRIMARY KEY (id);


--
-- Name: customers customers_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: data_retention_policies data_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_pkey PRIMARY KEY (user_id);


--
-- Name: data_room_documents data_room_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_room_documents
    ADD CONSTRAINT data_room_documents_pkey PRIMARY KEY (id);


--
-- Name: data_room_documents data_room_documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_room_documents
    ADD CONSTRAINT data_room_documents_storage_path_key UNIQUE (storage_path);


--
-- Name: data_room_invites data_room_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_room_invites
    ADD CONSTRAINT data_room_invites_pkey PRIMARY KEY (id);


--
-- Name: data_room_invites data_room_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_room_invites
    ADD CONSTRAINT data_room_invites_token_key UNIQUE (token);


--
-- Name: deck_invites deck_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_invites
    ADD CONSTRAINT deck_invites_pkey PRIMARY KEY (id);


--
-- Name: deck_invites deck_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_invites
    ADD CONSTRAINT deck_invites_token_key UNIQUE (token);


--
-- Name: deck_views deck_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_views
    ADD CONSTRAINT deck_views_pkey PRIMARY KEY (id);


--
-- Name: deploy_log deploy_log_deployment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploy_log
    ADD CONSTRAINT deploy_log_deployment_id_key UNIQUE (deployment_id);


--
-- Name: deploy_log deploy_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploy_log
    ADD CONSTRAINT deploy_log_pkey PRIMARY KEY (id);


--
-- Name: explee_analytics_snapshots explee_analytics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_analytics_snapshots
    ADD CONSTRAINT explee_analytics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: explee_campaign_imports explee_campaign_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_campaign_imports
    ADD CONSTRAINT explee_campaign_imports_pkey PRIMARY KEY (id);


--
-- Name: explee_campaign_imports explee_campaign_imports_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_campaign_imports
    ADD CONSTRAINT explee_campaign_imports_task_id_key UNIQUE (task_id);


--
-- Name: explee_campaigns explee_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_campaigns
    ADD CONSTRAINT explee_campaigns_pkey PRIMARY KEY (id);


--
-- Name: explee_contacts explee_contacts_campaign_id_person_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_contacts
    ADD CONSTRAINT explee_contacts_campaign_id_person_id_key UNIQUE (campaign_id, person_id);


--
-- Name: explee_contacts explee_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_contacts
    ADD CONSTRAINT explee_contacts_pkey PRIMARY KEY (id);


--
-- Name: explee_dedup_lists explee_dedup_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_dedup_lists
    ADD CONSTRAINT explee_dedup_lists_pkey PRIMARY KEY (id);


--
-- Name: explee_messages explee_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_messages
    ADD CONSTRAINT explee_messages_pkey PRIMARY KEY (id);


--
-- Name: explee_prospects explee_prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_prospects
    ADD CONSTRAINT explee_prospects_pkey PRIMARY KEY (id);


--
-- Name: explee_searches explee_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_searches
    ADD CONSTRAINT explee_searches_pkey PRIMARY KEY (id);


--
-- Name: explee_searches explee_searches_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_searches
    ADD CONSTRAINT explee_searches_task_id_key UNIQUE (task_id);


--
-- Name: feature_flags feature_flags_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_key_key UNIQUE (key);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: gdpr_requests gdpr_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gdpr_requests
    ADD CONSTRAINT gdpr_requests_pkey PRIMARY KEY (id);


--
-- Name: gmail_oauth_tokens gmail_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_oauth_tokens
    ADD CONSTRAINT gmail_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: google_analytics_stats google_analytics_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_analytics_stats
    ADD CONSTRAINT google_analytics_stats_pkey PRIMARY KEY (id);


--
-- Name: google_analytics_stats google_analytics_stats_property_id_stat_date_source_medium__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_analytics_stats
    ADD CONSTRAINT google_analytics_stats_property_id_stat_date_source_medium__key UNIQUE (property_id, stat_date, source, medium, campaign);


--
-- Name: grants grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grants
    ADD CONSTRAINT grants_pkey PRIMARY KEY (id);


--
-- Name: handoff_notes handoff_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_notes
    ADD CONSTRAINT handoff_notes_pkey PRIMARY KEY (id);


--
-- Name: hazard_log hazard_log_hazard_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hazard_log
    ADD CONSTRAINT hazard_log_hazard_ref_key UNIQUE (hazard_ref);


--
-- Name: hazard_log hazard_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hazard_log
    ADD CONSTRAINT hazard_log_pkey PRIMARY KEY (id);


--
-- Name: inbox_items inbox_items_gmail_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_items
    ADD CONSTRAINT inbox_items_gmail_message_id_key UNIQUE (gmail_message_id);


--
-- Name: inbox_items inbox_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_items
    ADD CONSTRAINT inbox_items_pkey PRIMARY KEY (id);


--
-- Name: insurance_policies insurance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_pkey PRIMARY KEY (id);


--
-- Name: investor_updates investor_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_updates
    ADD CONSTRAINT investor_updates_pkey PRIMARY KEY (id);


--
-- Name: investors investors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investors
    ADD CONSTRAINT investors_pkey PRIMARY KEY (id);


--
-- Name: ip_assets ip_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_assets
    ADD CONSTRAINT ip_assets_pkey PRIMARY KEY (id);


--
-- Name: ip_audit_items ip_audit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_audit_items
    ADD CONSTRAINT ip_audit_items_pkey PRIMARY KEY (id);


--
-- Name: ip_audit_items ip_audit_items_title_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_audit_items
    ADD CONSTRAINT ip_audit_items_title_unique UNIQUE (title);


--
-- Name: ip_funding_items ip_funding_items_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_funding_items
    ADD CONSTRAINT ip_funding_items_name_unique UNIQUE (name);


--
-- Name: ip_funding_items ip_funding_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_funding_items
    ADD CONSTRAINT ip_funding_items_pkey PRIMARY KEY (id);


--
-- Name: ip_model_versions ip_model_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_model_versions
    ADD CONSTRAINT ip_model_versions_pkey PRIMARY KEY (id);


--
-- Name: marketing_attribution marketing_attribution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_attribution
    ADD CONSTRAINT marketing_attribution_pkey PRIMARY KEY (anonymous_id);


--
-- Name: marketing_recommendations marketing_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_recommendations
    ADD CONSTRAINT marketing_recommendations_pkey PRIMARY KEY (id);


--
-- Name: nhs_block_pledges nhs_block_pledges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nhs_block_pledges
    ADD CONSTRAINT nhs_block_pledges_pkey PRIMARY KEY (id);


--
-- Name: nhs_icb_contacts nhs_icb_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nhs_icb_contacts
    ADD CONSTRAINT nhs_icb_contacts_pkey PRIMARY KEY (id);


--
-- Name: nhs_slp_signups nhs_slp_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nhs_slp_signups
    ADD CONSTRAINT nhs_slp_signups_pkey PRIMARY KEY (id);


--
-- Name: notification_log notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_pkey PRIMARY KEY (id);


--
-- Name: nps_responses nps_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_responses
    ADD CONSTRAINT nps_responses_pkey PRIMARY KEY (id);


--
-- Name: nps_responses nps_responses_survey_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_responses
    ADD CONSTRAINT nps_responses_survey_token_key UNIQUE (survey_token);


--
-- Name: organizations organizations_contract_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_contract_reference_key UNIQUE (contract_reference);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: practice_sessions practice_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_sessions
    ADD CONSTRAINT practice_sessions_pkey PRIMARY KEY (id);


--
-- Name: processed_webhook_events processed_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_webhook_events
    ADD CONSTRAINT processed_webhook_events_pkey PRIMARY KEY (event_id);


--
-- Name: profiles profiles_didit_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_didit_session_id_key UNIQUE (didit_session_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: recommendation_actions recommendation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_actions
    ADD CONSTRAINT recommendation_actions_pkey PRIMARY KEY (id);


--
-- Name: roadmap_milestones roadmap_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_milestones
    ADD CONSTRAINT roadmap_milestones_pkey PRIMARY KEY (id);


--
-- Name: safeguarding_concerns safeguarding_concerns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safeguarding_concerns
    ADD CONSTRAINT safeguarding_concerns_pkey PRIMARY KEY (id);


--
-- Name: seis_eis_status seis_eis_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seis_eis_status
    ADD CONSTRAINT seis_eis_status_pkey PRIMARY KEY (id);


--
-- Name: session_snapshots session_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT session_snapshots_pkey PRIMARY KEY (id);


--
-- Name: slp_assignments slp_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_assignments
    ADD CONSTRAINT slp_assignments_pkey PRIMARY KEY (id);


--
-- Name: slp_assignments slp_assignments_slp_user_id_patient_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_assignments
    ADD CONSTRAINT slp_assignments_slp_user_id_patient_user_id_key UNIQUE (slp_user_id, patient_user_id);


--
-- Name: slp_messages slp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_messages
    ADD CONSTRAINT slp_messages_pkey PRIMARY KEY (id);


--
-- Name: slp_notifications slp_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_notifications
    ADD CONSTRAINT slp_notifications_pkey PRIMARY KEY (id);


--
-- Name: slp_session_notes slp_session_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_session_notes
    ADD CONSTRAINT slp_session_notes_pkey PRIMARY KEY (id);


--
-- Name: social_platform_stats social_platform_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_platform_stats
    ADD CONSTRAINT social_platform_stats_pkey PRIMARY KEY (id);


--
-- Name: social_platform_stats social_platform_stats_platform_stat_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_platform_stats
    ADD CONSTRAINT social_platform_stats_platform_stat_date_key UNIQUE (platform, stat_date);


--
-- Name: social_platform_tokens social_platform_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_platform_tokens
    ADD CONSTRAINT social_platform_tokens_pkey PRIMARY KEY (platform);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_platform_post_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_platform_post_id_key UNIQUE (platform, post_id);


--
-- Name: social_publish_queue social_publish_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_publish_queue
    ADD CONSTRAINT social_publish_queue_pkey PRIMARY KEY (id);


--
-- Name: staff_invites staff_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invites
    ADD CONSTRAINT staff_invites_pkey PRIMARY KEY (id);


--
-- Name: staff_invites staff_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invites
    ADD CONSTRAINT staff_invites_token_key UNIQUE (token);


--
-- Name: staff_members staff_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_pkey PRIMARY KEY (id);


--
-- Name: stage_progressions stage_progressions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_progressions
    ADD CONSTRAINT stage_progressions_pkey PRIMARY KEY (id);


--
-- Name: sub_processors sub_processors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_processors
    ADD CONSTRAINT sub_processors_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_error_logs system_error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_error_logs
    ADD CONSTRAINT system_error_logs_pkey PRIMARY KEY (id);


--
-- Name: telemetry_logs telemetry_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_logs
    ADD CONSTRAINT telemetry_logs_pkey PRIMARY KEY (id);


--
-- Name: ticket_messages ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: tracking_providers tracking_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_providers
    ADD CONSTRAINT tracking_providers_pkey PRIMARY KEY (id);


--
-- Name: tracking_providers tracking_providers_provider_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_providers
    ADD CONSTRAINT tracking_providers_provider_key_key UNIQUE (provider_key);


--
-- Name: training_samples training_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_samples
    ADD CONSTRAINT training_samples_pkey PRIMARY KEY (id);


--
-- Name: treatment_plans treatment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_pkey PRIMARY KEY (id);


--
-- Name: treatment_plans treatment_plans_slp_user_id_patient_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_slp_user_id_patient_user_id_key UNIQUE (slp_user_id, patient_user_id);


--
-- Name: user_programme user_programme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_programme
    ADD CONSTRAINT user_programme_pkey PRIMARY KEY (user_id);


--
-- Name: valuation_config valuation_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_config
    ADD CONSTRAINT valuation_config_pkey PRIMARY KEY (id);


--
-- Name: valuation_snapshots valuation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_snapshots
    ADD CONSTRAINT valuation_snapshots_pkey PRIMARY KEY (id);


--
-- Name: vendor_invoices vendor_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_invoices
    ADD CONSTRAINT vendor_invoices_pkey PRIMARY KEY (id);


--
-- Name: venture_config venture_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venture_config
    ADD CONSTRAINT venture_config_pkey PRIMARY KEY (id);


--
-- Name: visitor_sessions visitor_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_pkey PRIMARY KEY (id);


--
-- Name: waitlist_signups waitlist_signups_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_signups
    ADD CONSTRAINT waitlist_signups_email_key UNIQUE (email);


--
-- Name: waitlist_signups waitlist_signups_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_signups
    ADD CONSTRAINT waitlist_signups_invite_token_key UNIQUE (invite_token);


--
-- Name: waitlist_signups waitlist_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_signups
    ADD CONSTRAINT waitlist_signups_pkey PRIMARY KEY (id);


--
-- Name: workflow_definitions workflow_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_runs workflow_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_pkey PRIMARY KEY (id);


--
-- Name: xero_oauth_tokens xero_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xero_oauth_tokens
    ADD CONSTRAINT xero_oauth_tokens_pkey PRIMARY KEY (entity);


--
-- Name: admin_action_items_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_action_items_status_idx ON public.admin_action_items USING btree (status, created_at DESC);


--
-- Name: admin_notifications_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_notifications_unread_idx ON public.admin_notifications USING btree (read_at) WHERE (read_at IS NULL);


--
-- Name: affiliate_clicks_affiliate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_clicks_affiliate_idx ON public.affiliate_clicks USING btree (affiliate_id);


--
-- Name: affiliate_clicks_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_clicks_created_idx ON public.affiliate_clicks USING btree (created_at DESC);


--
-- Name: affiliate_commissions_affiliate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_commissions_affiliate_idx ON public.affiliate_commissions USING btree (affiliate_id);


--
-- Name: affiliate_commissions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_commissions_status_idx ON public.affiliate_commissions USING btree (status);


--
-- Name: affiliate_conversions_affiliate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_conversions_affiliate_idx ON public.affiliate_conversions USING btree (affiliate_id);


--
-- Name: affiliate_conversions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_conversions_user_idx ON public.affiliate_conversions USING btree (referred_user_id);


--
-- Name: affiliate_payouts_affiliate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_payouts_affiliate_idx ON public.affiliate_payouts USING btree (affiliate_id);


--
-- Name: affiliate_payouts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_payouts_status_idx ON public.affiliate_payouts USING btree (status);


--
-- Name: affiliates_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliates_code_idx ON public.affiliates USING btree (code);


--
-- Name: affiliates_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliates_email_idx ON public.affiliates USING btree (email);


--
-- Name: affiliates_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliates_status_idx ON public.affiliates USING btree (status);


--
-- Name: ai_drafts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_drafts_status_idx ON public.ai_drafts USING btree (status);


--
-- Name: audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC);


--
-- Name: bookkeeping_drafts_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookkeeping_drafts_entity_idx ON public.bookkeeping_drafts USING btree (entity);


--
-- Name: bookkeeping_drafts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookkeeping_drafts_status_idx ON public.bookkeeping_drafts USING btree (status);


--
-- Name: bookkeeping_drafts_type_ref_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookkeeping_drafts_type_ref_entity_idx ON public.bookkeeping_drafts USING btree (draft_type, source_ref, entity);


--
-- Name: cal_bookings_attendee_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cal_bookings_attendee_email_idx ON public.cal_bookings USING btree (attendee_email);


--
-- Name: cap_table_entries_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cap_table_entries_created_at_idx ON public.cap_table_entries USING btree (created_at);


--
-- Name: cap_table_entries_holder_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cap_table_entries_holder_type_idx ON public.cap_table_entries USING btree (holder_type);


--
-- Name: consent_records_anonymous_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_records_anonymous_id_idx ON public.consent_records USING btree (anonymous_id, created_at DESC);


--
-- Name: consent_records_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_records_user_id_idx ON public.consent_records USING btree (user_id, created_at DESC);


--
-- Name: consistency_checks_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consistency_checks_type_idx ON public.consistency_checks USING btree (check_type, checked_at DESC);


--
-- Name: crm_activities_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_activities_contact_idx ON public.crm_activities USING btree (crm_contact_id, occurred_at DESC);


--
-- Name: crm_contacts_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_contacts_category_idx ON public.crm_contacts USING btree (category);


--
-- Name: crm_contacts_explee_became_hot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_contacts_explee_became_hot_idx ON public.crm_contacts USING btree (became_hot_at) WHERE (source = 'explee'::text);


--
-- Name: crm_contacts_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_contacts_stage_idx ON public.crm_contacts USING btree (stage);


--
-- Name: explee_analytics_snapshots_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_analytics_snapshots_project_idx ON public.explee_analytics_snapshots USING btree (project_id, captured_at DESC);


--
-- Name: explee_contacts_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_contacts_email_idx ON public.explee_contacts USING btree (email);


--
-- Name: explee_contacts_intent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_contacts_intent_idx ON public.explee_contacts USING btree (latest_intent);


--
-- Name: explee_contacts_needs_reply_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_contacts_needs_reply_idx ON public.explee_contacts USING btree (needs_reply) WHERE (needs_reply = true);


--
-- Name: explee_contacts_profile_synced_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_contacts_profile_synced_at_idx ON public.explee_contacts USING btree (profile_synced_at) WHERE (profile_synced_at IS NULL);


--
-- Name: explee_messages_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX explee_messages_message_id_idx ON public.explee_messages USING btree (campaign_id, person_id, message_id) WHERE (message_id IS NOT NULL);


--
-- Name: explee_messages_person_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_messages_person_idx ON public.explee_messages USING btree (campaign_id, person_id);


--
-- Name: explee_prospects_company_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_prospects_company_domain_idx ON public.explee_prospects USING btree (company_domain);


--
-- Name: explee_prospects_search_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX explee_prospects_search_id_idx ON public.explee_prospects USING btree (search_id);


--
-- Name: idx_ad_stats_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_stats_campaign ON public.ad_platform_stats USING btree (campaign_id);


--
-- Name: idx_ad_stats_platform_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_stats_platform_date ON public.ad_platform_stats USING btree (platform, stat_date DESC);


--
-- Name: idx_affiliates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliates_user_id ON public.affiliates USING btree (user_id);


--
-- Name: idx_anon_telemetry_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anon_telemetry_customer_id ON public.anonymized_telemetry_features USING btree (customer_id);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp" DESC);


--
-- Name: idx_consent_audit_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_audit_event ON public.consent_audit_log USING btree (event_type, recorded_at DESC);


--
-- Name: idx_consent_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_audit_log_user_id ON public.consent_audit_log USING btree (user_id);


--
-- Name: idx_error_logs_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_resolved ON public.system_error_logs USING btree (resolved);


--
-- Name: idx_error_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_timestamp ON public.system_error_logs USING btree ("timestamp" DESC);


--
-- Name: idx_feedback_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_user_id ON public.feedback USING btree (user_id);


--
-- Name: idx_handoff_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_handoff_created ON public.handoff_notes USING btree (created_at DESC);


--
-- Name: idx_ma_fbclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ma_fbclid ON public.marketing_attribution USING btree (fbclid) WHERE (fbclid IS NOT NULL);


--
-- Name: idx_ma_first_seen_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ma_first_seen_at ON public.marketing_attribution USING btree (first_seen_at DESC);


--
-- Name: idx_ma_gclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ma_gclid ON public.marketing_attribution USING btree (gclid) WHERE (gclid IS NOT NULL);


--
-- Name: idx_ma_meta_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ma_meta_pending ON public.marketing_attribution USING btree (meta_event_sent) WHERE ((meta_event_sent = false) AND (user_id IS NOT NULL));


--
-- Name: idx_ma_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ma_user_id ON public.marketing_attribution USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_mkt_recs_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mkt_recs_section ON public.marketing_recommendations USING btree (section);


--
-- Name: idx_mkt_recs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mkt_recs_status ON public.marketing_recommendations USING btree (status, generated_at DESC);


--
-- Name: idx_nps_responses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nps_responses_user_id ON public.nps_responses USING btree (user_id);


--
-- Name: idx_practice_sessions_audio_storage_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_practice_sessions_audio_storage_path ON public.practice_sessions USING btree (audio_storage_path) WHERE (audio_storage_path IS NOT NULL);


--
-- Name: idx_profiles_erasure_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_erasure_queue ON public.profiles USING btree (data_erasure_requested_at) WHERE ((data_erasure_requested_at IS NOT NULL) AND (data_erasure_completed_at IS NULL));


--
-- Name: idx_profiles_social_follow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_social_follow ON public.profiles USING btree (social_follow_verified_at) WHERE (social_follow_verified_at IS NOT NULL);


--
-- Name: idx_profiles_tier_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_tier_brand ON public.profiles USING btree (tier, brand);


--
-- Name: idx_rec_actions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rec_actions_date ON public.recommendation_actions USING btree (approved_at DESC);


--
-- Name: idx_rec_actions_rec_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rec_actions_rec_id ON public.recommendation_actions USING btree (recommendation_id);


--
-- Name: idx_sessions_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_created ON public.practice_sessions USING btree (user_id, created_at DESC);


--
-- Name: idx_slp_assignments_patient_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slp_assignments_patient_user_id ON public.slp_assignments USING btree (patient_user_id);


--
-- Name: idx_slp_messages_from_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slp_messages_from_user_id ON public.slp_messages USING btree (from_user_id);


--
-- Name: idx_slp_messages_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slp_messages_to ON public.slp_messages USING btree (to_user_id, read_at) WHERE (read_at IS NULL);


--
-- Name: idx_slp_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slp_notifications_recipient ON public.slp_notifications USING btree (slp_user_id, read_at);


--
-- Name: idx_slp_session_notes_slp_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slp_session_notes_slp_user_id ON public.slp_session_notes USING btree (slp_user_id);


--
-- Name: idx_social_posts_platform_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_platform_date ON public.social_posts USING btree (platform, published_at DESC);


--
-- Name: idx_social_publish_queue_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_publish_queue_due ON public.social_publish_queue USING btree (platform, status, scheduled_at);


--
-- Name: idx_social_stats_platform_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_stats_platform_date ON public.social_platform_stats USING btree (platform, stat_date DESC);


--
-- Name: idx_subscriptions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions USING btree (customer_id);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_training_samples_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_samples_session_id ON public.training_samples USING btree (session_id);


--
-- Name: idx_treatment_plans_patient_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treatment_plans_patient_user_id ON public.treatment_plans USING btree (patient_user_id);


--
-- Name: idx_visitor_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_sessions_user_id ON public.visitor_sessions USING btree (user_id);


--
-- Name: idx_workflow_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_user_id ON public.workflow_runs USING btree (user_id);


--
-- Name: inbox_items_alias_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inbox_items_alias_idx ON public.inbox_items USING btree (alias);


--
-- Name: inbox_items_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inbox_items_category_idx ON public.inbox_items USING btree (category);


--
-- Name: inbox_items_gmail_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inbox_items_gmail_category_idx ON public.inbox_items USING btree (gmail_category);


--
-- Name: inbox_items_received_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inbox_items_received_at_idx ON public.inbox_items USING btree (received_at DESC);


--
-- Name: ip_audit_items_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ip_audit_items_category_idx ON public.ip_audit_items USING btree (category);


--
-- Name: ip_audit_items_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ip_audit_items_priority_idx ON public.ip_audit_items USING btree (priority, created_at);


--
-- Name: ip_audit_items_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ip_audit_items_status_idx ON public.ip_audit_items USING btree (status);


--
-- Name: ip_funding_items_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ip_funding_items_status_idx ON public.ip_funding_items USING btree (status);


--
-- Name: ip_funding_items_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ip_funding_items_type_idx ON public.ip_funding_items USING btree (program_type);


--
-- Name: slp_session_notes_patient_slp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX slp_session_notes_patient_slp_idx ON public.slp_session_notes USING btree (patient_user_id, slp_user_id, created_at DESC);


--
-- Name: stage_progressions_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stage_progressions_created_at_idx ON public.stage_progressions USING btree (created_at DESC);


--
-- Name: stage_progressions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stage_progressions_user_id_idx ON public.stage_progressions USING btree (user_id);


--
-- Name: training_samples_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_samples_created_at_idx ON public.training_samples USING btree (created_at DESC);


--
-- Name: training_samples_stage_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_samples_stage_id_idx ON public.training_samples USING btree (stage_id);


--
-- Name: training_samples_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_samples_user_id_idx ON public.training_samples USING btree (user_id);


--
-- Name: vendor_invoices_vendor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendor_invoices_vendor_idx ON public.vendor_invoices USING btree (vendor_name);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_auth_user_email_change; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_email_change AFTER INSERT OR UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();


--
-- Name: ip_audit_items ip_audit_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ip_audit_items_updated_at BEFORE UPDATE ON public.ip_audit_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ip_funding_items ip_funding_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ip_funding_items_updated_at BEFORE UPDATE ON public.ip_funding_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles on_profile_created_set_retention; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created_set_retention AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_retention_policy();


--
-- Name: marketing_attribution trg_ma_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ma_updated_at BEFORE UPDATE ON public.marketing_attribution FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: marketing_attribution trg_marketing_attribution_meta_capi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_marketing_attribution_meta_capi AFTER UPDATE ON public.marketing_attribution FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_attribution_meta_capi();


--
-- Name: slp_messages trg_notify_slp_new_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_slp_new_message AFTER INSERT ON public.slp_messages FOR EACH ROW EXECUTE FUNCTION public.notify_slp_new_message();


--
-- Name: practice_sessions trg_notify_slp_session_completed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_slp_session_completed AFTER INSERT ON public.practice_sessions FOR EACH ROW EXECUTE FUNCTION public.notify_slp_session_completed();


--
-- Name: affiliate_clicks affiliate_clicks_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_commissions affiliate_commissions_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_commissions affiliate_commissions_conversion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_conversion_id_fkey FOREIGN KEY (conversion_id) REFERENCES public.affiliate_conversions(id) ON DELETE SET NULL;


--
-- Name: affiliate_commissions affiliate_commissions_payout_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_payout_fk FOREIGN KEY (payout_id) REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL;


--
-- Name: affiliate_conversions affiliate_conversions_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_conversions
    ADD CONSTRAINT affiliate_conversions_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_conversions affiliate_conversions_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_conversions
    ADD CONSTRAINT affiliate_conversions_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: affiliate_payouts affiliate_payouts_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliates affiliates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ai_drafts ai_drafts_crm_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_drafts
    ADD CONSTRAINT ai_drafts_crm_contact_id_fkey FOREIGN KEY (crm_contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: ai_drafts ai_drafts_inbox_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_drafts
    ADD CONSTRAINT ai_drafts_inbox_item_id_fkey FOREIGN KEY (inbox_item_id) REFERENCES public.inbox_items(id) ON DELETE CASCADE;


--
-- Name: ai_drafts ai_drafts_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_drafts
    ADD CONSTRAINT ai_drafts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: alert_history alert_history_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_history
    ADD CONSTRAINT alert_history_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id) ON DELETE CASCADE;


--
-- Name: anonymized_telemetry_features anonymized_telemetry_features_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anonymized_telemetry_features
    ADD CONSTRAINT anonymized_telemetry_features_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: bookkeeping_drafts bookkeeping_drafts_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookkeeping_drafts
    ADD CONSTRAINT bookkeeping_drafts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: cal_bookings cal_bookings_crm_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cal_bookings
    ADD CONSTRAINT cal_bookings_crm_contact_id_fkey FOREIGN KEY (crm_contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: consent_audit_log consent_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: crm_activities crm_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: crm_activities crm_activities_crm_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_crm_contact_id_fkey FOREIGN KEY (crm_contact_id) REFERENCES public.crm_contacts(id) ON DELETE CASCADE;


--
-- Name: customers customers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: data_retention_policies data_retention_policies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: deck_views deck_views_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_views
    ADD CONSTRAINT deck_views_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.deck_invites(id) ON DELETE CASCADE;


--
-- Name: explee_contacts explee_contacts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_contacts
    ADD CONSTRAINT explee_contacts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.explee_campaigns(id) ON DELETE CASCADE;


--
-- Name: explee_contacts explee_contacts_crm_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_contacts
    ADD CONSTRAINT explee_contacts_crm_contact_id_fkey FOREIGN KEY (crm_contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: explee_messages explee_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_messages
    ADD CONSTRAINT explee_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.explee_campaigns(id) ON DELETE CASCADE;


--
-- Name: explee_prospects explee_prospects_search_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explee_prospects
    ADD CONSTRAINT explee_prospects_search_id_fkey FOREIGN KEY (search_id) REFERENCES public.explee_searches(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles fk_profiles_organization; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT fk_profiles_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: inbox_items inbox_items_crm_contact_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_items
    ADD CONSTRAINT inbox_items_crm_contact_fk FOREIGN KEY (crm_contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: marketing_attribution marketing_attribution_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_attribution
    ADD CONSTRAINT marketing_attribution_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_recommendations marketing_recommendations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_recommendations
    ADD CONSTRAINT marketing_recommendations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: marketing_recommendations marketing_recommendations_rejected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_recommendations
    ADD CONSTRAINT marketing_recommendations_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES auth.users(id);


--
-- Name: notification_log notification_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: nps_responses nps_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_responses
    ADD CONSTRAINT nps_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: page_views page_views_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.visitor_sessions(id) ON DELETE CASCADE;


--
-- Name: practice_sessions practice_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_sessions
    ADD CONSTRAINT practice_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recommendation_actions recommendation_actions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_actions
    ADD CONSTRAINT recommendation_actions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: recommendation_actions recommendation_actions_recommendation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_actions
    ADD CONSTRAINT recommendation_actions_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.marketing_recommendations(id);


--
-- Name: safeguarding_concerns safeguarding_concerns_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safeguarding_concerns
    ADD CONSTRAINT safeguarding_concerns_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: session_snapshots session_snapshots_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT session_snapshots_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.practice_sessions(id) ON DELETE CASCADE;


--
-- Name: session_snapshots session_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT session_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: slp_assignments slp_assignments_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_assignments
    ADD CONSTRAINT slp_assignments_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: slp_assignments slp_assignments_slp_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_assignments
    ADD CONSTRAINT slp_assignments_slp_user_id_fkey FOREIGN KEY (slp_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: slp_messages slp_messages_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_messages
    ADD CONSTRAINT slp_messages_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: slp_messages slp_messages_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_messages
    ADD CONSTRAINT slp_messages_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: slp_notifications slp_notifications_slp_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_notifications
    ADD CONSTRAINT slp_notifications_slp_user_id_fkey FOREIGN KEY (slp_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: slp_session_notes slp_session_notes_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_session_notes
    ADD CONSTRAINT slp_session_notes_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: slp_session_notes slp_session_notes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_session_notes
    ADD CONSTRAINT slp_session_notes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.practice_sessions(id) ON DELETE CASCADE;


--
-- Name: slp_session_notes slp_session_notes_slp_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slp_session_notes
    ADD CONSTRAINT slp_session_notes_slp_user_id_fkey FOREIGN KEY (slp_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stage_progressions stage_progressions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_progressions
    ADD CONSTRAINT stage_progressions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: telemetry_logs telemetry_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_logs
    ADD CONSTRAINT telemetry_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.practice_sessions(id) ON DELETE CASCADE;


--
-- Name: telemetry_logs telemetry_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_logs
    ADD CONSTRAINT telemetry_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ticket_messages ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: training_samples training_samples_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_samples
    ADD CONSTRAINT training_samples_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.practice_sessions(id) ON DELETE CASCADE;


--
-- Name: training_samples training_samples_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_samples
    ADD CONSTRAINT training_samples_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: treatment_plans treatment_plans_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: treatment_plans treatment_plans_slp_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_slp_user_id_fkey FOREIGN KEY (slp_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_programme user_programme_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_programme
    ADD CONSTRAINT user_programme_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vendor_invoices vendor_invoices_inbox_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_invoices
    ADD CONSTRAINT vendor_invoices_inbox_item_id_fkey FOREIGN KEY (inbox_item_id) REFERENCES public.inbox_items(id) ON DELETE SET NULL;


--
-- Name: visitor_sessions visitor_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: workflow_runs workflow_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: workflow_runs workflow_runs_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON DELETE CASCADE;


--
-- Name: marketing_attribution Admins can read attribution data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read attribution data" ON public.marketing_attribution FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: feedback Admins can read feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read feedback" ON public.feedback FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: nps_responses Admins can read nps_responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read nps_responses" ON public.nps_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: audit_logs Admins read audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: asset_files Public read asset_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read asset_files" ON public.asset_files FOR SELECT USING (true);


--
-- Name: feedback Users can insert their own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own feedback" ON public.feedback FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: consent_audit_log Users insert own consent events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own consent events" ON public.consent_audit_log FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: practice_sessions Users insert own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own sessions" ON public.practice_sessions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: session_snapshots Users insert own snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own snapshots" ON public.session_snapshots FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: telemetry_logs Users insert telemetry if opted in; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert telemetry if opted in" ON public.telemetry_logs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.opt_in_telemetry = true)))));


--
-- Name: training_samples Users read own training samples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own training samples" ON public.training_samples FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: data_retention_policies Users update own retention policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own retention policy" ON public.data_retention_policies FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: data_retention_policies Users upsert own retention policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users upsert own retention policy" ON public.data_retention_policies FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: consent_audit_log Users view own consent history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own consent history" ON public.consent_audit_log FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: data_retention_policies Users view own retention policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own retention policy" ON public.data_retention_policies FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: practice_sessions Users view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own sessions" ON public.practice_sessions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: session_snapshots Users view own snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own snapshots" ON public.session_snapshots FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ad_platform_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_platform_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_action_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_action_items ENABLE ROW LEVEL SECURITY;

--
-- Name: google_analytics_stats admin_all_google_analytics_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_google_analytics_stats ON public.google_analytics_stats USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));


--
-- Name: admin_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_clicks admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.affiliate_clicks USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: affiliate_commissions admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.affiliate_commissions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: affiliate_conversions admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.affiliate_conversions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: affiliate_payouts admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.affiliate_payouts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: affiliates admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.affiliates USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: backup_log admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.backup_log USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: deploy_log admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.deploy_log USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: valuation_config admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.valuation_config USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: valuation_snapshots admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.valuation_snapshots USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: admin_notifications admins can read notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can read notifications" ON public.admin_notifications FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: alert_history admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.alert_history USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: alert_rules admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.alert_rules USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: api_keys admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.api_keys USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: audit_log admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.audit_log USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: campaign_contacts admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.campaign_contacts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: campaign_milestones admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.campaign_milestones USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: campaign_press_links admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.campaign_press_links USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: cap_table_entries admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.cap_table_entries USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: compliance_items admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.compliance_items USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: cron_runs admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.cron_runs USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: data_room_documents admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.data_room_documents USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: data_room_invites admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.data_room_invites USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: deck_invites admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.deck_invites USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: deck_views admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.deck_views USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: feature_flags admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.feature_flags USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: grants admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.grants USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: handoff_notes admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.handoff_notes USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: hazard_log admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.hazard_log USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: investor_updates admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.investor_updates USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: investors admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.investors USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: ip_assets admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.ip_assets USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: ip_model_versions admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.ip_model_versions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: nhs_block_pledges admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.nhs_block_pledges USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: nhs_icb_contacts admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.nhs_icb_contacts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: nhs_slp_signups admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.nhs_slp_signups USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: processed_webhook_events admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.processed_webhook_events USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: roadmap_milestones admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.roadmap_milestones USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: staff_invites admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.staff_invites USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: staff_members admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.staff_members USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: support_tickets admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.support_tickets USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: ticket_messages admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.ticket_messages USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: venture_config admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.venture_config USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: workflow_definitions admins_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_full_access ON public.workflow_definitions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: ad_platform_stats admins_manage_ad_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_ad_stats ON public.ad_platform_stats USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: marketing_recommendations admins_manage_recommendations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_recommendations ON public.marketing_recommendations USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: social_posts admins_manage_social_posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_social_posts ON public.social_posts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: social_platform_stats admins_manage_social_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_social_stats ON public.social_platform_stats USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: tracking_providers admins_manage_tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_tracking ON public.tracking_providers USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: recommendation_actions admins_read_rec_actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_read_rec_actions ON public.recommendation_actions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: affiliate_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_conversions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: anonymized_telemetry_features; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anonymized_telemetry_features ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_files ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;

--
-- Name: bookkeeping_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookkeeping_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: cal_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cal_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_press_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_press_links ENABLE ROW LEVEL SECURITY;

--
-- Name: cap_table_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cap_table_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: slp_notifications clinicians read their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "clinicians read their own notifications" ON public.slp_notifications FOR SELECT USING ((( SELECT auth.uid() AS uid) = slp_user_id));


--
-- Name: slp_notifications clinicians update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "clinicians update their own notifications" ON public.slp_notifications FOR UPDATE USING ((( SELECT auth.uid() AS uid) = slp_user_id));


--
-- Name: company_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_records ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

--
-- Name: consistency_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consistency_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: conversion_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversion_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: cron_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: data_retention_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: data_room_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_room_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: data_room_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_room_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: deck_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deck_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: deck_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deck_views ENABLE ROW LEVEL SECURITY;

--
-- Name: gdpr_requests del_gdpr_requests_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_gdpr_requests_admin ON public.gdpr_requests FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: notification_log del_notification_log_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_notification_log_admin ON public.notification_log FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: treatment_plans del_treatment_plans_slp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_treatment_plans_slp ON public.treatment_plans FOR DELETE USING ((slp_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: workflow_runs del_workflow_runs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_workflow_runs_admin ON public.workflow_runs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: app_config deny_direct_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_direct_access ON public.app_config AS RESTRICTIVE USING (false);


--
-- Name: ip_audit_items deny_direct_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_direct_access ON public.ip_audit_items AS RESTRICTIVE USING (false);


--
-- Name: ip_funding_items deny_direct_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_direct_access ON public.ip_funding_items AS RESTRICTIVE USING (false);


--
-- Name: deploy_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deploy_log ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_analytics_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_analytics_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_campaign_imports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_campaign_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_dedup_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_dedup_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_prospects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_prospects ENABLE ROW LEVEL SECURITY;

--
-- Name: explee_searches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.explee_searches ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: gdpr_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: gmail_oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: google_analytics_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_analytics_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;

--
-- Name: handoff_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handoff_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: hazard_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hazard_log ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

--
-- Name: anonymized_telemetry_features ins_anon_telemetry_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_anon_telemetry_auth ON public.anonymized_telemetry_features FOR INSERT TO authenticated WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.auth_user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: gdpr_requests ins_gdpr_requests_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_gdpr_requests_admin ON public.gdpr_requests FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: notification_log ins_notification_log_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_notification_log_admin ON public.notification_log FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: organizations ins_organizations_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_organizations_admin ON public.organizations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: treatment_plans ins_treatment_plans_slp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_treatment_plans_slp ON public.treatment_plans FOR INSERT TO authenticated WITH CHECK ((slp_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: waitlist_signups ins_waitlist_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_waitlist_public ON public.waitlist_signups FOR INSERT WITH CHECK (((email IS NOT NULL) AND (char_length(TRIM(BOTH FROM email)) > 3)));


--
-- Name: workflow_runs ins_workflow_runs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_workflow_runs_admin ON public.workflow_runs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: insurance_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: investor_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.investor_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: investors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

--
-- Name: ip_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: ip_audit_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_audit_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ip_funding_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_funding_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ip_model_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_model_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_attribution; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_recommendations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_recommendations ENABLE ROW LEVEL SECURITY;

--
-- Name: nhs_block_pledges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nhs_block_pledges ENABLE ROW LEVEL SECURITY;

--
-- Name: nhs_icb_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nhs_icb_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: nhs_slp_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nhs_slp_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: page_views no_direct_access_page_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY no_direct_access_page_views ON public.page_views USING (false);


--
-- Name: visitor_sessions no_direct_access_visitor_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY no_direct_access_visitor_sessions ON public.visitor_sessions USING (false);


--
-- Name: notification_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

--
-- Name: nps_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: processed_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: recommendation_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recommendation_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: roadmap_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roadmap_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: safeguarding_concerns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.safeguarding_concerns ENABLE ROW LEVEL SECURITY;

--
-- Name: seis_eis_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seis_eis_status ENABLE ROW LEVEL SECURITY;

--
-- Name: customers sel_customers_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_customers_own ON public.customers FOR SELECT USING (((( SELECT auth.uid() AS uid) = id) OR (( SELECT auth.uid() AS uid) = auth_user_id)));


--
-- Name: gdpr_requests sel_gdpr_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_gdpr_requests ON public.gdpr_requests FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))));


--
-- Name: notification_log sel_notification_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_notification_log ON public.notification_log FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))));


--
-- Name: organizations sel_organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_organizations ON public.organizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.organization_id = organizations.id))))));


--
-- Name: subscriptions sel_subscriptions_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_subscriptions_own ON public.subscriptions FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR (customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: system_error_logs sel_system_error_logs_admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_system_error_logs_admins ON public.system_error_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: telemetry_logs sel_telemetry_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_telemetry_logs ON public.telemetry_logs FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))));


--
-- Name: treatment_plans sel_treatment_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_treatment_plans ON public.treatment_plans FOR SELECT USING (((patient_user_id = ( SELECT auth.uid() AS uid)) OR (slp_user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: waitlist_signups sel_waitlist_admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_waitlist_admins ON public.waitlist_signups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: workflow_runs sel_workflow_runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_workflow_runs ON public.workflow_runs FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true))))));


--
-- Name: session_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: slp_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slp_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: slp_session_notes slp_manage_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY slp_manage_notes ON public.slp_session_notes USING ((slp_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: slp_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slp_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: slp_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slp_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: slp_assignments slp_see_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY slp_see_own ON public.slp_assignments FOR SELECT USING (((slp_user_id = ( SELECT auth.uid() AS uid)) OR (patient_user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: slp_session_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slp_session_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: social_platform_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_platform_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: social_platform_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_platform_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: social_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: social_publish_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_publish_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

--
-- Name: stage_progressions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stage_progressions ENABLE ROW LEVEL SECURITY;

--
-- Name: sub_processors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sub_processors ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: system_error_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: telemetry_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telemetry_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: tracking_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tracking_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: training_samples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_samples ENABLE ROW LEVEL SECURITY;

--
-- Name: treatment_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: gdpr_requests upd_gdpr_requests_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_gdpr_requests_admin ON public.gdpr_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: notification_log upd_notification_log_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_notification_log_admin ON public.notification_log FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: organizations upd_organizations_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_organizations_admin ON public.organizations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: treatment_plans upd_treatment_plans_slp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_treatment_plans_slp ON public.treatment_plans FOR UPDATE USING ((slp_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: workflow_runs upd_workflow_runs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_workflow_runs_admin ON public.workflow_runs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_admin = true)))));


--
-- Name: user_programme user_own_programme; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_own_programme ON public.user_programme USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: user_programme; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_programme ENABLE ROW LEVEL SECURITY;

--
-- Name: slp_messages users_own_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_messages ON public.slp_messages USING (((( SELECT auth.uid() AS uid) = from_user_id) OR (( SELECT auth.uid() AS uid) = to_user_id)));


--
-- Name: stage_progressions users_own_progressions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_progressions ON public.stage_progressions USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: valuation_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.valuation_config ENABLE ROW LEVEL SECURITY;

--
-- Name: valuation_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.valuation_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: venture_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venture_config ENABLE ROW LEVEL SECURITY;

--
-- Name: visitor_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: xero_oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xero_oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: objects No public access to data-room; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "No public access to data-room" ON storage.objects FOR SELECT USING (((bucket_id = 'data-room'::text) AND false));


--
-- Name: objects owner_insert_session_recording; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY owner_insert_session_recording ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'session-recordings'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects owner_select_session_recording; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY owner_select_session_recording ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'session-recordings'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: FUNCTION apply_gdpr_erasure(target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.apply_gdpr_erasure(target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_gdpr_erasure(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION create_default_retention_policy(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_default_retention_policy() FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_default_retention_policy() TO service_role;


--
-- Name: FUNCTION get_cron_summary(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_cron_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_cron_summary() TO service_role;


--
-- Name: FUNCTION get_db_size(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_db_size() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_db_size() TO service_role;


--
-- Name: FUNCTION get_pageview_summary(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_pageview_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_pageview_summary() TO service_role;


--
-- Name: FUNCTION get_table_sizes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_table_sizes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_table_sizes() TO service_role;


--
-- Name: FUNCTION get_user_id_by_email(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_id_by_email(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_id_by_email(p_email text) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION increment_deck_view_count(p_invite_id uuid, p_last_viewed_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_deck_view_count(p_invite_id uuid, p_last_viewed_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_deck_view_count(p_invite_id uuid, p_last_viewed_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION increment_workflow_run_count(wf_id uuid, ran_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_workflow_run_count(wf_id uuid, ran_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_workflow_run_count(wf_id uuid, ran_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION notify_slp_new_message(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_slp_new_message() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_slp_new_message() TO service_role;


--
-- Name: FUNCTION notify_slp_session_completed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_slp_session_completed() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_slp_session_completed() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION sync_profile_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_profile_email() TO service_role;


--
-- Name: FUNCTION trg_marketing_attribution_meta_capi(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trg_marketing_attribution_meta_capi() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trg_marketing_attribution_meta_capi() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE ad_platform_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ad_platform_stats TO anon;
GRANT ALL ON TABLE public.ad_platform_stats TO authenticated;
GRANT ALL ON TABLE public.ad_platform_stats TO service_role;


--
-- Name: TABLE admin_action_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_action_items TO anon;
GRANT ALL ON TABLE public.admin_action_items TO authenticated;
GRANT ALL ON TABLE public.admin_action_items TO service_role;


--
-- Name: TABLE admin_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_notifications TO anon;
GRANT ALL ON TABLE public.admin_notifications TO authenticated;
GRANT ALL ON TABLE public.admin_notifications TO service_role;


--
-- Name: TABLE affiliate_clicks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_clicks TO anon;
GRANT ALL ON TABLE public.affiliate_clicks TO authenticated;
GRANT ALL ON TABLE public.affiliate_clicks TO service_role;


--
-- Name: TABLE affiliate_commissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_commissions TO anon;
GRANT ALL ON TABLE public.affiliate_commissions TO authenticated;
GRANT ALL ON TABLE public.affiliate_commissions TO service_role;


--
-- Name: TABLE affiliate_conversions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_conversions TO anon;
GRANT ALL ON TABLE public.affiliate_conversions TO authenticated;
GRANT ALL ON TABLE public.affiliate_conversions TO service_role;


--
-- Name: TABLE affiliate_payouts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_payouts TO anon;
GRANT ALL ON TABLE public.affiliate_payouts TO authenticated;
GRANT ALL ON TABLE public.affiliate_payouts TO service_role;


--
-- Name: TABLE affiliates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliates TO anon;
GRANT ALL ON TABLE public.affiliates TO authenticated;
GRANT ALL ON TABLE public.affiliates TO service_role;


--
-- Name: TABLE ai_drafts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_drafts TO anon;
GRANT ALL ON TABLE public.ai_drafts TO authenticated;
GRANT ALL ON TABLE public.ai_drafts TO service_role;


--
-- Name: TABLE alert_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alert_history TO anon;
GRANT ALL ON TABLE public.alert_history TO authenticated;
GRANT ALL ON TABLE public.alert_history TO service_role;


--
-- Name: TABLE alert_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.alert_rules TO anon;
GRANT ALL ON TABLE public.alert_rules TO authenticated;
GRANT ALL ON TABLE public.alert_rules TO service_role;


--
-- Name: TABLE anonymized_telemetry_features; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.anonymized_telemetry_features TO anon;
GRANT ALL ON TABLE public.anonymized_telemetry_features TO authenticated;
GRANT ALL ON TABLE public.anonymized_telemetry_features TO service_role;


--
-- Name: TABLE api_keys; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.api_keys TO anon;
GRANT ALL ON TABLE public.api_keys TO authenticated;
GRANT ALL ON TABLE public.api_keys TO service_role;


--
-- Name: TABLE app_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_config TO anon;
GRANT ALL ON TABLE public.app_config TO authenticated;
GRANT ALL ON TABLE public.app_config TO service_role;


--
-- Name: TABLE asset_files; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.asset_files TO anon;
GRANT ALL ON TABLE public.asset_files TO authenticated;
GRANT ALL ON TABLE public.asset_files TO service_role;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_log TO anon;
GRANT ALL ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE backup_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.backup_log TO anon;
GRANT ALL ON TABLE public.backup_log TO authenticated;
GRANT ALL ON TABLE public.backup_log TO service_role;


--
-- Name: TABLE bookkeeping_drafts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bookkeeping_drafts TO anon;
GRANT ALL ON TABLE public.bookkeeping_drafts TO authenticated;
GRANT ALL ON TABLE public.bookkeeping_drafts TO service_role;


--
-- Name: TABLE cal_bookings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cal_bookings TO anon;
GRANT ALL ON TABLE public.cal_bookings TO authenticated;
GRANT ALL ON TABLE public.cal_bookings TO service_role;


--
-- Name: TABLE campaign_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.campaign_contacts TO anon;
GRANT ALL ON TABLE public.campaign_contacts TO authenticated;
GRANT ALL ON TABLE public.campaign_contacts TO service_role;


--
-- Name: TABLE campaign_milestones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.campaign_milestones TO anon;
GRANT ALL ON TABLE public.campaign_milestones TO authenticated;
GRANT ALL ON TABLE public.campaign_milestones TO service_role;


--
-- Name: TABLE campaign_press_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.campaign_press_links TO anon;
GRANT ALL ON TABLE public.campaign_press_links TO authenticated;
GRANT ALL ON TABLE public.campaign_press_links TO service_role;


--
-- Name: TABLE cap_table_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cap_table_entries TO anon;
GRANT ALL ON TABLE public.cap_table_entries TO authenticated;
GRANT ALL ON TABLE public.cap_table_entries TO service_role;


--
-- Name: TABLE company_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_records TO anon;
GRANT ALL ON TABLE public.company_records TO authenticated;
GRANT ALL ON TABLE public.company_records TO service_role;


--
-- Name: TABLE compliance_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.compliance_items TO anon;
GRANT ALL ON TABLE public.compliance_items TO authenticated;
GRANT ALL ON TABLE public.compliance_items TO service_role;


--
-- Name: TABLE consent_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consent_audit_log TO anon;
GRANT ALL ON TABLE public.consent_audit_log TO authenticated;
GRANT ALL ON TABLE public.consent_audit_log TO service_role;


--
-- Name: TABLE consent_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consent_records TO anon;
GRANT ALL ON TABLE public.consent_records TO authenticated;
GRANT ALL ON TABLE public.consent_records TO service_role;


--
-- Name: TABLE consistency_checks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consistency_checks TO anon;
GRANT ALL ON TABLE public.consistency_checks TO authenticated;
GRANT ALL ON TABLE public.consistency_checks TO service_role;


--
-- Name: TABLE conversion_milestones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversion_milestones TO anon;
GRANT ALL ON TABLE public.conversion_milestones TO authenticated;
GRANT ALL ON TABLE public.conversion_milestones TO service_role;


--
-- Name: TABLE crm_activities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.crm_activities TO anon;
GRANT ALL ON TABLE public.crm_activities TO authenticated;
GRANT ALL ON TABLE public.crm_activities TO service_role;


--
-- Name: TABLE crm_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.crm_contacts TO anon;
GRANT ALL ON TABLE public.crm_contacts TO authenticated;
GRANT ALL ON TABLE public.crm_contacts TO service_role;


--
-- Name: TABLE cron_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cron_runs TO anon;
GRANT ALL ON TABLE public.cron_runs TO authenticated;
GRANT ALL ON TABLE public.cron_runs TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE data_retention_policies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_retention_policies TO anon;
GRANT ALL ON TABLE public.data_retention_policies TO authenticated;
GRANT ALL ON TABLE public.data_retention_policies TO service_role;


--
-- Name: TABLE data_room_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_room_documents TO anon;
GRANT ALL ON TABLE public.data_room_documents TO authenticated;
GRANT ALL ON TABLE public.data_room_documents TO service_role;


--
-- Name: TABLE data_room_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_room_invites TO anon;
GRANT ALL ON TABLE public.data_room_invites TO authenticated;
GRANT ALL ON TABLE public.data_room_invites TO service_role;


--
-- Name: TABLE deck_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.deck_invites TO anon;
GRANT ALL ON TABLE public.deck_invites TO authenticated;
GRANT ALL ON TABLE public.deck_invites TO service_role;


--
-- Name: TABLE deck_views; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.deck_views TO anon;
GRANT ALL ON TABLE public.deck_views TO authenticated;
GRANT ALL ON TABLE public.deck_views TO service_role;


--
-- Name: TABLE deploy_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.deploy_log TO anon;
GRANT ALL ON TABLE public.deploy_log TO authenticated;
GRANT ALL ON TABLE public.deploy_log TO service_role;


--
-- Name: TABLE explee_analytics_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_analytics_snapshots TO anon;
GRANT ALL ON TABLE public.explee_analytics_snapshots TO authenticated;
GRANT ALL ON TABLE public.explee_analytics_snapshots TO service_role;


--
-- Name: TABLE explee_campaign_imports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_campaign_imports TO anon;
GRANT ALL ON TABLE public.explee_campaign_imports TO authenticated;
GRANT ALL ON TABLE public.explee_campaign_imports TO service_role;


--
-- Name: TABLE explee_campaigns; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_campaigns TO anon;
GRANT ALL ON TABLE public.explee_campaigns TO authenticated;
GRANT ALL ON TABLE public.explee_campaigns TO service_role;


--
-- Name: TABLE explee_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_contacts TO anon;
GRANT ALL ON TABLE public.explee_contacts TO authenticated;
GRANT ALL ON TABLE public.explee_contacts TO service_role;


--
-- Name: TABLE explee_dedup_lists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_dedup_lists TO anon;
GRANT ALL ON TABLE public.explee_dedup_lists TO authenticated;
GRANT ALL ON TABLE public.explee_dedup_lists TO service_role;


--
-- Name: TABLE explee_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_messages TO anon;
GRANT ALL ON TABLE public.explee_messages TO authenticated;
GRANT ALL ON TABLE public.explee_messages TO service_role;


--
-- Name: TABLE explee_prospects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_prospects TO anon;
GRANT ALL ON TABLE public.explee_prospects TO authenticated;
GRANT ALL ON TABLE public.explee_prospects TO service_role;


--
-- Name: TABLE explee_searches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.explee_searches TO anon;
GRANT ALL ON TABLE public.explee_searches TO authenticated;
GRANT ALL ON TABLE public.explee_searches TO service_role;


--
-- Name: TABLE feature_flags; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.feature_flags TO anon;
GRANT ALL ON TABLE public.feature_flags TO authenticated;
GRANT ALL ON TABLE public.feature_flags TO service_role;


--
-- Name: TABLE feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.feedback TO anon;
GRANT ALL ON TABLE public.feedback TO authenticated;
GRANT ALL ON TABLE public.feedback TO service_role;


--
-- Name: TABLE gdpr_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gdpr_requests TO anon;
GRANT ALL ON TABLE public.gdpr_requests TO authenticated;
GRANT ALL ON TABLE public.gdpr_requests TO service_role;


--
-- Name: TABLE gmail_oauth_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gmail_oauth_tokens TO anon;
GRANT ALL ON TABLE public.gmail_oauth_tokens TO authenticated;
GRANT ALL ON TABLE public.gmail_oauth_tokens TO service_role;


--
-- Name: TABLE google_analytics_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.google_analytics_stats TO anon;
GRANT ALL ON TABLE public.google_analytics_stats TO authenticated;
GRANT ALL ON TABLE public.google_analytics_stats TO service_role;


--
-- Name: TABLE grants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.grants TO anon;
GRANT ALL ON TABLE public.grants TO authenticated;
GRANT ALL ON TABLE public.grants TO service_role;


--
-- Name: TABLE handoff_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.handoff_notes TO anon;
GRANT ALL ON TABLE public.handoff_notes TO authenticated;
GRANT ALL ON TABLE public.handoff_notes TO service_role;


--
-- Name: TABLE hazard_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hazard_log TO anon;
GRANT ALL ON TABLE public.hazard_log TO authenticated;
GRANT ALL ON TABLE public.hazard_log TO service_role;


--
-- Name: TABLE inbox_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inbox_items TO anon;
GRANT ALL ON TABLE public.inbox_items TO authenticated;
GRANT ALL ON TABLE public.inbox_items TO service_role;


--
-- Name: TABLE insurance_policies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.insurance_policies TO anon;
GRANT ALL ON TABLE public.insurance_policies TO authenticated;
GRANT ALL ON TABLE public.insurance_policies TO service_role;


--
-- Name: TABLE investor_updates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.investor_updates TO anon;
GRANT ALL ON TABLE public.investor_updates TO authenticated;
GRANT ALL ON TABLE public.investor_updates TO service_role;


--
-- Name: TABLE investors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.investors TO anon;
GRANT ALL ON TABLE public.investors TO authenticated;
GRANT ALL ON TABLE public.investors TO service_role;


--
-- Name: TABLE ip_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ip_assets TO anon;
GRANT ALL ON TABLE public.ip_assets TO authenticated;
GRANT ALL ON TABLE public.ip_assets TO service_role;


--
-- Name: TABLE ip_audit_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ip_audit_items TO anon;
GRANT ALL ON TABLE public.ip_audit_items TO authenticated;
GRANT ALL ON TABLE public.ip_audit_items TO service_role;


--
-- Name: TABLE ip_funding_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ip_funding_items TO anon;
GRANT ALL ON TABLE public.ip_funding_items TO authenticated;
GRANT ALL ON TABLE public.ip_funding_items TO service_role;


--
-- Name: TABLE ip_model_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ip_model_versions TO anon;
GRANT ALL ON TABLE public.ip_model_versions TO authenticated;
GRANT ALL ON TABLE public.ip_model_versions TO service_role;


--
-- Name: TABLE marketing_attribution; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.marketing_attribution TO anon;
GRANT ALL ON TABLE public.marketing_attribution TO authenticated;
GRANT ALL ON TABLE public.marketing_attribution TO service_role;


--
-- Name: TABLE marketing_recommendations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.marketing_recommendations TO anon;
GRANT ALL ON TABLE public.marketing_recommendations TO authenticated;
GRANT ALL ON TABLE public.marketing_recommendations TO service_role;


--
-- Name: TABLE nhs_block_pledges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.nhs_block_pledges TO anon;
GRANT ALL ON TABLE public.nhs_block_pledges TO authenticated;
GRANT ALL ON TABLE public.nhs_block_pledges TO service_role;


--
-- Name: TABLE nhs_icb_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.nhs_icb_contacts TO anon;
GRANT ALL ON TABLE public.nhs_icb_contacts TO authenticated;
GRANT ALL ON TABLE public.nhs_icb_contacts TO service_role;


--
-- Name: TABLE nhs_slp_signups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.nhs_slp_signups TO anon;
GRANT ALL ON TABLE public.nhs_slp_signups TO authenticated;
GRANT ALL ON TABLE public.nhs_slp_signups TO service_role;


--
-- Name: TABLE notification_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_log TO anon;
GRANT ALL ON TABLE public.notification_log TO authenticated;
GRANT ALL ON TABLE public.notification_log TO service_role;


--
-- Name: TABLE nps_responses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.nps_responses TO anon;
GRANT ALL ON TABLE public.nps_responses TO authenticated;
GRANT ALL ON TABLE public.nps_responses TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: TABLE page_views; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.page_views TO anon;
GRANT ALL ON TABLE public.page_views TO authenticated;
GRANT ALL ON TABLE public.page_views TO service_role;


--
-- Name: TABLE practice_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.practice_sessions TO anon;
GRANT ALL ON TABLE public.practice_sessions TO authenticated;
GRANT ALL ON TABLE public.practice_sessions TO service_role;


--
-- Name: TABLE processed_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.processed_webhook_events TO anon;
GRANT ALL ON TABLE public.processed_webhook_events TO authenticated;
GRANT ALL ON TABLE public.processed_webhook_events TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE recommendation_actions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recommendation_actions TO anon;
GRANT ALL ON TABLE public.recommendation_actions TO authenticated;
GRANT ALL ON TABLE public.recommendation_actions TO service_role;


--
-- Name: TABLE roadmap_milestones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roadmap_milestones TO anon;
GRANT ALL ON TABLE public.roadmap_milestones TO authenticated;
GRANT ALL ON TABLE public.roadmap_milestones TO service_role;


--
-- Name: TABLE safeguarding_concerns; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.safeguarding_concerns TO anon;
GRANT ALL ON TABLE public.safeguarding_concerns TO authenticated;
GRANT ALL ON TABLE public.safeguarding_concerns TO service_role;


--
-- Name: TABLE seis_eis_status; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.seis_eis_status TO anon;
GRANT ALL ON TABLE public.seis_eis_status TO authenticated;
GRANT ALL ON TABLE public.seis_eis_status TO service_role;


--
-- Name: TABLE session_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_snapshots TO anon;
GRANT ALL ON TABLE public.session_snapshots TO authenticated;
GRANT ALL ON TABLE public.session_snapshots TO service_role;


--
-- Name: TABLE slp_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.slp_assignments TO anon;
GRANT ALL ON TABLE public.slp_assignments TO authenticated;
GRANT ALL ON TABLE public.slp_assignments TO service_role;


--
-- Name: TABLE slp_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.slp_messages TO anon;
GRANT ALL ON TABLE public.slp_messages TO authenticated;
GRANT ALL ON TABLE public.slp_messages TO service_role;


--
-- Name: TABLE slp_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.slp_notifications TO anon;
GRANT ALL ON TABLE public.slp_notifications TO authenticated;
GRANT ALL ON TABLE public.slp_notifications TO service_role;


--
-- Name: TABLE slp_session_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.slp_session_notes TO anon;
GRANT ALL ON TABLE public.slp_session_notes TO authenticated;
GRANT ALL ON TABLE public.slp_session_notes TO service_role;


--
-- Name: TABLE social_platform_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_platform_stats TO anon;
GRANT ALL ON TABLE public.social_platform_stats TO authenticated;
GRANT ALL ON TABLE public.social_platform_stats TO service_role;


--
-- Name: TABLE social_platform_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_platform_tokens TO anon;
GRANT ALL ON TABLE public.social_platform_tokens TO authenticated;
GRANT ALL ON TABLE public.social_platform_tokens TO service_role;


--
-- Name: TABLE social_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_posts TO anon;
GRANT ALL ON TABLE public.social_posts TO authenticated;
GRANT ALL ON TABLE public.social_posts TO service_role;


--
-- Name: TABLE social_publish_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_publish_queue TO anon;
GRANT ALL ON TABLE public.social_publish_queue TO authenticated;
GRANT ALL ON TABLE public.social_publish_queue TO service_role;


--
-- Name: TABLE staff_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff_invites TO anon;
GRANT ALL ON TABLE public.staff_invites TO authenticated;
GRANT ALL ON TABLE public.staff_invites TO service_role;


--
-- Name: TABLE staff_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff_members TO anon;
GRANT ALL ON TABLE public.staff_members TO authenticated;
GRANT ALL ON TABLE public.staff_members TO service_role;


--
-- Name: TABLE stage_progressions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stage_progressions TO anon;
GRANT ALL ON TABLE public.stage_progressions TO authenticated;
GRANT ALL ON TABLE public.stage_progressions TO service_role;


--
-- Name: TABLE sub_processors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sub_processors TO anon;
GRANT ALL ON TABLE public.sub_processors TO authenticated;
GRANT ALL ON TABLE public.sub_processors TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE support_tickets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.support_tickets TO anon;
GRANT ALL ON TABLE public.support_tickets TO authenticated;
GRANT ALL ON TABLE public.support_tickets TO service_role;


--
-- Name: TABLE system_error_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_error_logs TO anon;
GRANT ALL ON TABLE public.system_error_logs TO authenticated;
GRANT ALL ON TABLE public.system_error_logs TO service_role;


--
-- Name: TABLE telemetry_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telemetry_logs TO anon;
GRANT ALL ON TABLE public.telemetry_logs TO authenticated;
GRANT ALL ON TABLE public.telemetry_logs TO service_role;


--
-- Name: TABLE ticket_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ticket_messages TO anon;
GRANT ALL ON TABLE public.ticket_messages TO authenticated;
GRANT ALL ON TABLE public.ticket_messages TO service_role;


--
-- Name: TABLE tracking_providers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tracking_providers TO anon;
GRANT ALL ON TABLE public.tracking_providers TO authenticated;
GRANT ALL ON TABLE public.tracking_providers TO service_role;


--
-- Name: TABLE training_samples; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.training_samples TO anon;
GRANT ALL ON TABLE public.training_samples TO authenticated;
GRANT ALL ON TABLE public.training_samples TO service_role;


--
-- Name: TABLE treatment_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.treatment_plans TO anon;
GRANT ALL ON TABLE public.treatment_plans TO authenticated;
GRANT ALL ON TABLE public.treatment_plans TO service_role;


--
-- Name: TABLE user_programme; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_programme TO anon;
GRANT ALL ON TABLE public.user_programme TO authenticated;
GRANT ALL ON TABLE public.user_programme TO service_role;


--
-- Name: TABLE valuation_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.valuation_config TO anon;
GRANT ALL ON TABLE public.valuation_config TO authenticated;
GRANT ALL ON TABLE public.valuation_config TO service_role;


--
-- Name: TABLE valuation_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.valuation_snapshots TO anon;
GRANT ALL ON TABLE public.valuation_snapshots TO authenticated;
GRANT ALL ON TABLE public.valuation_snapshots TO service_role;


--
-- Name: TABLE vendor_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vendor_invoices TO anon;
GRANT ALL ON TABLE public.vendor_invoices TO authenticated;
GRANT ALL ON TABLE public.vendor_invoices TO service_role;


--
-- Name: TABLE venture_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.venture_config TO anon;
GRANT ALL ON TABLE public.venture_config TO authenticated;
GRANT ALL ON TABLE public.venture_config TO service_role;


--
-- Name: TABLE visitor_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.visitor_sessions TO anon;
GRANT ALL ON TABLE public.visitor_sessions TO authenticated;
GRANT ALL ON TABLE public.visitor_sessions TO service_role;


--
-- Name: TABLE waitlist_signups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.waitlist_signups TO anon;
GRANT ALL ON TABLE public.waitlist_signups TO authenticated;
GRANT ALL ON TABLE public.waitlist_signups TO service_role;


--
-- Name: TABLE workflow_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workflow_definitions TO anon;
GRANT ALL ON TABLE public.workflow_definitions TO authenticated;
GRANT ALL ON TABLE public.workflow_definitions TO service_role;


--
-- Name: TABLE workflow_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workflow_runs TO anon;
GRANT ALL ON TABLE public.workflow_runs TO authenticated;
GRANT ALL ON TABLE public.workflow_runs TO service_role;


--
-- Name: TABLE xero_oauth_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.xero_oauth_tokens TO anon;
GRANT ALL ON TABLE public.xero_oauth_tokens TO authenticated;
GRANT ALL ON TABLE public.xero_oauth_tokens TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;



$ddl$;
END;
$baseline$;
