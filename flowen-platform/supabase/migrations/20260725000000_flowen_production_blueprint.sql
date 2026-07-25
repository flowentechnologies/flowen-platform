-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT UNIQUE,
    subsidy_voucher_code TEXT,
    is_subsidized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure auth_user_id exists on customers
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='customers' AND column_name='auth_user_id'
    ) THEN
        ALTER TABLE public.customers ADD COLUMN auth_user_id UUID UNIQUE;
    END IF;
END $$;

-- 3. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_price_id TEXT NOT NULL,
    status TEXT NOT NULL,
    tier_interval TEXT CHECK (tier_interval IN ('annual', 'semi_annual', 'quarterly', 'founding')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure customer_id exists on subscriptions
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='subscriptions' AND column_name='customer_id'
    ) THEN
        ALTER TABLE public.subscriptions ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Anonymized Telemetry Features Table
CREATE TABLE IF NOT EXISTS public.anonymized_telemetry_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latency_ms NUMERIC(6,2) NOT NULL,
    jitter_ms NUMERIC(6,2) NOT NULL,
    fundamental_frequency_hz NUMERIC(6,2),
    spectral_tilt NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure session_id and customer_id exist on anonymized_telemetry_features
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='anonymized_telemetry_features' AND column_name='session_id'
    ) THEN
        ALTER TABLE public.anonymized_telemetry_features ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='anonymized_telemetry_features' AND column_name='customer_id'
    ) THEN
        ALTER TABLE public.anonymized_telemetry_features ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_customers_stripe_id ON public.customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_session_id ON public.anonymized_telemetry_features(session_id);

-- 6. RLS Setup
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymized_telemetry_features ENABLE ROW LEVEL SECURITY;

-- Safely recreate RLS Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own customer record" ON public.customers;
    CREATE POLICY "Users can view own customer record" ON public.customers FOR SELECT USING (auth.uid() = auth_user_id);

    DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
    CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (
        customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    );

    DROP POLICY IF EXISTS "Allow public telemetry ingestion" ON public.anonymized_telemetry_features;
    CREATE POLICY "Allow public telemetry ingestion" ON public.anonymized_telemetry_features FOR INSERT WITH CHECK (true);
END $$;
