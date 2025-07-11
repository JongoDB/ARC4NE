"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Activity, HardDrive, Cpu, MemoryStick } from "lucide-react"
import { TelemetryChart } from "./telemetry-chart"

interface SystemMetrics {
  cpu_percent: number
  memory_percent: number
  disk_percent: number
  memory_total: number
  memory_used: number
  disk_total: number
  disk_used: number
  uptime: number
}

interface TelemetryEntry {
  agent_id: string
  agent_name: string
  timestamp: string
  metrics: Array<{
    system_metrics?: SystemMetrics
    [key: string]: any
  }>
}

interface AgentTelemetryDashboardProps {
  agentId: string
  agentName: string
}

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

export function AgentTelemetryDashboard({ agentId, agentName }: AgentTelemetryDashboardProps) {
  const [telemetryData, setTelemetryData] = useState<TelemetryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTelemetryData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const apiBaseUrl = getApiBaseUrl()
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents/${agentId}/telemetry?limit=50`)

      if (response.ok) {
        const data = await response.json()
        setTelemetryData(data)
      }
    } catch (error) {
      console.error("Failed to fetch telemetry data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTelemetryData()
    const interval = setInterval(() => fetchTelemetryData(true), 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [agentId])

  const handleRefresh = () => fetchTelemetryData(true)

  // Process telemetry data for charts
  const processMetricsForChart = (metricKey: keyof SystemMetrics) => {
    return telemetryData
      .filter((entry) => entry.metrics?.[0]?.system_metrics?.[metricKey] !== undefined)
      .map((entry) => ({
        timestamp: entry.timestamp,
        value: entry.metrics[0].system_metrics![metricKey] as number,
      }))
      .slice(-20) // Last 20 data points
  }

  const cpuData = processMetricsForChart("cpu_percent")
  const memoryData = processMetricsForChart("memory_percent")
  const diskData = processMetricsForChart("disk_percent")

  // Get latest metrics for summary cards
  const latestMetrics = telemetryData[0]?.metrics?.[0]?.system_metrics

  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes == null || isNaN(bytes) || bytes <= 0) {
      return "0 Bytes"
    }
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  const formatUptime = (seconds: number | null | undefined) => {
    // Handle null, undefined, NaN, or invalid values
    if (seconds == null || isNaN(seconds) || seconds < 0) {
      return "Unknown"
    }

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading telemetry data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Telemetry Dashboard</h2>
          <p className="text-muted-foreground">Real-time system metrics for {agentName}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {latestMetrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {latestMetrics.cpu_percent != null ? latestMetrics.cpu_percent.toFixed(1) : "0.0"}%
              </div>
              <Badge
                variant={
                  (latestMetrics.cpu_percent || 0) > 80
                    ? "destructive"
                    : (latestMetrics.cpu_percent || 0) > 60
                      ? "secondary"
                      : "default"
                }
              >
                {(latestMetrics.cpu_percent || 0) > 80
                  ? "High"
                  : (latestMetrics.cpu_percent || 0) > 60
                    ? "Medium"
                    : "Normal"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <MemoryStick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {latestMetrics.memory_percent != null ? latestMetrics.memory_percent.toFixed(1) : "0.0"}%
              </div>
              <p className="text-xs text-muted-foreground">
                {formatBytes(latestMetrics.memory_used)} / {formatBytes(latestMetrics.memory_total)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {latestMetrics.disk_percent != null ? latestMetrics.disk_percent.toFixed(1) : "0.0"}%
              </div>
              <p className="text-xs text-muted-foreground">
                {formatBytes(latestMetrics.disk_used)} / {formatBytes(latestMetrics.disk_total)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{formatUptime(latestMetrics.uptime)}</div>
              <p className="text-xs text-muted-foreground">Since last boot</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Telemetry Charts */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <TelemetryChart
          title="CPU Usage"
          description="Processor utilization over time"
          data={cpuData}
          dataKey="cpu_percent"
          color="#ef4444"
          unit="%"
          type="area"
        />

        <TelemetryChart
          title="Memory Usage"
          description="RAM utilization over time"
          data={memoryData}
          dataKey="memory_percent"
          color="#3b82f6"
          unit="%"
          type="area"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-1">
        <TelemetryChart
          title="Disk Usage"
          description="Storage utilization over time"
          data={diskData}
          dataKey="disk_percent"
          color="#f59e0b"
          unit="%"
          type="line"
          height={200}
        />
      </div>

      {telemetryData.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">No telemetry data available for this agent</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
