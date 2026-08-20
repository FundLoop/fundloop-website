import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowRight, BriefcaseBusiness, CircleDollarSign, FolderGit2, Globe, Mail } from "lucide-react"
import { Link as LocaleLink } from "@/i18n/navigation"
import { publicPrimaryLinks, resourceLinks } from "@/lib/public-site"

export default async function Footer() {
  const t = await getTranslations("shell")
  const primaryLinks = publicPrimaryLinks.map((link) => ({
    ...link,
    label: t(`nav.primary.${link.id}`),
  }))
  const translatedResourceLinks = resourceLinks.map((link) => ({
    ...link,
    label: t(`nav.resourceLinks.${link.id}.label`),
  }))

  return (
    <footer className="border-t border-[color:var(--marketing-line)] bg-[var(--marketing-paper)] text-[var(--marketing-ink)]">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-12 border-b border-[color:var(--marketing-line)] pb-12 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.7fr))]">
          <div className="max-w-md">
            <LocaleLink href="/" className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-[rgba(204,92,44,0.14)] text-[var(--marketing-accent)]">
                <CircleDollarSign className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-3xl leading-none tracking-[-0.04em]">FundLoop</p>
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[var(--marketing-muted)]">
                  {t("footer.buildTheLoop")}
                </p>
              </div>
            </LocaleLink>
            <p className="mt-6 text-sm leading-7 text-[var(--marketing-muted-strong)]">{t("footer.body")}</p>
            <LocaleLink
              href="/founders"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]"
            >
              {t("footer.openFounderPath")}
              <ArrowRight className="h-4 w-4" />
            </LocaleLink>
            <div className="mt-8 flex gap-4">
              <Link
                href="https://twitter.com"
                className="text-[var(--marketing-muted)] transition-colors hover:text-[var(--marketing-accent)]"
              >
                <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link
                href="https://github.com"
                className="text-[var(--marketing-muted)] transition-colors hover:text-[var(--marketing-accent)]"
              >
                <FolderGit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link
                href="https://linkedin.com"
                className="text-[var(--marketing-muted)] transition-colors hover:text-[var(--marketing-accent)]"
              >
                <BriefcaseBusiness className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">LinkedIn</span>
              </Link>
              <Link
                href="mailto:info@fundloop.org"
                className="text-[var(--marketing-muted)] transition-colors hover:text-[var(--marketing-accent)]"
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">Email</span>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
              {t("footer.explore")}
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  <LocaleLink
                    href={link.href}
                    className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]"
                  >
                    {link.label}
                  </LocaleLink>
                </li>
              ))}
              <li>
                <LocaleLink
                  href="/ecosystem"
                  className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]"
                >
                  {t("footer.ecosystem")}
                </LocaleLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
              {t("footer.resources")}
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {translatedResourceLinks.map((link) => (
                <li key={link.href}>
                  <LocaleLink
                    href={link.href}
                    className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]"
                  >
                    {link.label}
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
              {t("footer.legal")}
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <LocaleLink
                  href="/terms"
                  className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]"
                >
                  {t("footer.terms")}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink
                  href="/privacy"
                  className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]"
                >
                  {t("footer.privacy")}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink
                  href="/cookies"
                  className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]"
                >
                  {t("footer.cookies")}
                </LocaleLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 text-xs text-[var(--marketing-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {t("footer.rightsReserved")}
          </p>
          <p>{t("footer.mission")}</p>
        </div>
      </div>
    </footer>
  )
}
