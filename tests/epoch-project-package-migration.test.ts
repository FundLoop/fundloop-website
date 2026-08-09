import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql=readFileSync("supabase/migrations/20260809140000_epoch_project_packages.sql","utf8")
const edge=readFileSync("supabase/functions/epoch-project-package-workflow/index.ts","utf8")

describe("epoch project package control plane",()=>{
  it("keeps packages versioned, source-attributed, and production disabled",()=>{
    expect(sql).toContain("UNIQUE(project_id, intended_cycle_id, version)")
    expect(sql).toContain("epoch_project_package_funding_shape_check")
    expect(sql).toContain("epoch_project_package_runtime_disabled")
    expect(sql).toContain("production_enabled = false")
    expect(sql).toContain("project_fee_assessed_once")
    expect(sql).toContain("base_fee_deferred")
  })
  it("freezes decisions behind accepted email delivery and exposes privacy-safe reports",()=>{
    expect(sql).toContain("epoch_project_package_not_decidable")
    expect(sql).toContain("reconciliation_email_delivered_at IS NULL")
    expect(sql).toContain("status IN ('approved','silent_approved')")
    expect(sql).toContain("epoch_project_package_pseudonym")
    expect(sql).not.toMatch(/epoch_project_package_public_preliminary[\s\S]{0,500}user_id/)
  })
  it("binds Edge identity and environment and delivers only through local Mailpit",()=>{
    expect(edge).toContain('getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production"')
    expect(edge).toContain("actorUserId: auth.user.id")
    expect(edge).toContain('runtimeEnvironment !== "local" && runtimeEnvironment !== "test"')
    expect(edge).toContain('p_actor_role: "internal_admin"')
    expect(sql).toContain("p_actor_role <> 'internal_admin'")
    expect(sql).toContain("local_email_delivery_enabled=true")
    expect(edge).toContain("/api/v1/send")
    expect(edge).not.toContain("console.log")
  })
})
