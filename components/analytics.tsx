"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Users, Building2 } from "lucide-react"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Database, Tables } from "@/types/supabase"

type MonthlyStats = Tables<"monthly_network_stats">

type FormattedStats = {
  month: string
  total_funds: number
  project_count: number
  user_count: number
  avg_salary: number
}

export default function Analytics() {
  const [stats, setStats] = useState<FormattedStats[]>([])
  const [loading, setLoading] = useState(true)
  const [latestStats, setLatestStats] = useState<FormattedStats | null>(null)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from("monthly_network_stats").select("*").order("year").order("month")

        if (error) throw error

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

        const formattedStats = data.map((stat) => ({
          month: monthNames[stat.month - 1],
          total_funds: stat.total_funds,
          project_count: stat.project_count,
          user_count: stat.user_count,
          avg_salary: stat.avg_salary,
        }))

        setStats(formattedStats)

        if (formattedStats.length > 0) {
          setLatestStats(formattedStats[formattedStats.length - 1])
        }
      } catch (err) {
        console.error("Error loading analytics data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [supabase])

  return (
    <section className="py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Ecosystem Analytics</h2>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Track the growth and impact of the FundLoop network state
          </p>
        </div>
        <Button asChild className="mt-4 md:mt-0">
          <Link href="/analytics">View Detailed Analytics</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Funds Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <DollarSign className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div className="text-2xl font-bold">${latestStats?.total_funds.toLocaleString()}</div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  From {stats.length} months of contributions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Building2 className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div className="text-2xl font-bold">{latestStats?.project_count}</div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Projects that have taken the 1% pledge
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Citizen Salary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <div className="text-2xl font-bold">${latestStats?.avg_salary.toFixed(2)}</div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Per user per month</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Network Growth</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <ChartContainer
              config={{
                funds: {
                  label: "Total Funds ($)",
                  color: "hsl(var(--chart-1))",
                },
                users: {
                  label: "Users",
                  color: "hsl(var(--chart-2))",
                },
                salary: {
                  label: "Citizen Salary ($)",
                  color: "hsl(var(--chart-3))",
                },
              }}
            >
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="total_funds"
                    stroke="var(--color-funds)"
                    name="Total Funds"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="user_count"
                    stroke="var(--color-users)"
                    name="Users"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avg_salary"
                    stroke="var(--color-salary)"
                    name="Citizen Salary"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
