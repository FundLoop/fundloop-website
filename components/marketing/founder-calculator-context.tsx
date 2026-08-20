"use client"

import React, { createContext, useContext, useMemo, useState } from "react"

export interface FounderCalculatorState {
  // Growth Economics Inputs
  startingUsers: number
  setStartingUsers: (v: number) => void
  startingMau: number
  setStartingMau: (v: number) => void
  monthlyAdBudget: number
  setMonthlyAdBudget: (v: number) => void
  newUsersFromAds: number
  setNewUsersFromAds: (v: number) => void
  arpu: number
  setArpu: (v: number) => void

  // Growth Economics Derived
  startingMauRate: number
  newActiveUsersFromAds: number
  traditionalTotalMau: number
  traditionalGrowthPct: number
  effectiveCAC: number
  fundLoopGiveBackPerStartingUser: number
  fundLoopReach: number
  fundLoopVisits: number
  fundLoopSignups: number
  fundLoopTotalUsers: number
  fundLoopMauRate: number
  fundLoopTotalMau: number
  fundLoopGrowthPct: number

  // Runtime Moat Inputs
  runtimeMau: number
  setRuntimeMau: (v: number) => void
  sharePct: number
  setSharePct: (v: number) => void

  // Runtime Moat Derived
  competitorChurnRate: number
  competitorChurnCount: number
  targetUsersToKeepUp: number
  competitorAdSpend: number
  grossRevenue: number
  competitorRetained: number
  fundLoopMonth1Mau: number
  fundLoopMonth1GrossRevenue: number
  giveBackTotal: number
  giveBackPerUser: string
  fundLoopRetained: number
  monthlyAdvantage: number
  annualAdvantage: number
}

const FounderCalculatorContext = createContext<FounderCalculatorState | null>(null)

function useComputeCalculatorState(
  startingUsers: number,
  setStartingUsers: (v: number) => void,
  startingMau: number,
  setStartingMau: (v: number) => void,
  monthlyAdBudget: number,
  setMonthlyAdBudget: (v: number) => void,
  newUsersFromAds: number,
  setNewUsersFromAds: (v: number) => void,
  arpu: number,
  setArpu: (v: number) => void,
  runtimeMau: number,
  setRuntimeMau: (v: number) => void,
  sharePct: number,
  setSharePct: (v: number) => void
): FounderCalculatorState {
  return useMemo<FounderCalculatorState>(() => {
    const startingMauRate = startingUsers > 0 ? startingMau / startingUsers : 0.2
    const newActiveUsersFromAds = Math.max(1, Math.round(newUsersFromAds * startingMauRate))
    const traditionalTotalMau = startingMau + newActiveUsersFromAds
    const traditionalGrowthPct = startingMau > 0 ? Math.round((newActiveUsersFromAds / startingMau) * 100) : 0
    const effectiveCAC = newActiveUsersFromAds > 0 ? monthlyAdBudget / newActiveUsersFromAds : 25
    const fundLoopGiveBackPerStartingUser = startingMau > 0 ? monthlyAdBudget / startingMau : 5

    const fundLoopReach = 10000
    const fundLoopVisits = Math.round(fundLoopReach * 0.70)
    const fundLoopSignups = Math.round(fundLoopReach * 0.20)
    const fundLoopTotalUsers = startingUsers + fundLoopSignups
    // Assumption: MAU rate increases by +10% absolute boost (+50% relative bump from 20% to 30%)
    const fundLoopMauRate = Math.min(1, startingMauRate + 0.10)
    const fundLoopTotalMau = Math.round(fundLoopTotalUsers * fundLoopMauRate)
    const fundLoopGrowthPct = startingMau > 0 ? Math.round(((fundLoopTotalMau - startingMau) / startingMau) * 100) : 0

    // Runtime Moat Math
    // Competitor churn to your project = half of the FundLoop Give-Back Share (e.g. 10% give back -> 5% churn)
    const competitorChurnRate = sharePct / 2
    const competitorChurnCount = Math.round(runtimeMau * (competitorChurnRate / 100))

    // Target to keep up with your project:
    // Your project grows to runtimeMau + competitorChurnCount.
    // Competitor drops to runtimeMau - competitorChurnCount.
    // To match your project end-state count, competitor must acquire 2 * competitorChurnCount users.
    const targetUsersToKeepUp = competitorChurnCount * 2
    const fundLoopMonth1Mau = runtimeMau + competitorChurnCount
    const fundLoopMonth1GrossRevenue = fundLoopMonth1Mau * arpu
    const competitorAdSpend = Math.round(targetUsersToKeepUp * effectiveCAC)
    // Compare both projects at the same month-one ending MAU. The competitor
    // buys enough users to catch up, so its revenue must include those users.
    const grossRevenue = fundLoopMonth1GrossRevenue
    const competitorRetained = Math.max(0, grossRevenue - competitorAdSpend)
    const giveBackTotal = Math.round(fundLoopMonth1GrossRevenue * (sharePct / 100))
    const giveBackPerUser = fundLoopMonth1Mau > 0 ? (giveBackTotal / fundLoopMonth1Mau).toFixed(2) : "0.00"
    const fundLoopRetained = fundLoopMonth1GrossRevenue - giveBackTotal
    const monthlyAdvantage = fundLoopRetained - competitorRetained
    const annualAdvantage = monthlyAdvantage * 12

    return {
      startingUsers,
      setStartingUsers,
      startingMau,
      setStartingMau,
      monthlyAdBudget,
      setMonthlyAdBudget,
      newUsersFromAds,
      setNewUsersFromAds,
      arpu,
      setArpu,

      startingMauRate,
      newActiveUsersFromAds,
      traditionalTotalMau,
      traditionalGrowthPct,
      effectiveCAC,
      fundLoopGiveBackPerStartingUser,
      fundLoopReach,
      fundLoopVisits,
      fundLoopSignups,
      fundLoopTotalUsers,
      fundLoopMauRate,
      fundLoopTotalMau,
      fundLoopGrowthPct,

      runtimeMau,
      setRuntimeMau,
      sharePct,
      setSharePct,

      competitorChurnRate,
      competitorChurnCount,
      targetUsersToKeepUp,
      competitorAdSpend,
      grossRevenue,
      competitorRetained,
      fundLoopMonth1Mau,
      fundLoopMonth1GrossRevenue,
      giveBackTotal,
      giveBackPerUser,
      fundLoopRetained,
      monthlyAdvantage,
      annualAdvantage,
    }
  }, [startingUsers, startingMau, monthlyAdBudget, newUsersFromAds, arpu, runtimeMau, sharePct, setStartingUsers, setStartingMau, setMonthlyAdBudget, setNewUsersFromAds, setArpu, setRuntimeMau, setSharePct])
}

export function FounderCalculatorProvider({ children }: { children: React.ReactNode }) {
  const [startingUsers, setStartingUsers] = useState<number>(1000)
  const [startingMau, setStartingMau] = useState<number>(200)
  const [monthlyAdBudget, setMonthlyAdBudget] = useState<number>(1000)
  const [newUsersFromAds, setNewUsersFromAds] = useState<number>(200)
  const [arpu, setArpu] = useState<number>(50)
  const [runtimeMau, setRuntimeMau] = useState<number>(1000)
  const [sharePct, setSharePct] = useState<number>(10)

  const value = useComputeCalculatorState(
    startingUsers,
    setStartingUsers,
    startingMau,
    setStartingMau,
    monthlyAdBudget,
    setMonthlyAdBudget,
    newUsersFromAds,
    setNewUsersFromAds,
    arpu,
    setArpu,
    runtimeMau,
    setRuntimeMau,
    sharePct,
    setSharePct
  )

  return (
    <FounderCalculatorContext.Provider value={value}>
      {children}
    </FounderCalculatorContext.Provider>
  )
}

function useFallbackFounderCalculatorState(): FounderCalculatorState {
  const [startingUsers, setStartingUsers] = useState<number>(1000)
  const [startingMau, setStartingMau] = useState<number>(200)
  const [monthlyAdBudget, setMonthlyAdBudget] = useState<number>(1000)
  const [newUsersFromAds, setNewUsersFromAds] = useState<number>(200)
  const [arpu, setArpu] = useState<number>(50)
  const [runtimeMau, setRuntimeMau] = useState<number>(1000)
  const [sharePct, setSharePct] = useState<number>(10)

  return useComputeCalculatorState(
    startingUsers,
    setStartingUsers,
    startingMau,
    setStartingMau,
    monthlyAdBudget,
    setMonthlyAdBudget,
    newUsersFromAds,
    setNewUsersFromAds,
    arpu,
    setArpu,
    runtimeMau,
    setRuntimeMau,
    sharePct,
    setSharePct
  )
}

export function useFounderCalculator(): FounderCalculatorState {
  const context = useContext(FounderCalculatorContext)
  const fallback = useFallbackFounderCalculatorState()
  return context ?? fallback
}
