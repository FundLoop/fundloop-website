import { createMonthlyReportPublicationHandler, createSupabaseMonthlyReportOperations } from "../../../lib/reporting/monthly-report-publication-handler.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, serve } from "../_shared/command-runtime.ts"

const handleRequest = createMonthlyReportPublicationHandler({
  authenticate: authenticateRequest,
  environment: () => getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production",
  isInternal: (email) => isInternalAdminEmail(email, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS")),
  operations: createSupabaseMonthlyReportOperations,
})

serve(handleRequest)
export { handleRequest }
