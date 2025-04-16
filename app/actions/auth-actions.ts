"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

// Create a Supabase client for server actions
const createClient = () => {
  const cookieStore = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: { path: string; maxAge: number; domain?: string }) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: { path: string; domain?: string }) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 })
      },
    },
  })
}

// Get the current user's ID from our database
export async function getCurrentUserId() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("Error getting current user:", authError)
    return null
  }

  const { data, error } = await supabase.from("users").select("id").eq("auth_id", user.id).single()

  if (error) {
    console.error("Error getting user ID:", error)
    return null
  }

  return data.id
}

// Add a new email to the user's account
export async function addEmail(email: string) {
  const supabase = createClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  // Check if this is the first email (should be primary)
  const { count, error: countError } = await supabase
    .from("user_emails")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_removed", false)

  if (countError) throw countError

  const isPrimary = count === 0

  // Add to our custom table
  const { data, error } = await supabase
    .from("user_emails")
    .insert([
      {
        user_id: userId,
        email,
        is_primary: isPrimary,
        is_verified: false,
      },
    ])
    .select()
    .single()

  if (error) throw error

  // Link identity in Supabase Auth
  // In a real implementation, this would send a verification email
  // For now, we'll just link the identity directly
  try {
    const { error: linkError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { linked_to: userId },
    })

    if (linkError) throw linkError
  } catch (error) {
    // If linking fails, remove the email from our custom table
    await supabase.from("user_emails").delete().eq("id", data.id)

    throw error
  }

  revalidatePath("/settings/account")
  return data
}

// Set an email as primary
export async function setEmailAsPrimary(emailId: number) {
  const supabase = createClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  const { error } = await supabase
    .from("user_emails")
    .update({ is_primary: true })
    .eq("id", emailId)
    .eq("user_id", userId)
    .eq("is_removed", false)

  if (error) throw error

  revalidatePath("/settings/account")
}

// Remove an email from the user's account
export async function removeEmail(emailId: number) {
  const supabase = createClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  // Check if this is the only email
  const { count, error: countError } = await supabase
    .from("user_emails")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_removed", false)

  if (countError) throw countError

  if (count <= 1) {
    throw new Error("Cannot remove the only email address")
  }

  // Get the email address
  const { data: emailData, error: emailError } = await supabase
    .from("user_emails")
    .select("email, is_primary")
    .eq("id", emailId)
    .single()

  if (emailError) throw emailError

  // Mark as removed in our custom table
  const { error } = await supabase
    .from("user_emails")
    .update({ is_removed: true })
    .eq("id", emailId)
    .eq("user_id", userId)

  if (error) throw error

  // Note: In a real implementation, we would NOT unlink the identity from Supabase Auth
  // as per the requirements. We're just marking it as removed in our custom table.

  revalidatePath("/settings/account")
}

// Get all emails for the current user
export async function getUserEmails() {
  const supabase = createClient()
  const userId = await getCurrentUserId()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("user_emails")
    .select("*")
    .eq("user_id", userId)
    .eq("is_removed", false)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw error

  return data || []
}

// Wallet management functions
export async function getUserWallets() {
  const supabase = createClient()
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
  const supabase = createClient()
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

  const isPrimary = count === 0

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
  const supabase = createClient()
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
  const supabase = createClient()
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
  const supabase = createClient()
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
