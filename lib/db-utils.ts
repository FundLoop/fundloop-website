import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

// Create a Supabase client
const createClient = () => {
  return createClientComponentClient<Database>()
}

// Get the current user's ID
export async function getCurrentUserId() {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

// Update with tracking (adds updated_by field)
export async function updateWithTracking(table: string, id: number | string, data: any, idField = "id") {
  const supabase = createClient()
  const userId = await getCurrentUserId()

  // Add updated_by field to data
  const dataWithTracking = {
    ...data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }

  // Perform the update
  const { data: result, error } = await supabase.from(table).update(dataWithTracking).eq(idField, id).select()

  if (error) throw error
  return result
}

// Soft delete function
export async function softDelete(table: string, id: number | string, idField = "id") {
  const supabase = createClient()
  const userId = await getCurrentUserId()

  // Get the appropriate status field for the table
  const statusField = getStatusField(table)

  // Prepare the data for soft delete
  const softDeleteData = {
    deleted_at: new Date().toISOString(),
    updated_by: userId,
    [statusField]: "deleted",
  }

  // Perform the soft delete
  const { data, error } = await supabase.from(table).update(softDeleteData).eq(idField, id).select()

  if (error) throw error
  return data
}

// Helper function to get the status field name for each table
function getStatusField(table: string): string {
  const statusMap: Record<string, string> = {
    users: "status",
    organizations: "status",
    projects: "status",
    organization_members: "status",
    wallet_accounts: "status",
    wallet_connections: "status",
    payments: "status",
    payment_methods: "status",
  }

  return statusMap[table] || "status"
}

// Function to restore a soft-deleted record
export async function restoreRecord(table: string, id: number | string, idField = "id") {
  const supabase = createClient()
  const userId = await getCurrentUserId()

  // Get the appropriate status field for the table
  const statusField = getStatusField(table)

  // Prepare the data for restoration
  const restoreData = {
    deleted_at: null,
    updated_by: userId,
    [statusField]: "active",
  }

  // Perform the restoration
  const { data, error } = await supabase.from(table).update(restoreData).eq(idField, id).select()

  if (error) throw error
  return data
}
