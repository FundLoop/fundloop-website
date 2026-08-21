"use client"

import { useCallback, useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { ArrowRight, Sparkles, X } from "lucide-react"
import { Link } from "@/i18n/navigation"

const DISMISSAL_STORAGE_KEY = "fundloop_inaugural_banner_dismissed"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getSnapshot() {
  try {
    return sessionStorage.getItem(DISMISSAL_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function getServerSnapshot() {
  return false
}

export function InauguralBanner() {
  const t = useTranslations("shell.inauguralBanner")
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISSAL_STORAGE_KEY, "1")
      window.dispatchEvent(new Event("storage"))
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [])

  if (dismissed) {
    return null
  }

  return (
    <aside
      aria-label="Announcement"
      className="relative z-50 border-b border-[#31251e] bg-[#121615] px-3 py-2.5 text-[#fff9ef] transition-all dark:border-[#38261e] dark:bg-[#0c100f]"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs sm:text-sm">
        <Link
          href="/?onboarding=project"
          className="group flex flex-1 flex-wrap items-center justify-center gap-2 sm:gap-3 text-center transition hover:opacity-95"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d45f35]/50 bg-[#d45f35]/20 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[#f5b195] shadow-xs">
            <Sparkles className="h-3 w-3 text-[#ff8e68]" />
            {t("badge")}
          </span>
          <span className="font-medium text-[#e4ece8] group-hover:text-white">
            {t("message")}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[#f5b195] group-hover:text-[#ff9c77]">
            {t("cta")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("dismiss")}
          className="shrink-0 rounded-full p-1 text-[#a0b0a8] hover:bg-white/10 hover:text-white transition cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
