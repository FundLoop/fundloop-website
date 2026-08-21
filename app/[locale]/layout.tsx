import { Suspense } from "react"
import type React from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Fraunces, Manrope } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server"
import "../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { OnboardingModalManager } from "@/components/onboarding-modal-manager"
import { Web3Provider } from "@/components/web3-provider"
import { getWalletRuntimeConfig } from "@/lib/onchain/runtime-config"
import { isValidLocale, routing } from "@/i18n/routing"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })

type LayoutProps = Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Omit<LayoutProps, "children">): Promise<Metadata> {
  const { locale } = await params

  if (!isValidLocale(locale)) {
    notFound()
  }

  const t = await getTranslations({ locale, namespace: "metadata.layout" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params

  if (!isValidLocale(locale)) {
    notFound()
  }

  setRequestLocale(locale)

  const walletRuntimeConfig = getWalletRuntimeConfig()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${manrope.className} ${manrope.variable} ${fraunces.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <Web3Provider runtimeConfig={walletRuntimeConfig}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              <Suspense fallback={null}>
                <OnboardingModalManager />
              </Suspense>
              {children}
            </ThemeProvider>
          </Web3Provider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
