"use client"

// TODO(Session 03 IA): this is a transitional public reporting preview; fold it into the future `/reports` transparency surface described in `docs/engineering/information-architecture.md`.

import { CardDescription } from "@/components/ui/card"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Users, Building2, ArrowLeft } from "lucide-react"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
})

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const formatMonthLabel = (year: number, month: number) =>
  monthLabelFormatter.format(new Date(year, month - 1, 1))

const createFallbackNetworkGrowthData = () => {
  return Array.from({ length: 12 }, (_, index) => {
    const offset = 11 - index
    const date = new Date()
    date.setMonth(date.getMonth() - offset)

    const step = index + 1
    const avgSalary = 1800 + step * 140

    return {
      name: formatMonthLabel(date.getFullYear(), date.getMonth() + 1),
      users: 120 + step * 24,
      projects: 8 + step * 3,
      funds: 32000 + step * 12500,
      salary_min: Math.max(0, avgSalary * 0.6),
      salary_avg: avgSalary,
      salary_max: avgSalary * 1.45,
    }
  })
}

const fallbackNetworkGrowthData = createFallbackNetworkGrowthData()

interface MonthlyStats {
  id: number
  month: number
  year: number
  total_funds: number
  project_count: number
  user_count: number
  avg_salary: number
  created_at: string | null
  updated_at: string | null
}

interface StatCardProps {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  trend: "up" | "down" | "stable"
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={`
             rounded-full p-1
             ${trend === "up" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
             ${trend === "down" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : ""}
             ${trend === "stable" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : ""}
           `}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<MonthlyStats[]>([])
  const [latestStats, setLatestStats] = useState<MonthlyStats | null>(null)
  const getSupabase = () => getSupabaseBrowserClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  const networkGrowthData =
    stats.length > 0
      ? stats.map((stat) => ({
          name: formatMonthLabel(stat.year, stat.month),
          users: stat.user_count,
          projects: stat.project_count,
          funds: stat.total_funds,
          salary_min: Math.max(0, stat.avg_salary * 0.6),
          salary_avg: stat.avg_salary,
          salary_max: stat.avg_salary * 1.45,
        }))
      : fallbackNetworkGrowthData

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = getSupabase()
      try {
        const { data, error } = await supabase.from("monthly_network_stats").select("*").order("year").order("month")

        if (error) throw error

        setStats(data || [])

        if (data && data.length > 0) {
          setLatestStats(data[data.length - 1])
        }
      } catch (err) {
        console.error("Error loading analytics data:", err)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold">Ecosystem Analytics</h1>
        <p className="mt-2 text-sm italic text-red-600">
          Note: This is all dummy data for now. It&apos;s a vision for what could be.
        </p>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          Detailed metrics and insights about the FundLoop network state
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Funds Collected"
          value={`$${latestStats?.total_funds.toLocaleString() || "0"}`}
          description="From all months of contributions"
          icon={<DollarSign className="h-4 w-4" />}
          trend="up"
        />
        <StatCard
          title="Active Projects"
          value={latestStats?.project_count.toString() || "0"}
          description="Projects that have taken the 1% pledge"
          icon={<Building2 className="h-4 w-4" />}
          trend="up"
        />
        <StatCard
          title="Active Users"
          value={latestStats?.user_count.toLocaleString() || "0"}
          description="Users participating in the ecosystem"
          icon={<Users className="h-4 w-4" />}
          trend="up"
        />
        <StatCard
          title="Citizen Salary"
          value={`$${latestStats?.avg_salary.toFixed(2) || "0.00"}`}
          description="Per user per month"
          icon={<DollarSign className="h-4 w-4" />}
          trend="stable"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Projects in the network by month</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0">
            {mounted ? (
              <ChartContainer
                className="h-full w-full"
                config={{
                  projects: {
                    label: "Projects",
                    color: "hsl(var(--chart-2))",
                  },
                }}
              >
                <LineChart data={networkGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value: number) => compactNumberFormatter.format(value)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="projects" stroke="var(--color-projects)" name="Projects" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-slate-100 dark:bg-slate-900/40" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>People participating in FundLoop by month</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0">
            {mounted ? (
              <ChartContainer
                className="h-full w-full"
                config={{
                  users: {
                    label: "Users",
                    color: "hsl(var(--chart-1))",
                  },
                }}
              >
                <LineChart data={networkGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value: number) => compactNumberFormatter.format(value)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="users" stroke="var(--color-users)" name="Users" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-slate-100 dark:bg-slate-900/40" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funds Collected</CardTitle>
            <CardDescription>Total monthly funds flowing through the network</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0">
            {mounted ? (
              <ChartContainer
                className="h-full w-full"
                config={{
                  funds: {
                    label: "Funds Collected",
                    color: "hsl(var(--chart-3))",
                  },
                }}
              >
                <LineChart data={networkGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value: number) => compactCurrencyFormatter.format(value)} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-[12rem] items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {currencyFormatter.format(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line type="monotone" dataKey="funds" stroke="var(--color-funds)" name="Funds Collected" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-slate-100 dark:bg-slate-900/40" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Citizen Salary</CardTitle>
            <CardDescription>Monthly salary range and average per participant</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0">
            {mounted ? (
              <ChartContainer
                className="h-full w-full"
                config={{
                  salary_min: {
                    label: "Minimum",
                    color: "hsl(var(--chart-4))",
                  },
                  salary_avg: {
                    label: "Average",
                    color: "hsl(var(--chart-1))",
                  },
                  salary_max: {
                    label: "Maximum",
                    color: "hsl(var(--chart-5))",
                  },
                }}
              >
                <LineChart data={networkGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value: number) => compactCurrencyFormatter.format(value)} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-[12rem] items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {currencyFormatter.format(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="salary_min"
                    stroke="var(--color-salary_min)"
                    name="Minimum"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="salary_avg"
                    stroke="var(--color-salary_avg)"
                    name="Average"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="salary_max"
                    stroke="var(--color-salary_max)"
                    name="Maximum"
                    strokeWidth={2}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-slate-100 dark:bg-slate-900/40" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
