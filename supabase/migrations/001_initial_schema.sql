-- SPEC_042 Database Schema Migration
-- Related: SPEC_042_DIKTA_ME_WEBSITE.md
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Newsletter/Marketing
  newsletter_opt_in BOOLEAN DEFAULT true,
  marketing_accepted_at TIMESTAMP,
  
  -- v1.0: Trial Credits
  trial_words_quota INTEGER DEFAULT 15000,
  trial_words_used INTEGER DEFAULT 0,
  trial_activated_at TIMESTAMP DEFAULT NOW(),
  trial_expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '15 days'),
  
  -- v2.0: License Management (ready, not used in v1.0)
  license_tier TEXT DEFAULT 'free' CHECK (license_tier IN ('free', 'supporter', 'power')),
  license_key TEXT,
  license_status TEXT DEFAULT 'none',
  license_validated_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- ============================================
-- 2. API USAGE TABLE (Trial Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.api_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,  -- 'dictate', 'refine', 'ask', 'translate'
  input_words INTEGER NOT NULL,
  output_words INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user ON public.api_usage(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Users can only view their own usage
CREATE POLICY "Users can view own usage" 
  ON public.api_usage FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- 3. BUDGET TRACKER TABLE (Safety Cap)
-- ============================================

CREATE TABLE IF NOT EXISTS public.budget_tracker (
  month TEXT PRIMARY KEY,  -- '2026-02'
  total_requests BIGINT DEFAULT 0,
  total_words BIGINT DEFAULT 0,
  total_cost_usd DECIMAL(10,4) DEFAULT 0,
  budget_cap_usd DECIMAL(10,2) DEFAULT 80.00,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- No RLS needed - only accessed by Edge Functions

-- ============================================
-- 4. AUTO-PROFILE CREATION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for re-running migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 5. BUDGET UPDATE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.update_budget(
  p_month TEXT,
  p_requests BIGINT,
  p_words BIGINT,
  p_cost DECIMAL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.budget_tracker (month, total_requests, total_words, total_cost_usd)
  VALUES (p_month, p_requests, p_words, p_cost)
  ON CONFLICT (month)
  DO UPDATE SET
    total_requests = public.budget_tracker.total_requests + p_requests,
    total_words = public.budget_tracker.total_words + p_words,
    total_cost_usd = public.budget_tracker.total_cost_usd + p_cost,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. VERIFICATION QUERIES
-- ============================================

-- Run these to verify schema is correct:

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('profiles', 'api_usage', 'budget_tracker');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'api_usage');

-- Check policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
