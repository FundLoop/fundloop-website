"use client"

import type { CSSProperties } from "react"

type MonthlyLoopVisualProps = {
  monthLabel: string
  centerLabel: string
  stages: string[]
}

const positions = [
  { left: "50%", top: "5%" },
  { left: "82%", top: "20%" },
  { left: "94%", top: "51%" },
  { left: "76%", top: "82%" },
  { left: "34%", top: "91%" },
  { left: "5%", top: "67%" },
  { left: "10%", top: "27%" },
] as const

export function MonthlyLoopVisual({ monthLabel, centerLabel, stages }: MonthlyLoopVisualProps) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[44rem]" aria-label={centerLabel}>
      <div className="absolute inset-[13%] rounded-full border border-dashed border-white/18 animate-[spin_50s_linear_infinite] motion-reduce:animate-none" />
      <div className="absolute inset-[24%] rounded-full border border-white/12" />
      <div className="absolute inset-[31%] hidden flex-col items-center justify-center rounded-full bg-[#fff9ef] px-6 py-4 text-center text-[#101b1a] shadow-[0_0_100px_rgba(224,107,64,0.2)] lg:flex">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-[#a74727]">{monthLabel}</span>
        <span className="mt-2 max-w-[13rem] font-display text-[clamp(1.1rem,1.8vw,1.65rem)] font-bold leading-[1.1] tracking-[-0.03em]">{centerLabel}</span>
      </div>
      {stages.slice(0, 7).map((stage, index) => (
        <div
          key={`${index}-${stage}`}
          className="absolute z-10 w-[8.5rem] -translate-x-1/2 -translate-y-1/2 animate-[loop-node-pulse_6s_ease-in-out_infinite] text-center motion-reduce:animate-none sm:w-[10rem]"
          style={{ ...positions[index], animationDelay: `${index * 420}ms` } as CSSProperties}
        >
          <span className="mx-auto block h-2.5 w-2.5 rounded-full bg-[#ef7950] shadow-[0_0_0_7px_rgba(239,121,80,0.12)]" />
          <span className="mt-3 hidden text-[0.6rem] font-semibold uppercase leading-4 tracking-[0.16em] text-[#dbe3df] lg:block lg:text-[0.67rem]">{stage}</span>
        </div>
      ))}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.35" />
        <path d="M49 13 A37 37 0 0 1 84 39" fill="none" stroke="#ef7950" strokeLinecap="round" strokeWidth="0.8" className="animate-[loop-dash_5s_ease-in-out_infinite] motion-reduce:animate-none" />
      </svg>
    </div>
  )
}
