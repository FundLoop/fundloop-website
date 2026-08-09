REVOKE ALL ON TABLE
  public.external_financial_events,
  public.external_funding_applications,
  public.custody_reconciliation_snapshots,
  public.shadow_financial_journals,
  public.shadow_close_packages
FROM service_role;

GRANT SELECT ON TABLE
  public.external_financial_events,
  public.external_funding_applications,
  public.custody_reconciliation_snapshots,
  public.shadow_financial_journals,
  public.shadow_close_packages,
  public.shadow_financial_reconciliation_observability
TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE
  public.external_financial_events,
  public.external_funding_applications,
  public.custody_reconciliation_snapshots,
  public.shadow_financial_journals,
  public.shadow_close_packages
FROM service_role;
