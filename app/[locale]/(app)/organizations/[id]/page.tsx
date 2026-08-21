import { redirect } from "next/navigation"

type OrganizationRedirectPageProps = {
  params: Promise<{ locale: string; id: string }>
}

export default async function OrganizationRedirectPage({ params }: OrganizationRedirectPageProps) {
  const { locale } = await params

  redirect(`/${locale}/founder/projects`)
}
