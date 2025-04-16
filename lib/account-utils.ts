import { supabase } from "@/lib/supabase"

// Types
export interface UserEmail {
  id: number
  email: string
  is_primary: boolean
  is_verified: boolean
  is_removed: boolean
  created_at: string
}

export interface WalletAccount {
  id: number
  wallet_address: string
  wallet_type: string
  wallet_name: string | null
  is_primary: boolean
  is_removed: boolean
  created_at: string
}

// Email management functions
export async function getUserEmails(userId: number): Promise<UserEmail[]> {
  try {
    // Get emails from our custom table
    const { data, error } = await supabase
      .from("user_emails")
      .select("*")
      .eq("user_id", userId)
      .eq("is_removed", false)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error fetching user emails:", error)
    throw error
  }
}

export async function addUserEmail(userId: number, email: string): Promise<UserEmail> {
  try {
    // Check if this is the first email (should be primary)
    const { count, error: countError } = await supabase
      .from("user_emails")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_removed", false)

    if (countError) throw countError

    const isPrimary = count === 0

    // First, add to our custom table
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

    // Then, link identity in Supabase Auth
    // Note: In a real implementation, this would require email verification
    // and would be handled through Supabase Auth API endpoints

    // For demo purposes, we're just returning the data
    return data
  } catch (error) {
    console.error("Error adding user email:", error)
    throw error
  }
}

export async function setEmailAsPrimary(userId: number, emailId: number): Promise<void> {
  try {
    const { error } = await supabase
      .from("user_emails")
      .update({ is_primary: true })
      .eq("id", emailId)
      .eq("user_id", userId)
      .eq("is_removed", false)

    if (error) throw error
  } catch (error) {
    console.error("Error setting primary email:", error)
    throw error
  }
}

export async function removeUserEmail(userId: number, emailId: number): Promise<void> {
  try {
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

    // Mark as removed in our custom table
    const { error } = await supabase
      .from("user_emails")
      .update({ is_removed: true })
      .eq("id", emailId)
      .eq("user_id", userId)

    if (error) throw error

    // Note: In a real implementation, we would NOT unlink the identity from Supabase Auth
    // as per the requirements
  } catch (error) {
    console.error("Error removing user email:", error)
    throw error
  }
}

// Wallet management functions
export async function getUserWallets(userId: number): Promise<WalletAccount[]> {
  try {
    const { data, error } = await supabase
      .from("wallet_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_removed", false)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error fetching user wallets:", error)
    throw error
  }
}

export async function addUserWallet(
  userId: number,
  walletAddress: string,
  walletType = "ethereum",
  walletName: string | null = null,
): Promise<WalletAccount> {
  try {
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
    return data
  } catch (error) {
    console.error("Error adding user wallet:", error)
    throw error
  }
}

export async function setWalletAsPrimary(userId: number, walletId: number): Promise<void> {
  try {
    const { error } = await supabase
      .from("wallet_accounts")
      .update({ is_primary: true })
      .eq("id", walletId)
      .eq("user_id", userId)
      .eq("is_removed", false)

    if (error) throw error
  } catch (error) {
    console.error("Error setting primary wallet:", error)
    throw error
  }
}

export async function removeUserWallet(userId: number, walletId: number): Promise<void> {
  try {
    // Mark as removed
    const { error } = await supabase
      .from("wallet_accounts")
      .update({ is_removed: true })
      .eq("id", walletId)
      .eq("user_id", userId)

    if (error) throw error
  } catch (error) {
    console.error("Error removing user wallet:", error)
    throw error
  }
}

export async function updateWalletName(userId: number, walletId: number, walletName: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("wallet_accounts")
      .update({ wallet_name: walletName })
      .eq("id", walletId)
      .eq("user_id", userId)
      .eq("is_removed", false)

    if (error) throw error
  } catch (error) {
    console.error("Error updating wallet name:", error)
    throw error
  }
}

// Utility function to validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Utility function to validate wallet address format (basic check)
export function isValidWalletAddress(address: string, type = "ethereum"): boolean {
  if (type === "ethereum") {
    // Basic Ethereum address validation (starts with 0x followed by 40 hex chars)
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  } else if (type === "bitcoin") {
    // Basic Bitcoin address validation
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[ac-hj-np-z02-9]{39,59}$/.test(address)
  } else if (type === "solana") {
    // Basic Solana address validation
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  }

  // Default case - just check it's not empty
  return address.trim().length > 0
}
