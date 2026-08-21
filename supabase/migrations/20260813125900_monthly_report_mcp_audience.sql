-- Commit the MCP audience before report artifact constraints reference it.
ALTER TYPE public.monthly_cycle_report_audience ADD VALUE IF NOT EXISTS 'mcp';
