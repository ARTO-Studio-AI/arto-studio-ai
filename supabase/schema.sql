-- supabase/schema.sql
-- Esquema de producción de ARTO Studio AI (Supabase, schema public), solo estructura, sin datos.
-- Generado el 2026-09-11 desde el Mac Mini con:
--   pg_dump --schema-only --no-owner --no-privileges --schema=public "$DATABASE_URL"
--   (pg_dump 18.6 de brew libpq; DATABASE_URL de producción vía vercel env pull, nunca impresa)
-- Se regenera con el mismo comando después de cada migración aplicada. No editar a mano.

--
-- PostgreSQL database dump
--

\restrict jhBUj0N4iGmHh3O99MkU9SeeBgLbLvughO4R8jm0oGjrKjLL7RS4K7f8FVLlgCQ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
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

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: apply_grant_retro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_grant_retro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
     SET tier = NEW.tier,
         is_admin = NEW.is_admin,
         updated_at = NOW()
   WHERE email = NEW.email;
  RETURN NEW;
END;
$$;


--
-- Name: bump_rate_limit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_rate_limit(rl_key text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  win TIMESTAMPTZ := date_trunc('hour', now());
  new_count INT;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (rl_key, win, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  granted_tier TEXT;
  granted_admin BOOLEAN;
BEGIN
  SELECT tier, is_admin INTO granted_tier, granted_admin
  FROM public.email_tier_grants
  WHERE email = NEW.email;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, tier, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(granted_tier, 'free'),
    COALESCE(granted_admin, FALSE)
  );
  RETURN NEW;
END;
$$;


--
-- Name: increment_prompt_copy(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_prompt_copy(prompt_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.prompts SET copy_count = copy_count + 1 WHERE id = prompt_id;
END;
$$;


--
-- Name: increment_prompt_view(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_prompt_view(prompt_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.prompts SET view_count = view_count + 1 WHERE id = prompt_id;
END;
$$;


--
-- Name: match_prompts(public.vector, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_prompts(query_embedding public.vector, match_count integer DEFAULT 20) RETURNS TABLE(id text, title_en text, title_es text, category text, subcategory text, ai_model text, difficulty text, tier text, use_case text, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    p.id, p.title_en, p.title_es, p.category, p.subcategory,
    p.ai_model, p.difficulty, p.tier, p.use_case,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.prompts p
  WHERE p.is_published = TRUE AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompts (
    id text NOT NULL,
    title_en text NOT NULL,
    title_es text NOT NULL,
    prompt_en text NOT NULL,
    prompt_es text NOT NULL,
    category text NOT NULL,
    subcategory text NOT NULL,
    ai_model text NOT NULL,
    difficulty text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    tier text DEFAULT 'free'::text NOT NULL,
    version text DEFAULT '1.0'::text NOT NULL,
    author text DEFAULT 'ARTO Studio AI'::text NOT NULL,
    use_case text,
    expected_output text,
    view_count integer DEFAULT 0,
    copy_count integer DEFAULT 0,
    favorite_count integer DEFAULT 0,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fts_en tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((COALESCE(title_en, ''::text) || ' '::text) || COALESCE(prompt_en, ''::text)) || ' '::text) || COALESCE(use_case, ''::text)))) STORED,
    fts_es tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, ((((COALESCE(title_es, ''::text) || ' '::text) || COALESCE(prompt_es, ''::text)) || ' '::text) || COALESCE(use_case, ''::text)))) STORED,
    embedding public.vector(1536),
    is_featured boolean DEFAULT false NOT NULL,
    featured_at timestamp with time zone,
    featured_reason text,
    CONSTRAINT prompts_difficulty_check CHECK ((difficulty = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text]))),
    CONSTRAINT prompts_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])))
);


--
-- Name: search_prompts(text, text, text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_prompts(search_query text, search_lang text DEFAULT 'en'::text, filter_category text DEFAULT NULL::text, filter_difficulty text DEFAULT NULL::text, filter_tier text DEFAULT NULL::text, result_limit integer DEFAULT 20, result_offset integer DEFAULT 0) RETURNS SETOF public.prompts
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public.prompts p
  WHERE p.is_published = TRUE
    AND (filter_category IS NULL OR p.category = filter_category)
    AND (filter_difficulty IS NULL OR p.difficulty = filter_difficulty)
    AND (filter_tier IS NULL OR p.tier = filter_tier)
    AND (
      search_query IS NULL
      OR (search_lang = 'en' AND p.fts_en @@ plainto_tsquery('english', search_query))
      OR (search_lang = 'es' AND p.fts_es @@ plainto_tsquery('spanish', search_query))
    )
  ORDER BY
    CASE
      WHEN search_query IS NOT NULL AND search_lang = 'en'
        THEN ts_rank(p.fts_en, plainto_tsquery('english', search_query))
      WHEN search_query IS NOT NULL AND search_lang = 'es'
        THEN ts_rank(p.fts_es, plainto_tsquery('spanish', search_query))
      ELSE 0
    END DESC,
    p.view_count DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;


--
-- Name: user_can_access_pro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_access_pro(user_uuid uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_tier TEXT;
  sub_status TEXT;
BEGIN
  SELECT tier, subscription_status INTO user_tier, sub_status
  FROM public.profiles WHERE id = user_uuid;
  RETURN (user_tier IN ('pro', 'lifetime') AND sub_status = 'active')
    OR user_tier = 'lifetime';
END;
$$;


--
-- Name: _engine_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._engine_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now(),
    checksum text
);


--
-- Name: _migrations_applied; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations_applied (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_social_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_social_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_date date NOT NULL,
    prompt_id text,
    platform text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    post_content text NOT NULL,
    buffer_post_id text,
    status text DEFAULT 'draft'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT agent_social_log_language_check CHECK ((language = ANY (ARRAY['en'::text, 'es'::text]))),
    CONSTRAINT agent_social_log_platform_check CHECK ((platform = ANY (ARRAY['twitter'::text, 'linkedin'::text, 'threads'::text]))),
    CONSTRAINT agent_social_log_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: attribution_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribution_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    source text,
    source_detail text,
    target_id uuid,
    user_email text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    value_usd double precision,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attribution_events_event_type_check CHECK ((event_type = ANY (ARRAY['signup'::text, 'trial_start'::text, 'first_search'::text, 'first_skill_run'::text, 'conversion'::text, 'churn'::text, 'reactivation'::text])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    api_key_hash text NOT NULL,
    api_key_prefix text NOT NULL,
    tier text DEFAULT 'trial'::text NOT NULL,
    allowed_skills jsonb DEFAULT '["*"]'::jsonb NOT NULL,
    rate_limit_per_hour integer DEFAULT 100 NOT NULL,
    trial_calls_limit integer,
    trial_calls_used integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    prompt_ids text[] DEFAULT '{}'::text[],
    is_public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: content_gaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_gaps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    query_pattern text NOT NULL,
    frequency integer DEFAULT 1 NOT NULL,
    avg_similarity double precision,
    suggested_vertical text,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_by_prompt_id text,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    CONSTRAINT content_gaps_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: content_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    channel text,
    status text DEFAULT 'draft'::text NOT NULL,
    language text NOT NULL,
    payload jsonb NOT NULL,
    source_signal_id uuid,
    published_ref text,
    edited_by_human boolean DEFAULT false NOT NULL,
    cost_usd numeric(10,6),
    scheduled_for timestamp with time zone,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_items_language_check CHECK ((language = ANY (ARRAY['en'::text, 'es'::text]))),
    CONSTRAINT content_items_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'published'::text, 'skipped'::text]))),
    CONSTRAINT content_items_type_check CHECK ((type = ANY (ARRAY['prompt'::text, 'blog_post'::text, 'social_post'::text, 'newsletter'::text])))
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    title_en text NOT NULL,
    title_es text NOT NULL,
    description_en text,
    description_es text,
    category text NOT NULL,
    difficulty text NOT NULL,
    tier text DEFAULT 'free'::text NOT NULL,
    prompt_ids text[] DEFAULT '{}'::text[] NOT NULL,
    lesson_count integer DEFAULT 0,
    estimated_minutes integer,
    video_url text,
    thumbnail_url text,
    is_published boolean DEFAULT false,
    enrollment_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT courses_difficulty_check CHECK ((difficulty = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))),
    CONSTRAINT courses_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text])))
);


--
-- Name: email_tier_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_tier_grants (
    email text NOT NULL,
    tier text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_tier_grants_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])))
);


--
-- Name: engine_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engine_config (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text
);


--
-- Name: engine_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engine_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    run_type text DEFAULT 'scheduled'::text NOT NULL,
    status text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    items_processed integer DEFAULT 0,
    items_succeeded integer DEFAULT 0,
    items_failed integer DEFAULT 0,
    cost_usd double precision DEFAULT 0,
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    duration_ms integer,
    error_message text,
    session_id text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT engine_runs_module_check CHECK ((module = ANY (ARRAY['social'::text, 'outreach'::text, 'content'::text, 'intelligence'::text, 'scraper'::text, 'prompt_queue'::text]))),
    CONSTRAINT engine_runs_run_type_check CHECK ((run_type = ANY (ARRAY['scheduled'::text, 'manual'::text, 'triggered'::text, 'dry_run'::text]))),
    CONSTRAINT engine_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'failed'::text, 'paused'::text])))
);


--
-- Name: engine_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engine_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    signal_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    module text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    message text,
    active boolean DEFAULT true,
    snoozed_until timestamp with time zone,
    escalated_at timestamp with time zone,
    resolved_at timestamp with time zone,
    resolved_by text,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT engine_signals_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]))),
    CONSTRAINT engine_signals_signal_type_check CHECK ((signal_type = ANY (ARRAY['trending_vertical'::text, 'social_insight'::text, 'growth_anomaly'::text, 'churn_risk'::text, 'bounce_alert'::text, 'complaint_alert'::text, 'scrape_blocked'::text, 'budget_warning'::text, 'qc_reject_spike'::text, 'conversion_dip'::text, 'manual_pause'::text, 'module_error'::text])))
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    prompt_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscribers (
    email text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    source text DEFAULT 'unknown'::text NOT NULL,
    unsubscribe_token text DEFAULT encode(extensions.gen_random_bytes(24), 'base64'::text) NOT NULL,
    subscribed_at timestamp with time zone DEFAULT now(),
    last_sent_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    user_id uuid,
    CONSTRAINT newsletter_subscribers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'unsubscribed'::text, 'bounced'::text, 'pending'::text])))
);


--
-- Name: outreach_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_id uuid NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    language text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    edited_by_human boolean DEFAULT false NOT NULL,
    cost_usd numeric(10,6),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT outreach_drafts_language_check CHECK ((language = ANY (ARRAY['en'::text, 'es'::text]))),
    CONSTRAINT outreach_drafts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'sent'::text, 'skipped'::text])))
);


--
-- Name: outreach_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_id uuid NOT NULL,
    email_type text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    language text NOT NULL,
    resend_id text,
    opened boolean DEFAULT false,
    clicked boolean DEFAULT false,
    bounced boolean DEFAULT false,
    complained boolean DEFAULT false,
    replied boolean DEFAULT false,
    sent_at timestamp with time zone DEFAULT now(),
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    bounced_at timestamp with time zone,
    complained_at timestamp with time zone,
    replied_at timestamp with time zone,
    CONSTRAINT outreach_log_email_type_check CHECK ((email_type = ANY (ARRAY['initial'::text, 'followup'::text]))),
    CONSTRAINT outreach_log_language_check CHECK ((language = ANY (ARRAY['en'::text, 'es'::text])))
);


--
-- Name: outreach_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    name text,
    company text,
    vertical text,
    country text,
    language text DEFAULT 'en'::text,
    source text NOT NULL,
    profile_url text,
    legitimate_interest_score double precision,
    legitimate_interest_reasoning text,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    qualified_at timestamp with time zone,
    last_contacted_at timestamp with time zone,
    include_in_send boolean DEFAULT true NOT NULL,
    CONSTRAINT outreach_targets_language_check CHECK ((language = ANY (ARRAY['en'::text, 'es'::text]))),
    CONSTRAINT outreach_targets_source_check CHECK ((source = ANY (ARRAY['atlas'::text, 'signup'::text, 'power_user'::text, 'gap_lead'::text, 'scraped_behance'::text, 'scraped_dribbble'::text, 'scraped_linkedin'::text, 'scraped_producthunt'::text, 'scraped_creativemarket'::text, 'scraped_domestika'::text, 'scraped_twitter'::text, 'scraped_other'::text]))),
    CONSTRAINT outreach_targets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'qualified'::text, 'rejected'::text, 'contacted'::text, 'converted'::text, 'unsubscribed'::text, 'exhausted'::text, 'bounced'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    tier text DEFAULT 'free'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'inactive'::text,
    subscription_ends_at timestamp with time zone,
    prompts_viewed_today integer DEFAULT 0,
    daily_view_reset_at date DEFAULT CURRENT_DATE,
    preferred_language text DEFAULT 'en'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_admin boolean DEFAULT false NOT NULL,
    CONSTRAINT profiles_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['en'::text, 'es'::text]))),
    CONSTRAINT profiles_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'inactive'::text, 'canceled'::text, 'past_due'::text]))),
    CONSTRAINT profiles_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])))
);


--
-- Name: prompt_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompt_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idea text NOT NULL,
    vertical text,
    language text DEFAULT 'both'::text,
    quantity integer DEFAULT 5,
    status text DEFAULT 'pending'::text,
    prompts_generated integer DEFAULT 0,
    generated_prompt_ids text[],
    error_message text,
    submitted_by text DEFAULT 'victor'::text,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    CONSTRAINT prompt_queue_language_check CHECK ((language = ANY (ARRAY['en'::text, 'es'::text, 'both'::text]))),
    CONSTRAINT prompt_queue_quantity_check CHECK (((quantity >= 1) AND (quantity <= 20))),
    CONSTRAINT prompt_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'generating'::text, 'done'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    stripe_payment_intent_id text,
    stripe_invoice_id text,
    product_type text NOT NULL,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchases_product_type_check CHECK ((product_type = ANY (ARRAY['subscription_pro'::text, 'subscription_lifetime'::text, 'course_single'::text]))),
    CONSTRAINT purchases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'refunded'::text, 'failed'::text])))
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    count integer DEFAULT 1 NOT NULL
);


--
-- Name: roast_traces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roast_traces (
    id integer NOT NULL,
    brand_name text NOT NULL,
    industry text NOT NULL,
    company_size text,
    website_url text,
    description text,
    overall_score real NOT NULL,
    strategy_score real NOT NULL,
    creativity_score real NOT NULL,
    narrative_score real NOT NULL,
    digital_score real NOT NULL,
    strategy_roast text NOT NULL,
    creativity_roast text NOT NULL,
    narrative_roast text NOT NULL,
    digital_roast text NOT NULL,
    verdict text NOT NULL,
    improvements jsonb DEFAULT '[]'::jsonb NOT NULL,
    source text DEFAULT 'fallback'::text NOT NULL,
    model text DEFAULT 'none'::text NOT NULL,
    latency_ms integer DEFAULT 0 NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roast_traces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roast_traces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roast_traces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roast_traces_id_seq OWNED BY public.roast_traces.id;


--
-- Name: scraping_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraping_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    url text,
    enabled boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: search_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_queries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    query text NOT NULL,
    query_lang text,
    results_count integer DEFAULT 0,
    top_result_id text,
    top_similarity double precision,
    llm_recommended_ids text[] DEFAULT '{}'::text[],
    llm_explanation text,
    user_tier text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: skill_traces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_traces (
    id integer NOT NULL,
    skill_slug text NOT NULL,
    client_id text,
    input jsonb NOT NULL,
    output jsonb NOT NULL,
    source text DEFAULT 'fallback'::text NOT NULL,
    model text DEFAULT 'none'::text NOT NULL,
    latency_ms integer DEFAULT 0 NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: skill_traces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.skill_traces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: skill_traces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.skill_traces_id_seq OWNED BY public.skill_traces.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    session_token text,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    prompts_viewed text[] DEFAULT '{}'::text[],
    prompts_copied text[] DEFAULT '{}'::text[],
    pages_visited text[] DEFAULT '{}'::text[],
    device_type text,
    country_code text
);


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist (
    id integer NOT NULL,
    email text NOT NULL,
    source text DEFAULT 'landing'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: waitlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.waitlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waitlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.waitlist_id_seq OWNED BY public.waitlist.id;


--
-- Name: roast_traces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roast_traces ALTER COLUMN id SET DEFAULT nextval('public.roast_traces_id_seq'::regclass);


--
-- Name: skill_traces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_traces ALTER COLUMN id SET DEFAULT nextval('public.skill_traces_id_seq'::regclass);


--
-- Name: waitlist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist ALTER COLUMN id SET DEFAULT nextval('public.waitlist_id_seq'::regclass);


--
-- Name: _engine_migrations _engine_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._engine_migrations
    ADD CONSTRAINT _engine_migrations_pkey PRIMARY KEY (filename);


--
-- Name: _migrations_applied _migrations_applied_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations_applied
    ADD CONSTRAINT _migrations_applied_pkey PRIMARY KEY (name);


--
-- Name: agent_social_log agent_social_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_social_log
    ADD CONSTRAINT agent_social_log_pkey PRIMARY KEY (id);


--
-- Name: attribution_events attribution_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribution_events
    ADD CONSTRAINT attribution_events_pkey PRIMARY KEY (id);


--
-- Name: clients clients_api_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_api_key_hash_key UNIQUE (api_key_hash);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: content_gaps content_gaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_gaps
    ADD CONSTRAINT content_gaps_pkey PRIMARY KEY (id);


--
-- Name: content_items content_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: courses courses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_slug_key UNIQUE (slug);


--
-- Name: email_tier_grants email_tier_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_tier_grants
    ADD CONSTRAINT email_tier_grants_pkey PRIMARY KEY (email);


--
-- Name: engine_config engine_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engine_config
    ADD CONSTRAINT engine_config_pkey PRIMARY KEY (key);


--
-- Name: engine_runs engine_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engine_runs
    ADD CONSTRAINT engine_runs_pkey PRIMARY KEY (id);


--
-- Name: engine_signals engine_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engine_signals
    ADD CONSTRAINT engine_signals_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_prompt_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_prompt_id_key UNIQUE (user_id, prompt_id);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (email);


--
-- Name: newsletter_subscribers newsletter_subscribers_unsubscribe_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_unsubscribe_token_key UNIQUE (unsubscribe_token);


--
-- Name: outreach_drafts outreach_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_drafts
    ADD CONSTRAINT outreach_drafts_pkey PRIMARY KEY (id);


--
-- Name: outreach_drafts outreach_drafts_target_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_drafts
    ADD CONSTRAINT outreach_drafts_target_id_key UNIQUE (target_id);


--
-- Name: outreach_log outreach_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_log
    ADD CONSTRAINT outreach_log_pkey PRIMARY KEY (id);


--
-- Name: outreach_targets outreach_targets_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_targets
    ADD CONSTRAINT outreach_targets_email_unique UNIQUE (email);


--
-- Name: outreach_targets outreach_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_targets
    ADD CONSTRAINT outreach_targets_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: prompt_queue prompt_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_queue
    ADD CONSTRAINT prompt_queue_pkey PRIMARY KEY (id);


--
-- Name: prompts prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompts
    ADD CONSTRAINT prompts_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key, window_start);


--
-- Name: roast_traces roast_traces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roast_traces
    ADD CONSTRAINT roast_traces_pkey PRIMARY KEY (id);


--
-- Name: scraping_sources scraping_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraping_sources
    ADD CONSTRAINT scraping_sources_pkey PRIMARY KEY (id);


--
-- Name: search_queries search_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_queries
    ADD CONSTRAINT search_queries_pkey PRIMARY KEY (id);


--
-- Name: skill_traces skill_traces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_traces
    ADD CONSTRAINT skill_traces_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: waitlist waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_email_key UNIQUE (email);


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);


--
-- Name: email_tier_grants_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_tier_grants_created_at_idx ON public.email_tier_grants USING btree (created_at DESC);


--
-- Name: engine_runs_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX engine_runs_module_idx ON public.engine_runs USING btree (module);


--
-- Name: engine_runs_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX engine_runs_started_idx ON public.engine_runs USING btree (started_at DESC);


--
-- Name: engine_signals_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX engine_signals_active_idx ON public.engine_signals USING btree (active, created_at DESC);


--
-- Name: idx_attribution_events_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attribution_events_email ON public.attribution_events USING btree (user_email);


--
-- Name: idx_attribution_events_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attribution_events_source ON public.attribution_events USING btree (source, event_type);


--
-- Name: idx_attribution_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attribution_events_type ON public.attribution_events USING btree (event_type, created_at DESC);


--
-- Name: idx_attribution_events_utm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attribution_events_utm ON public.attribution_events USING btree (utm_source, utm_campaign);


--
-- Name: idx_clients_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_active ON public.clients USING btree (active);


--
-- Name: idx_clients_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_hash ON public.clients USING btree (api_key_hash);


--
-- Name: idx_collections_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_user ON public.collections USING btree (user_id);


--
-- Name: idx_content_gaps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_gaps_status ON public.content_gaps USING btree (status, frequency DESC);


--
-- Name: idx_content_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_items_status ON public.content_items USING btree (status);


--
-- Name: idx_content_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_items_type ON public.content_items USING btree (type);


--
-- Name: idx_content_items_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_items_updated ON public.content_items USING btree (updated_at DESC);


--
-- Name: idx_courses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_category ON public.courses USING btree (category);


--
-- Name: idx_courses_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_published ON public.courses USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_engine_runs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engine_runs_module ON public.engine_runs USING btree (module, created_at DESC);


--
-- Name: idx_engine_runs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engine_runs_started_at ON public.engine_runs USING btree (started_at DESC);


--
-- Name: idx_engine_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engine_runs_status ON public.engine_runs USING btree (status);


--
-- Name: idx_engine_signals_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engine_signals_active ON public.engine_signals USING btree (active, severity, created_at DESC);


--
-- Name: idx_engine_signals_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engine_signals_type ON public.engine_signals USING btree (signal_type);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id);


--
-- Name: idx_outreach_drafts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_drafts_status ON public.outreach_drafts USING btree (status);


--
-- Name: idx_outreach_drafts_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_drafts_updated ON public.outreach_drafts USING btree (updated_at DESC);


--
-- Name: idx_outreach_log_resend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_log_resend ON public.outreach_log USING btree (resend_id);


--
-- Name: idx_outreach_log_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_log_sent ON public.outreach_log USING btree (sent_at DESC);


--
-- Name: idx_outreach_log_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_log_target ON public.outreach_log USING btree (target_id);


--
-- Name: idx_outreach_targets_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_targets_country ON public.outreach_targets USING btree (country);


--
-- Name: idx_outreach_targets_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_targets_email ON public.outreach_targets USING btree (email);


--
-- Name: idx_outreach_targets_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_targets_language ON public.outreach_targets USING btree (language);


--
-- Name: idx_outreach_targets_legit_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_targets_legit_score ON public.outreach_targets USING btree (legitimate_interest_score DESC NULLS LAST);


--
-- Name: idx_outreach_targets_status_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_targets_status_source ON public.outreach_targets USING btree (status, source);


--
-- Name: idx_prompt_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompt_queue_status ON public.prompt_queue USING btree (status, created_at DESC);


--
-- Name: idx_prompts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_category ON public.prompts USING btree (category);


--
-- Name: idx_prompts_difficulty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_difficulty ON public.prompts USING btree (difficulty);


--
-- Name: idx_prompts_fts_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_fts_en ON public.prompts USING gin (fts_en);


--
-- Name: idx_prompts_fts_es; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_fts_es ON public.prompts USING gin (fts_es);


--
-- Name: idx_prompts_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_published ON public.prompts USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_prompts_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_subcategory ON public.prompts USING btree (subcategory);


--
-- Name: idx_prompts_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_tags ON public.prompts USING gin (tags);


--
-- Name: idx_prompts_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_tier ON public.prompts USING btree (tier);


--
-- Name: idx_purchases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_status ON public.purchases USING btree (status);


--
-- Name: idx_purchases_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_stripe ON public.purchases USING btree (stripe_payment_intent_id);


--
-- Name: idx_purchases_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_user ON public.purchases USING btree (user_id);


--
-- Name: idx_sessions_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_started ON public.user_sessions USING btree (started_at);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.user_sessions USING btree (user_id);


--
-- Name: idx_skill_traces_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_traces_client ON public.skill_traces USING btree (client_id);


--
-- Name: idx_skill_traces_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_traces_created ON public.skill_traces USING btree (created_at DESC);


--
-- Name: idx_skill_traces_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_traces_slug ON public.skill_traces USING btree (skill_slug);


--
-- Name: idx_social_log_run_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_log_run_date ON public.agent_social_log USING btree (run_date DESC);


--
-- Name: idx_social_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_log_status ON public.agent_social_log USING btree (status, platform);


--
-- Name: idx_waitlist_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_created ON public.waitlist USING btree (created_at DESC);


--
-- Name: newsletter_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_status_idx ON public.newsletter_subscribers USING btree (status) WHERE (status = 'active'::text);


--
-- Name: newsletter_subscribed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribed_at_idx ON public.newsletter_subscribers USING btree (subscribed_at DESC);


--
-- Name: prompts_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompts_embedding_idx ON public.prompts USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: prompts_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompts_featured_idx ON public.prompts USING btree (is_featured, featured_at DESC) WHERE (is_featured = true);


--
-- Name: rate_limits_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_limits_window_idx ON public.rate_limits USING btree (window_start);


--
-- Name: scraping_sources_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scraping_sources_enabled_idx ON public.scraping_sources USING btree (enabled);


--
-- Name: search_queries_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_queries_created_at_idx ON public.search_queries USING btree (created_at DESC);


--
-- Name: search_queries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_queries_user_idx ON public.search_queries USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: email_tier_grants email_tier_grants_apply_retro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_tier_grants_apply_retro AFTER INSERT OR UPDATE ON public.email_tier_grants FOR EACH ROW EXECUTE FUNCTION public.apply_grant_retro();


--
-- Name: agent_social_log agent_social_log_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_social_log
    ADD CONSTRAINT agent_social_log_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE SET NULL;


--
-- Name: attribution_events attribution_events_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribution_events
    ADD CONSTRAINT attribution_events_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.outreach_targets(id) ON DELETE SET NULL;


--
-- Name: collections collections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: email_tier_grants email_tier_grants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_tier_grants
    ADD CONSTRAINT email_tier_grants_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: favorites favorites_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: newsletter_subscribers newsletter_subscribers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: outreach_drafts outreach_drafts_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_drafts
    ADD CONSTRAINT outreach_drafts_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.outreach_targets(id) ON DELETE CASCADE;


--
-- Name: outreach_log outreach_log_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_log
    ADD CONSTRAINT outreach_log_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.outreach_targets(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: purchases purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: search_queries search_queries_top_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_queries
    ADD CONSTRAINT search_queries_top_result_id_fkey FOREIGN KEY (top_result_id) REFERENCES public.prompts(id) ON DELETE SET NULL;


--
-- Name: search_queries search_queries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_queries
    ADD CONSTRAINT search_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: courses Anyone can read published courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read published courses" ON public.courses FOR SELECT USING ((is_published = true));


--
-- Name: prompts Anyone can read published prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read published prompts" ON public.prompts FOR SELECT USING ((is_published = true));


--
-- Name: collections Anyone can view public collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view public collections" ON public.collections FOR SELECT USING ((is_public = true));


--
-- Name: collections Users can manage own collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own collections" ON public.collections USING ((auth.uid() = user_id));


--
-- Name: favorites Users can manage own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own favorites" ON public.favorites USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: purchases Users can view own purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sessions" ON public.user_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: _engine_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._engine_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: _migrations_applied; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._migrations_applied ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers admins read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins read all" ON public.newsletter_subscribers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: email_tier_grants admins read grants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins read grants" ON public.email_tier_grants FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: agent_social_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_social_log ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers anyone can subscribe themselves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone can subscribe themselves" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);


--
-- Name: newsletter_subscribers anyone can unsubscribe with valid token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone can unsubscribe with valid token" ON public.newsletter_subscribers FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: attribution_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attribution_events ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

--
-- Name: content_gaps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_gaps ENABLE ROW LEVEL SECURITY;

--
-- Name: content_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: email_tier_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_tier_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: engine_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engine_config ENABLE ROW LEVEL SECURITY;

--
-- Name: engine_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engine_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: engine_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engine_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

--
-- Name: outreach_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: outreach_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;

--
-- Name: outreach_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outreach_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: prompt_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prompt_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: roast_traces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roast_traces ENABLE ROW LEVEL SECURITY;

--
-- Name: scraping_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: search_queries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_traces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_traces ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict jhBUj0N4iGmHh3O99MkU9SeeBgLbLvughO4R8jm0oGjrKjLL7RS4K7f8FVLlgCQ

