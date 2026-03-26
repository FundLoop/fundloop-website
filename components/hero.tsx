"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { buildUrl } from "@/lib/url"

const rotatingTitles = [
  "The Care Economy Hub",
  "A Living Systems Lab",
  "The Interbeing Network",
  "A Post-AI Regen Stack",
  "Thrivability Projects",
  "The Regenerative Alternative",
  "A Future Worth Building",
  "New Economy Builders",
  "A Post-capitalistic Society",
] as const

type HeroTimerRefs = {
  completedFlipCountRef: React.RefObject<number>
  delayRef: React.RefObject<number>
  displayTimerRef: React.RefObject<number | undefined>
  swapTimerRef: React.RefObject<number | undefined>
}

type HeroStateSetters = {
  setIsFading: React.Dispatch<React.SetStateAction<boolean>>
  setTitleIndex: React.Dispatch<React.SetStateAction<number>>
}

function clearHeroFlipTimers({ displayTimerRef, swapTimerRef }: Pick<HeroTimerRefs, "displayTimerRef" | "swapTimerRef">) {
  if (displayTimerRef.current) window.clearTimeout(displayTimerRef.current)
  if (swapTimerRef.current) window.clearTimeout(swapTimerRef.current)
}

function runHeroFlip(
  timerRefs: HeroTimerRefs,
  stateSetters: HeroStateSetters,
  shouldReschedule: boolean,
) {
  const { completedFlipCountRef, delayRef, swapTimerRef } = timerRefs
  const { setIsFading, setTitleIndex } = stateSetters

  setIsFading(true)

  swapTimerRef.current = window.setTimeout(() => {
    setTitleIndex((currentIndex) => (currentIndex + 1) % rotatingTitles.length)
    setIsFading(false)
    completedFlipCountRef.current += 1
    delayRef.current += Math.floor(completedFlipCountRef.current / 5) * 1000

    if (shouldReschedule) {
      scheduleHeroFlip(timerRefs, stateSetters)
    }
  }, 220)
}

function scheduleHeroFlip(timerRefs: HeroTimerRefs, stateSetters: HeroStateSetters) {
  clearHeroFlipTimers(timerRefs)

  timerRefs.displayTimerRef.current = window.setTimeout(() => {
    runHeroFlip(timerRefs, stateSetters, true)
  }, timerRefs.delayRef.current)
}

export default function Hero() {
  const pathname = usePathname()
  const router = useRouter()
  const [titleIndex, setTitleIndex] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const completedFlipCountRef = useRef(0)
  const delayRef = useRef(1000)
  const displayTimerRef = useRef<number | undefined>(undefined)
  const swapTimerRef = useRef<number | undefined>(undefined)

  const openFlow = (flow: "user" | "project") => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("onboarding", flow)
    router.push(buildUrl(pathname, nextParams), { scroll: false })
  }

  const handleHeadingFlip = () => {
    if (isFading) return

    const timerRefs = { completedFlipCountRef, delayRef, displayTimerRef, swapTimerRef }
    const stateSetters = { setIsFading, setTitleIndex }

    clearHeroFlipTimers(timerRefs)
    runHeroFlip(timerRefs, stateSetters, true)
  }

  useEffect(() => {
    const timerRefs = { completedFlipCountRef, delayRef, displayTimerRef, swapTimerRef }
    const stateSetters = { setIsFading, setTitleIndex }

    scheduleHeroFlip(timerRefs, stateSetters)
    return () => {
      clearHeroFlipTimers(timerRefs)
    }
  }, [])

  const currentTitle = rotatingTitles[titleIndex]

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 dark:from-emerald-500/10 dark:to-cyan-500/10" />
      <div className="container relative mx-auto px-4 py-24 md:py-32 flex flex-col items-center text-center">
        <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-6">
          Introducing FundLoop
        </div>
        <h1
          className="mb-6 min-h-[6.5rem] cursor-pointer text-4xl font-bold tracking-tighter transition-transform duration-300 hover:scale-[1.02] md:min-h-[9rem] md:text-6xl"
          onClick={handleHeadingFlip}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              handleHeadingFlip()
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="relative inline-flex min-h-[6.5rem] items-center justify-center md:min-h-[9rem]">
            <span
              className={`absolute inset-0 flex items-center justify-center bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent transition-all duration-300 dark:from-emerald-400 dark:to-cyan-400 ${
                isFading ? "opacity-0 blur-[1px]" : "opacity-100 blur-0"
              }`}
            >
              {currentTitle}
            </span>
            <span className="invisible">{currentTitle}</span>
          </span>
        </h1>
        <p className="max-w-[800px] text-slate-600 dark:text-slate-300 text-lg md:text-xl mb-8">
          Join a regenerative ecosystem where projects contribute to people, people support meaningful projects, and
          onboarding now actually meets you where you are.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            size="lg"
            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
            onClick={() => openFlow("project")}
          >
            Join as a Project <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" size="lg" onClick={() => openFlow("user")}>
            Join as a User <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <p className="mt-6 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          New onboarding drafts save automatically. If you step away, FundLoop will bring you back to the last screen
          the next time you return.
        </p>
      </div>
    </div>
  )
}
