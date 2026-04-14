import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Wallet, User, Shield, Bell, CreditCard, BrainCircuit } from "lucide-react"

// TODO(Session 03 IA): this hub is transitional; keep account/settings leaves, but move primary product actions into user and founder workspaces per `agent-context/information-architecture.md`.

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <Link href="/settings/account" className="block">
          <Card className="h-full hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Account
              </CardTitle>
              <CardDescription>Manage your account settings and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Update your profile information, change your password, and manage your account preferences.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/account" className="block">
          <Card className="h-full hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Email Addresses
              </CardTitle>
              <CardDescription>Manage your email addresses</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Add or remove email addresses, set your primary email, and manage email preferences.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/account" className="block">
          <Card className="h-full hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Wallet Addresses
              </CardTitle>
              <CardDescription>Manage your wallet addresses</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Add or remove wallet addresses, set your primary wallet for receiving payments.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/notifications" className="block">
          <Card className="h-full hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Notifications
              </CardTitle>
              <CardDescription>Manage your notification preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Control which notifications you receive and how they are delivered.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Payments
            </CardTitle>
            <CardDescription>Project payment settings are moving into project-specific payment pages</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Manage crypto collection routes from each project&apos;s payments screen for now. A dedicated account-level
              payments settings page is not live yet.
            </p>
          </CardContent>
        </Card>

        <Link href="/settings/zkas" className="block">
          <Card className="h-full hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                zkAS Results
              </CardTitle>
              <CardDescription>View verified zkActivitySum publications</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Review published zkAS allocations once they have been verified and released by FundLoop superadmins.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/security" className="block">
          <Card className="h-full hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Security
              </CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Update your password, enable two-factor authentication, and manage security settings.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
