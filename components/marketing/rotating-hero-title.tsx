"use client"

import { useEffect, useRef, useState } from "react"

const INITIAL_PAUSE_MS = 2_000
const PAUSE_INCREMENT_MS = 1_000
const TRANSITION_MS = 260

type RotatingHeroTitleProps = {
  prefixes: readonly string[]
  suffix: string
}

export function RotatingHeroTitle({ prefixes, suffix }: RotatingHeroTitleProps) {
  const [prefixIndex, setPrefixIndex] = useState(0)
  const [isChanging, setIsChanging] = useState(false)
  const pauseStepRef = useRef(0)

  useEffect(() => {
    if (prefixes.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const pauseTimer = window.setTimeout(
      () => setIsChanging(true),
      INITIAL_PAUSE_MS + pauseStepRef.current * PAUSE_INCREMENT_MS,
    )

    return () => window.clearTimeout(pauseTimer)
  }, [prefixIndex, prefixes.length])

  useEffect(() => {
    if (!isChanging) {
      return
    }

    const transitionTimer = window.setTimeout(() => {
      setPrefixIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % prefixes.length
        pauseStepRef.current = nextIndex === 0 ? 0 : pauseStepRef.current + 1
        return nextIndex
      })
      setIsChanging(false)
    }, TRANSITION_MS)

    return () => window.clearTimeout(transitionTimer)
  }, [isChanging, prefixes.length])

  const currentPrefix = prefixes[prefixIndex] ?? ""
  const accessibleTitle = `${prefixes[0] ?? ""} ${suffix}`.trim()

  return (
    <h1 className="mt-6 w-full min-w-0 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
      <span className="sr-only">{accessibleTitle}</span>
      <span aria-hidden="true" className="block min-w-0">
        <span className="grid min-h-[2.04em] min-w-0 content-end sm:min-h-[2.04em]">
          <span
            className={`block text-[var(--marketing-accent)] transition-[opacity,transform,filter] duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
              isChanging ? "translate-y-3 opacity-0 blur-[2px]" : "translate-y-0 opacity-100 blur-0"
            }`}
          >
            {currentPrefix}
          </span>
        </span>
        <span className="block">{suffix}</span>
      </span>
    </h1>
  )
}
