"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wallet, Plus, Star, Trash2, Edit, AlertCircle } from "lucide-react"
import {
  getUserWallets,
  addWallet,
  removeWallet,
  setWalletAsPrimary,
  updateWalletName,
} from "@/app/actions/auth-actions"

interface WalletAccount {
  id: number
  wallet_address: string
  wallet_type: string
  wallet_name: string | null
  is_primary: boolean
  is_removed: boolean
  created_at: string
}

export function WalletManagement() {
  const [wallets, setWallets] = useState<WalletAccount[]>([])
  const [isAddingWallet, setIsAddingWallet] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [walletToRemove, setWalletToRemove] = useState<WalletAccount | null>(null)
  const [walletToEdit, setWalletToEdit] = useState<WalletAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [newWalletAddress, setNewWalletAddress] = useState("")
  const [newWalletType, setNewWalletType] = useState("ethereum")
  const [newWalletName, setNewWalletName] = useState("")
  const [editWalletName, setEditWalletName] = useState("")

  useEffect(() => {
    fetchWallets()
  }, [])

  const fetchWallets = async () => {
    try {
      setLoading(true)
      setError(null)
      const userWallets = await getUserWallets()
      setWallets(userWallets)
    } catch (err: any) {
      console.error("Error fetching wallets:", err)
      setError(err.message || "Failed to load wallet addresses. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidWalletAddress(newWalletAddress, newWalletType)) {
      toast({
        title: "Invalid wallet address",
        description: `Please enter a valid ${newWalletType} wallet address.`,
        variant: "destructive",
      })
      return
    }

    // Check if wallet already exists
    if (
      wallets.some(
        (wallet) =>
          wallet.wallet_address.toLowerCase() === newWalletAddress.toLowerCase() &&
          wallet.wallet_type === newWalletType,
      )
    ) {
      toast({
        title: "Wallet already exists",
        description: "This wallet is already associated with your account.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      await addWallet(newWalletAddress, newWalletType, newWalletName || null)
      toast({
        title: "Wallet added",
        description: "The wallet has been added to your account.",
      })
      resetAddWalletForm()
      fetchWallets()
    } catch (err: any) {
      console.error("Error adding wallet:", err)
      toast({
        title: "Failed to add wallet",
        description: err.message || "There was an error adding your wallet. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetAddWalletForm = () => {
    setNewWalletAddress("")
    setNewWalletType("ethereum")
    setNewWalletName("")
    setIsAddingWallet(false)
  }

  const handleSetPrimary = async (walletId: number) => {
    try {
      await setWalletAsPrimary(walletId)
      toast({
        title: "Primary wallet updated",
        description: "Your primary wallet has been updated successfully.",
      })
      fetchWallets()
    } catch (err: any) {
      console.error("Error setting primary wallet:", err)
      toast({
        title: "Failed to update primary wallet",
        description: err.message || "There was an error updating your primary wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveWallet = async () => {
    if (!walletToRemove) return

    try {
      await removeWallet(walletToRemove.id)
      toast({
        title: "Wallet removed",
        description: "The wallet has been removed from your account.",
      })
      setWalletToRemove(null)
      fetchWallets()
    } catch (err: any) {
      console.error("Error removing wallet:", err)
      toast({
        title: "Failed to remove wallet",
        description: err.message || "There was an error removing the wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditWallet = async () => {
    if (!walletToEdit) return

    try {
      await updateWalletName(walletToEdit.id, editWalletName)
      toast({
        title: "Wallet updated",
        description: "The wallet name has been updated successfully.",
      })
      setWalletToEdit(null)
      fetchWallets()
    } catch (err: any) {
      console.error("Error updating wallet:", err)
      toast({
        title: "Failed to update wallet",
        description: err.message || "There was an error updating the wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (wallet: WalletAccount) => {
    setWalletToEdit(wallet)
    setEditWalletName(wallet.wallet_name || "")
  }

  // Utility function to validate wallet address format
  const isValidWalletAddress = (address: string, type = "ethereum"): boolean => {
    if (!address.trim()) return false

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

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <p>Loading wallet addresses...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <Button onClick={fetchWallets} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Wallet Addresses</CardTitle>
          <CardDescription>Manage the wallet addresses associated with your account</CardDescription>
        </CardHeader>
        <CardContent>
          {wallets.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No wallet addresses found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {wallet.wallet_name
                          ? wallet.wallet_name
                          : `${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(wallet.wallet_address.length - 4)}`}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 mt-1">
                        <p className="text-xs text-muted-foreground font-mono">{wallet.wallet_address}</p>
                        <div className="flex gap-2">
                          {wallet.is_primary && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs capitalize">
                            {wallet.wallet_type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(wallet)} title="Edit wallet name">
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    {!wallet.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(wallet.id)}
                        title="Set as primary wallet"
                      >
                        <Star className="h-4 w-4" />
                        <span className="sr-only">Set as primary</span>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setWalletToRemove(wallet)} title="Remove wallet">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingWallet ? (
            <form onSubmit={handleAddWallet} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-wallet-address">Wallet Address</Label>
                <Input
                  id="new-wallet-address"
                  placeholder="Enter wallet address"
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-wallet-type">Wallet Type</Label>
                <Select value={newWalletType} onValueChange={setNewWalletType}>
                  <SelectTrigger id="new-wallet-type">
                    <SelectValue placeholder="Select wallet type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="bitcoin">Bitcoin</SelectItem>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-wallet-name">Wallet Name (Optional)</Label>
                <Input
                  id="new-wallet-name"
                  placeholder="e.g., My Main Wallet"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Wallet"}
                </Button>
                <Button type="button" variant="outline" onClick={resetAddWalletForm}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => setIsAddingWallet(true)} className="mt-6" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Wallet Address
            </Button>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <p>Your primary wallet is used for receiving citizen salary payments.</p>
        </CardFooter>
      </Card>

      <AlertDialog open={!!walletToRemove} onOpenChange={(open) => !open && setWalletToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this wallet? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveWallet} className="bg-red-500 hover:bg-red-600">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!walletToEdit} onOpenChange={(open) => !open && setWalletToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Wallet Name</DialogTitle>
            <DialogDescription>Give your wallet a memorable name to help you identify it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-wallet-name">Wallet Name</Label>
              <Input
                id="edit-wallet-name"
                placeholder="e.g., My Main Wallet"
                value={editWalletName}
                onChange={(e) => setEditWalletName(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Wallet address: {walletToEdit?.wallet_address}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletToEdit(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditWallet}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
