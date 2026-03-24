"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase-server"

type UserEmail = {
  id: number
  email: string
  is_primary: boolean
  is_verified: boolean
  is_removed: boolean
  created_at: string | null
}

// Get the current user's ID from our database
export async function getCurrentUserId() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("Error getting current user:", authError)
    return null
  }

  return user.id
}

// Add a new email to the user's account
export async function addEmail(email: string) {
  void email
  throw new Error("Additional email identities are not supported by the current database schema.")
}

// Set an email as primary
export async function setEmailAsPrimary(emailId: number) {
  void emailId
  throw new Error("Multiple email identities are not supported by the current database schema.")
}

// Remove an email from the user's account
export async function removeEmail(emailId: number) {
  const supabase = await createServerSupabaseClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  void emailId
  void supabase
  throw new Error("The primary account email cannot be removed from within this app.")
}

// Get all emails for the current user
export async function getUserEmails(): Promise<UserEmail[]> {
  const supabase = await createServerSupabaseClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw authError ?? new Error("User not authenticated")
  }

  const { data: profile, error } = await supabase.from("users").select("email, created_at").eq("user_id", userId).single()

  if (error) throw error

  const email = user.email ?? profile.email

  if (!email) {
    return []
  }

  return [
    {
      id: 0,
      email,
      is_primary: true,
      is_verified: Boolean(user.email_confirmed_at),
      is_removed: false,
      created_at: profile.created_at,
    },
  ]
}

// Wallet management functions
export async function getUserWallets() {
  const supabase = await createServerSupabaseClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("wallet_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_removed", false)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw error

  return data || []
}

export async function addWallet(walletAddress: string, walletType = "ethereum", walletName: string | null = null) {
  const supabase = await createServerSupabaseClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  // Check if this is the first wallet (should be primary)
  const { count, error: countError } = await supabase
    .from("wallet_accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_removed", false)

  if (countError) throw countError

  const isPrimary = (count ?? 0) === 0

  const { data, error } = await supabase
    .from("wallet_accounts")
    .insert([
      {
        user_id: userId,
        wallet_address: walletAddress,
        wallet_type: walletType,
        wallet_name: walletName,
        is_primary: isPrimary,
      },
    ])
    .select()
    .single()

  if (error) throw error

  revalidatePath("/settings/account")
  return data
}

export async function setWalletAsPrimary(walletId: number) {
  const supabase = await createServerSupabaseClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  const { error } = await supabase
    .from("wallet_accounts")
    .update({ is_primary: true })
    .eq("id", walletId)
    .eq("user_id", userId)
    .eq("is_removed", false)

  if (error) throw error

  revalidatePath("/settings/account")
}

export async function removeWallet(walletId: number) {
  const supabase = await createServerSupabaseClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  // Mark as removed
  const { error } = await supabase
    .from("wallet_accounts")
    .update({ is_removed: true })
    .eq("id", walletId)
    .eq("user_id", userId)

  if (error) throw error

  revalidatePath("/settings/account")
}

export async function updateWalletName(walletId: number, walletName: string) {
  const supabase = await createServerSupabaseClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  const { error } = await supabase
    .from("wallet_accounts")
    .update({ wallet_name: walletName })
    .eq("id", walletId)
    .eq("user_id", userId)
    .eq("is_removed", false)

  if (error) throw error

  revalidatePath("/settings/account")
}
