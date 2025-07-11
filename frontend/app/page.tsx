"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Clock, CheckCircle, Users, Activity } from "lucide-react"
import Link from "next/link"
import type { AgentInfo, TaskInfo } from "@/lib/types"

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1`
  }
  return "/api/v1"
}

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
  if (typeof window !== "undefined" && (window as any).__authRequest) {
    return (window as any).__authRequest(url, options)
  }
  return fetch(url, { ...options, credentials: "include" })
}

async function getDashboardData(): Promise<{ agents: AgentInfo[]; tasks: TaskInfo[] }> {
  try {
    const apiBaseUrl = getApiBaseUrl()
    const [agentsResponse, tasksResponse] = await Promise.all([
      makeAuthenticatedRequest(`${apiBaseUrl}/agents`),
      makeAuthenticatedRequest(`${apiBaseUrl}/tasks`),
    ])

    const agents = agentsResponse.ok ? await agentsResponse.json() : []
    const tasks = tasksResponse.ok ? await tasksResponse.json() : []

    return { agents, tasks }
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error)
    return { agents: [], tasks: [] }
  }
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const { agents: agentsData, tasks: tasksData } = await getDashboardData()
      setAgents(agentsData)
      setTasks(tasksData)
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => fetchData(true)

  // Calculate statistics
  const activeAgents = agents.filter(
    (agent: AgentInfo) => agent.status === "online" || agent.status === "idle" || agent.status === "processing",
  ).length
  const offlineAgents = agents.filter((agent: AgentInfo) => agent.status === "offline").length
  const completedTasks = tasks.filter((task: TaskInfo) => task.status === "completed").length
  const failedTasks = tasks.filter((task: TaskInfo) => task.status === "failed" || task.status === "timed_out").length

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case "online":
      case "idle":
      case "processing":
        return "default"
      case "offline":
        return "secondary"
      case "error":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getDisplayStatus = (status?: string) => {
    return status === "idle" ? "online" : status || "Unknown"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <div className="grid gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgents}</div>
            <p className="text-xs text-muted-foreground">Agents that have beaconed recently</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offlineAgents}</div>
            <p className="text-xs text-muted-foreground">Agents that have missed beacons</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted-foreground">Successfully executed tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedTasks}</div>
            <p className="text-xs text-muted-foreground">Tasks that failed or timed out</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 px-4 sm:px-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Agents</CardTitle>
            <CardDescription>Latest agent activity</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agents registered</p>
            ) : (
              <div className="space-y-3">
                {agents.slice(0, 5).map((agent: AgentInfo) => (
                  <div key={agent.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.os_type || "Unknown OS"}</p>
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(agent.status) as any}>{getDisplayStatus(agent.status)}</Badge>
                  </div>
                ))}
                {agents.length > 5 && (
                  <Link href="/agents">
                    <Button variant="outline" size="sm" className="w-full">
                      View All Agents
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Latest task execution results</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks executed</p>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map((task: TaskInfo) => (
                  <div key={task.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium font-mono">{task.id.substring(0, 8)}...</p>
                        <p className="text-xs text-muted-foreground">{task.agent_name || "Unknown Agent"}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        task.status === "completed"
                          ? "default"
                          : task.status === "failed" || task.status === "timed_out"
                            ? "destructive"
                            : "secondary"
                      }
                      as
                      any
                    >
                      {task.status}
                    </Badge>
                  </div>
                ))}
                {tasks.length > 5 && (
                  <Link href="/tasks">
                    <Button variant="outline" size="sm" className="w-full">
                      View All Tasks
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
