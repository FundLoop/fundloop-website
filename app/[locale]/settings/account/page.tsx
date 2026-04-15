"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Mail, Wallet } from "lucide-react"
import { EmailManagement } from "@/components/account/email-management"
import { WalletManagement } from "@/components/account/wallet-management"

export default function AccountSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Settings</span>
          </Link>
        </Button>
      </div>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

        <Tabs defaultValue="emails" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Addresses
            </TabsTrigger>
            <TabsTrigger value="wallets" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Wallet Addresses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emails" className="mt-0">
            <EmailManagement />
          </TabsContent>

          <TabsContent value="wallets" className="mt-0">
            <WalletManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
