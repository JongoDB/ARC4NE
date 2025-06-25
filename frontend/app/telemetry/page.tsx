"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Activity } from "lucide-react"
import { AgentTelemetryDashboard } from "@/components/agent-telemetry-dashboard"
import type { AgentInfo } from "@/lib/types"

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

export default function TelemetryPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  const fetchAgents = async () => {
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents`)

      if (response.ok) {
        const agentsData = await response.json()
        setAgents(agentsData)

        // Auto-select first online agent
        const onlineAgent = agentsData.find(
          (agent: AgentInfo) => agent.status === "online" || agent.status === "idle" || agent.status === "processing",
        )
        if (onlineAgent && !selectedAgentId) {
          setSelectedAgentId(onlineAgent.id)
        }
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId)
  const onlineAgents = agents.filter(
    (agent) => agent.status === "online" || agent.status === "idle" || agent.status === "processing",
  )

  if (loading) {
    return (
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-xl font-semibold">Telemetry</h1>
        </header>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading agents...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Telemetry</h1>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {onlineAgents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="px-4 sm:px-6">
        {onlineAgents.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                No Active Agents
              </CardTitle>
              <CardDescription>No agents are currently online to display telemetry data.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Agents need to be online and beaconing to collect telemetry data. Check your agent configurations and
                ensure they can reach the server.
              </p>
            </CardContent>
          </Card>
        ) : !selectedAgentId ? (
          <Card>
            <CardHeader>
              <CardTitle>Select an Agent</CardTitle>
              <CardDescription>Choose an agent from the dropdown above to view its telemetry data.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {onlineAgents.length} agent{onlineAgents.length !== 1 ? "s" : ""} available for telemetry monitoring.
              </p>
            </CardContent>
          </Card>
        ) : selectedAgent ? (
          <AgentTelemetryDashboard agentId={selectedAgentId} agentName={selectedAgent.name} />
        ) : null}
      </div>
    </div>
  )
}
