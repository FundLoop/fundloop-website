import React from 'react'
import Link from "next/link"
import { CircleDollarSign, FolderGit2, Globe, BriefcaseBusiness, Mail } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t bg-slate-50 dark:bg-slate-950">
      <div className="container px-4 py-10 sm:px-6 md:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-12 lg:gap-x-8">
          <div className="col-span-2 md:col-span-5 lg:col-span-4">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <CircleDollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-lg font-bold">FundLoop</span>
            </Link>
            <p className="mb-4 max-w-xs text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
              A network state for mutual prosperity, connecting projects and users in a sustainable economic ecosystem.
            </p>
            <div className="flex gap-4">
              <Link
                href="https://twitter.com"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link
                href="https://github.com"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <FolderGit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link
                href="https://linkedin.com"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <BriefcaseBusiness className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">LinkedIn</span>
              </Link>
              <Link
                href="mailto:info@fundloop.org"
                className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">Email</span>
              </Link>
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Platform</h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
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
              <li>
                <Link
                  href="/ecosystem"
                  className="text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  Ecosystem
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Resources</h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
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

          <div className="md:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Legal</h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
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

          <div className="md:col-span-1 md:justify-self-end lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Temporary</h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
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
        </div>

        <div className="mt-10 flex flex-col items-center justify-between border-t pt-5 sm:flex-row">
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
