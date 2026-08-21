DROP POLICY IF EXISTS monthly_cycle_reports_public_select ON public.monthly_cycle_reports;
CREATE POLICY monthly_cycle_reports_public_select
ON public.monthly_cycle_reports
FOR SELECT
USING (audience = 'public');

DROP POLICY IF EXISTS monthly_cycle_reports_user_self_select ON public.monthly_cycle_reports;
CREATE POLICY monthly_cycle_reports_user_self_select
ON public.monthly_cycle_reports
FOR SELECT
USING (
  audience = 'user'
  AND auth.uid() = subject_user_id
);
