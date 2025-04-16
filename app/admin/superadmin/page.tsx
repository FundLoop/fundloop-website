"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
