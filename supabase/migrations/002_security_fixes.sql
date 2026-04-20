-- Fix: RLS Disabled in Public for budget_tracker
ALTER TABLE public.budget_tracker ENABLE ROW LEVEL SECURITY;

-- Allow service_role (Edge Functions) to manage budget
-- Since this is an internal budget tracker, full service_role access is intended.
CREATE POLICY "Service role has full access to budget_tracker"
  ON public.budget_tracker
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix: Function Search Path Mutable for handle_new_user
-- Secure the function by pinning the search_path to public
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Fix: Function Search Path Mutable for update_budget
-- Secure the function by pinning the search_path to public
ALTER FUNCTION public.update_budget(TEXT, BIGINT, BIGINT, DECIMAL) SET search_path = public;
