"use client"

import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react"

const nodes = [
  { label: "Projects", x: 18, y: 24, size: "lg", tone: "accent" },
  { label: "People", x: 52, y: 16, size: "md", tone: "moss" },
  { label: "Proof", x: 80, y: 28, size: "sm", tone: "accent" },
  { label: "Payouts", x: 22, y: 67, size: "sm", tone: "ink" },
  { label: "Treasury", x: 54, y: 56, size: "xl", tone: "accent" },
  { label: "Growth", x: 78, y: 72, size: "md", tone: "moss" },
] as const

const links = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 4],
  [3, 4],
  [4, 5],
  [2, 4],
] as const

const toneClasses = {
  accent: "border-[rgba(204,92,44,0.4)] bg-[rgba(204,92,44,0.14)] text-[var(--marketing-ink)]",
  moss: "border-[rgba(99,112,86,0.36)] bg-[rgba(99,112,86,0.14)] text-[var(--marketing-ink)]",
  ink: "border-[rgba(22,33,33,0.18)] bg-[rgba(255,248,238,0.72)] text-[var(--marketing-ink)] dark:text-[var(--marketing-paper)]",
} as const

const dotClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
} as const

export function NetworkConstellation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const pendingOffsetRef = useRef({ x: 0, y: 0 })

  const applyOffset = () => {
    frameRef.current = null

    if (!containerRef.current) {
      return
    }

    containerRef.current.style.setProperty("--constellation-offset-x", `${pendingOffsetRef.current.x}px`)
    containerRef.current.style.setProperty("--constellation-offset-y", `${pendingOffsetRef.current.y}px`)
  }

  const queueOffsetUpdate = (x: number, y: number) => {
    pendingOffsetRef.current = { x, y }

    if (frameRef.current !== null) {
      return
    }

    frameRef.current = window.requestAnimationFrame(applyOffset)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const nextX = ((event.clientX - rect.left) / rect.width - 0.5) * 20
    const nextY = ((event.clientY - rect.top) / rect.height - 0.5) * 20

    queueOffsetUpdate(nextX, nextY)
  }

  const resetOffset = () => queueOffsetUpdate(0, 0)

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative aspect-[5/4] min-h-[22rem] overflow-hidden rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(180deg,rgba(255,248,238,0.76),rgba(248,238,223,0.48))] p-6 shadow-[0_40px_120px_rgba(15,23,23,0.12)] dark:bg-[linear-gradient(180deg,rgba(18,27,25,0.92),rgba(10,18,17,0.84))]"
      onPointerLeave={resetOffset}
      onPointerMove={handlePointerMove}
      style={
        {
          "--constellation-offset-x": "0px",
          "--constellation-offset-y": "0px",
        } as CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(204,92,44,0.22),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(120,138,101,0.18),transparent_28%),radial-gradient(circle_at_55%_75%,rgba(255,214,144,0.18),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(22,33,33,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(22,33,33,0.07)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-35 dark:opacity-20" />

      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={{
          transform:
            "translate(calc(var(--constellation-offset-x) * 0.32), calc(var(--constellation-offset-y) * 0.32))",
        }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {links.map(([from, to]) => (
            <line
              key={`${from}-${to}`}
              x1={nodes[from].x}
              y1={nodes[from].y}
              x2={nodes[to].x}
              y2={nodes[to].y}
              stroke="rgba(22,33,33,0.22)"
              strokeDasharray="4 5"
              strokeWidth="0.7"
            />
          ))}
        </svg>
      </div>

      <div
        className="absolute inset-0 animate-[constellation-float_18s_ease-in-out_infinite] transition-transform duration-500 ease-out"
        style={{
          transform:
            "translate(calc(var(--constellation-offset-x) * -0.28), calc(var(--constellation-offset-y) * -0.28))",
        }}
      >
        {nodes.map((node, index) => {
          const style = {
            left: `${node.x}%`,
            top: `${node.y}%`,
            animationDelay: `${index * 180}ms`,
          } satisfies CSSProperties

          return (
            <div key={node.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={style}>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex ${dotClasses[node.size]} animate-[constellation-pulse_8s_ease-in-out_infinite] rounded-full border border-white/50 bg-[var(--marketing-accent)] shadow-[0_0_0_10px_rgba(204,92,44,0.08)]`}
                />
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur-sm ${toneClasses[node.tone]}`}
                >
                  {node.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-4 left-4 z-10 max-w-[13rem] rounded-[1.25rem] border border-[color:var(--marketing-line)] bg-[rgba(243,235,221,0.9)] p-4 shadow-[0_18px_50px_rgba(15,23,23,0.12)] backdrop-blur-md sm:bottom-6 sm:left-6 sm:max-w-[15rem] dark:bg-[rgba(13,21,21,0.84)]">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
          Network Thesis
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--marketing-muted-strong)]">
          Projects feed the loop, people deepen the signal, and value returns with more context than a single app can
          see alone.
        </p>
      </div>
    </div>
  )
}
