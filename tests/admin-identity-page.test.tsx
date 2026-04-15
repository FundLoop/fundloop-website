import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const requireInternalAdminActor = vi.fn()
const getAdminSupabaseClient = vi.fn()

vi.mock("@/lib/zkas/auth", () => ({
  requireInternalAdminActor,
}))

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabaseClient,
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

describe("AdminIdentityPage", () => {
  it("renders stale and failed identity rows", async () => {
    requireInternalAdminActor.mockResolvedValue({ userId: "admin-1", email: "admin@example.com" })
    getAdminSupabaseClient.mockReturnValue({
      from(table: string) {
        if (table === "users") {
          return {
            select: () => ({
              in: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      {
                        user_id: "user-1",
                        display_name: "Maya",
                        full_name: "Maya Torres",
                        cubid_id: "cubid-user-1",
                        cubid_identity_status: "linked",
                        cubid_score: 90,
                        status: "active",
                      },
                    ],
                  }),
              }),
            }),
          }
        }

        if (table === "cubid_identity_snapshots") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      user_id: "user-1",
                      cubid_user_id: "cubid-user-1",
                      primary_name: "Maya Torres",
                      last_synced_at: "2026-04-01T12:00:00.000Z",
                      last_sync_error_code: "cubid_sync_failed",
                      last_sync_error_message: "CUBID timeout",
                    },
                  ],
                }),
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    })

    const { default: AdminIdentityPage } = await import("@/app/[locale]/(app)/admin/identity/page")
    render(await AdminIdentityPage())

    expect(screen.getByRole("heading", { name: /identity health/i })).toBeTruthy()
    expect(screen.getByText(/^maya torres$/i)).toBeTruthy()
    expect(screen.getAllByText(/sync error/i)).toHaveLength(2)
    expect(screen.getByText(/cubid timeout/i)).toBeTruthy()
  })
})
