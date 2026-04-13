import { Suspense } from "react"
import type React from "react"
import type { Metadata } from "next"
import { Fraunces, Manrope } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { OnboardingModalManager } from "@/components/onboarding-modal-manager"
import { Web3Provider } from "@/components/web3-provider"
import { assertWalletRuntimeConfigForStartup, getWalletRuntimeConfig } from "@/lib/onchain/runtime-config"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })

export const metadata: Metadata = {
  title: "FundLoop - A Network State for Mutual Prosperity",
  description:
    "FundLoop connects projects and users in a sustainable economic ecosystem, where 1% of project revenues are distributed equally to active users.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const walletRuntimeConfig = getWalletRuntimeConfig()
  assertWalletRuntimeConfigForStartup(walletRuntimeConfig)

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.className} ${manrope.variable} ${fraunces.variable}`}>
        <Web3Provider runtimeConfig={walletRuntimeConfig}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <Navbar />
            <Suspense fallback={null}>
              <OnboardingModalManager />
            </Suspense>
            <main className="min-h-screen">{children}</main>
            <Footer />
          </ThemeProvider>
        </Web3Provider>
      </body>
    </html>
  )
}
