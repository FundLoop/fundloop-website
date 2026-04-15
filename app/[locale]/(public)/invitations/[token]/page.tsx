import { notFound, permanentRedirect } from "next/navigation"
import { isValidLocale } from "@/i18n/routing"

type PageProps = {
  params: Promise<{ locale: string; token: string }>
}

export default async function InvitationRedirectPage({ params }: PageProps) {
  const { locale, token } = await params

  if (!isValidLocale(locale)) {
    notFound()
  }

  permanentRedirect(`/${locale}/join?invite=${encodeURIComponent(token)}`)
}
