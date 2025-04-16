"use client"

import { CardDescription } from "@/components/ui/card"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Users, Building2, ArrowLeft } from "lucide-react"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Database } from "@/types/supabase"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FF6B6B"]

const generateDummyData = (count: number) => {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      name: `Item ${i + 1}`,
      value: Math.floor(Math.random() * 100),
    })
  }
  return data
}

const dummyLineData = generateDummyData(12)

interface MonthlyStats {
  month: string
  total_funds: number
  project_count: number
  user_count: number
  avg_salary: number
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
  const [stats, setStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [latestStats, setLatestStats] = useState<MonthlyStats | null>(null)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from("monthly_network_stats").select("*").order("year").order("month")

        if (error) throw error

        setStats(data || [])

        if (data && data.length > 0) {
          setLatestStats(data[data.length - 1])
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
        <p className="text-red-600">This is all dummy data for now.</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Network Growth</CardTitle>
          <CardDescription>Users and projects growth over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ChartContainer
            config={{
              users: {
                label: "Users",
                color: "hsl(var(--chart-1))",
              },
              projects: {
                label: "Projects",
                color: "hsl(var(--chart-2))",
              },
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dummyLineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="var(--chart-1)" name="Users" strokeWidth={2} />
                <Line type="monotone" dataKey="value" stroke="var(--chart-2)" name="Projects" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
