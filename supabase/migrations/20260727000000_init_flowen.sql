-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. ENUMS
CREATE TYPE app_brand AS ENUM ('flowen', 'vocali');
CREATE TYPE subscription_tier AS ENUM ('founding', 'standard', 'public_funds', 'vocali_freemium');
CREATE TYPE disfluency_type AS ENUM ('block', 'repetition', 'prolongation', 'easy_onset');

-- 2. USERS PROFILE & ENTITLEMENTS (Extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    brand app_brand NOT NULL DEFAULT 'flowen',
    tier subscription_tier NOT NULL DEFAULT 'standard',
    organization_id UUID,
    opt_in_telemetry BOOLEAN NOT NULL DEFAULT true,
    daily_practice_limit_mins INT DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ORGANIZATIONS (For Government / NHS / Access to Work Block Contracts)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contract_reference TEXT UNIQUE NOT NULL,
    total_allocated_seats INT NOT NULL DEFAULT 20000,
    used_seats INT NOT NULL DEFAULT 0,
    contract_start_date DATE NOT NULL,
    contract_end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key link for profiles
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_organization 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 4. PRACTICE SESSIONS
CREATE TABLE public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    brand app_brand NOT NULL,
    duration_seconds INT NOT NULL,
    total_blocks_detected INT DEFAULT 0,
    total_repetitions_detected INT DEFAULT 0,
    total_prolongations_detected INT DEFAULT 0,
    average_latency_ms NUMERIC(6,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TELEMETRY LOGS (Asynchronous Model Data Flywheel)
CREATE TABLE public.telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    audio_clip_r2_path TEXT,
    disfluency_type disfluency_type NOT NULL,
    confidence_score NUMERIC(4,3) NOT NULL,
    acoustic_embedding vector(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR HIGH-THROUGHPUT REALTIME LOGGING
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_sessions_user ON public.practice_sessions(user_id);
CREATE INDEX idx_telemetry_type ON public.telemetry_logs(disfluency_type);
CREATE INDEX idx_telemetry_embedding ON public.telemetry_logs USING hnsw (acoustic_embedding vector_cosine_ops);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read and update their own record
CREATE POLICY "Users view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Practice Sessions: Users manage their own sessions
CREATE POLICY "Users view own sessions" ON public.practice_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sessions" ON public.practice_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Telemetry Logs: System insert only (Users can write if opted in)
CREATE POLICY "Users insert telemetry if opted in" ON public.telemetry_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND opt_in_telemetry = true
        )
    );

-- AUTOMATIC PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, brand, tier)
    VALUES (
        NEW.id, 
        COALESCE((NEW.raw_user_meta_data->>'brand')::app_brand, 'flowen'),
        COALESCE((NEW.raw_user_meta_data->>'tier')::subscription_tier, 'standard')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
