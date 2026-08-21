import { notFound, permanentRedirect } from "next/navigation"
import { isValidLocale } from "@/i18n/routing"

type PageProps = {
  params: Promise<{ locale: string }>
}

export default async function PricingPage({ params }: PageProps) {
  const { locale } = await params

  if (!isValidLocale(locale)) {
    notFound()
  }

  permanentRedirect(`/${locale}/founders#support-model`)
}
