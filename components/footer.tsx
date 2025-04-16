import Link from "next/link"
import { CircleDollarSign, Github, Twitter, Linkedin, Mail } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t bg-slate-50 dark:bg-slate-950">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div>
            <h3 className="font-medium mb-4">Temporary</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/admin"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Admin
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/superadmin"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Super Admin
                </Link>
              </li>
            </ul>
          </div>
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <CircleDollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-xl">FundLoop</span>
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 max-w-xs">
              A network state for mutual prosperity, connecting projects and users in a sustainable economic ecosystem.
            </p>
            <div className="flex gap-4">
              <Link
                href="https://twitter.com"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link
                href="https://github.com"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link
                href="https://linkedin.com"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <Linkedin className="h-5 w-5" />
                <span className="sr-only">LinkedIn</span>
              </Link>
              <Link
                href="mailto:info@fundloop.org"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <Mail className="h-5 w-5" />
                <span className="sr-only">Email</span>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-4">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/projects"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Projects
                </Link>
              </li>
              <li>
                <Link
                  href="/users"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Users
                </Link>
              </li>
              <li>
                <Link
                  href="/analytics"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Analytics
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/documentation"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Support
                </Link>
              </li>
              <li>
                <Link
                  href="/api"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  API
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/pledge"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  The FundLoop Pledge
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} FundLoop. All rights reserved.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 sm:mt-0">
            A network state for mutual prosperity
          </p>
        </div>
      </div>
    </footer>
  )
}
