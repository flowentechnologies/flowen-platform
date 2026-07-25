CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM (
        'trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    status subscription_status NOT NULL,
    price_id TEXT NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.anonymized_telemetry_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_hash TEXT NOT NULL,
    disfluency_type TEXT NOT NULL CHECK (disfluency_type IN ('Block', 'Repetition', 'Prolongation', 'Fluent')),
    entropy_score FLOAT NOT NULL,
    mel_spectrogram_latents JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_session_hash ON public.anonymized_telemetry_features(session_hash);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON public.anonymized_telemetry_features(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymized_telemetry_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own customer profile" ON public.customers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users view own subscription status" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anon upload to anonymized feature store" ON public.anonymized_telemetry_features FOR INSERT TO anon WITH CHECK (true);
