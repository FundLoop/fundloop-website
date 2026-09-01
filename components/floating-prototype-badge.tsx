"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Mail, Sparkles, X } from "lucide-react"

export function FloatingPrototypeBadge() {
  const [isExpanded, setIsExpanded] = useState(false)
  const t = useTranslations("prototypeBadge")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isExpanded) {
      closeButtonRef.current?.focus()

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsExpanded(false)
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    } else {
      triggerRef.current?.focus()
    }
  }, [isExpanded])

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end select-none">
      {isExpanded ? (
        <div
          role="dialog"
          aria-labelledby="prototype-notice-title"
          className="relative w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-amber-500/40 bg-neutral-950/95 p-5 text-neutral-100 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h3 id="prototype-notice-title" className="font-display text-sm font-bold text-white">
                {t("title")}
              </h3>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label={t("close")}
              className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <p className="mt-3 text-xs leading-relaxed text-neutral-300">
            {t("body")}
          </p>

          {/* Footer action */}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
            <a
              href="mailto:support@firebelly.xyz?subject=FundLoop%20Prototype%20Feedback"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/30 hover:text-amber-200"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>support@firebelly.xyz</span>
            </a>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:text-white"
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-expanded={false}
          aria-label={t("openNotice")}
          className="group flex items-center gap-2 rounded-full border border-amber-500/40 bg-neutral-950/85 px-3.5 py-1.5 text-xs font-semibold text-amber-300 shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-amber-400 hover:bg-neutral-900 hover:text-amber-200 hover:shadow-amber-500/10 active:scale-95"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span>{t("label")}</span>
          <Sparkles className="h-3.5 w-3.5 text-amber-400/80 transition-transform group-hover:rotate-12 group-hover:text-amber-300" />
        </button>
      )}
    </div>
  )
}
