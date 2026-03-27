import Link from "next/link"
import { ArrowRight, CircleDollarSign, FolderGit2, Globe, BriefcaseBusiness, Mail } from "lucide-react"
import { publicExploreLinks, resourceLinks } from "@/lib/public-site"

export default function Footer() {
  return (
    <footer className="border-t border-[color:var(--marketing-line)] bg-[var(--marketing-paper)] text-[var(--marketing-ink)] dark:bg-[var(--marketing-ink)] dark:text-[var(--marketing-paper)]">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-12 border-b border-[color:var(--marketing-line)] pb-12 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.7fr))]">
          <div className="max-w-md">
            <Link href="/" className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-[rgba(204,92,44,0.14)] text-[var(--marketing-accent)]">
                <CircleDollarSign className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-3xl leading-none tracking-[-0.04em]">FundLoop</p>
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[var(--marketing-muted)]">
                  Build the loop
                </p>
              </div>
            </Link>
            <p className="mt-6 text-sm leading-7 text-[var(--marketing-muted-strong)]">
              FundLoop connects projects, people, and proof into a shared economic loop where real participation can
              compound into real upside.
            </p>
            <Link
              href="/?onboarding=project"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]"
            >
              Start a project profile
              <ArrowRight className="h-4 w-4" />
            </Link>
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
              Explore
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {publicExploreLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/blog" className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/ecosystem" className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                  Ecosystem
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
              Resources
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
              Legal
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <Link href="/pledge" className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                  The FundLoop Pledge
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-[var(--marketing-muted-strong)] transition-colors hover:text-[var(--marketing-accent)]">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 text-xs text-[var(--marketing-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} FundLoop. All rights reserved.
          </p>
          <p>
            A network state for mutual prosperity.
          </p>
        </div>
      </div>
    </footer>
  )
}
