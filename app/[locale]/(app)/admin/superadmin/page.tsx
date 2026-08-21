"use client"

import { useState } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { UsersTable } from "@/components/admin/users-table"
import { OrganizationsTable } from "@/components/admin/organizations-table"
import { AuditLogTable } from "@/components/admin/audit-log-table"
import { InvitationAttribution } from "@/components/admin/invitation-attribution"

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState("users")

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Super Admin Dashboard</h1>

      <Tabs defaultValue="users" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 mb-8">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="zkas">zkAS</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <UsersTable />
        </TabsContent>

        <TabsContent value="organizations" className="space-y-6">
          <OrganizationsTable />
        </TabsContent>

        <TabsContent value="audit-log" className="space-y-6">
          <AuditLogTable />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6">
          <InvitationAttribution />
        </TabsContent>

        <TabsContent value="zkas" className="space-y-6">
          <div className="rounded-lg border p-6">
            <h2 className="text-xl font-semibold">zkAS Superadmin Controls</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Review completed runs, inspect private result and attestation artifacts, verify outputs, and publish
              verified results to users.
            </p>
            <Button asChild className="mt-4">
              <Link href="/admin/superadmin/zkas">Open zkAS Superadmin</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
