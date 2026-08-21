import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import SupportPageContent from "@/components/support-page-content"

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.support" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default function SupportPage() {
  return <SupportPageContent />
}
