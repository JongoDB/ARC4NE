"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AgentRegistrationModal } from "@/components/agent-registration-modal"
import { AgentDetailsModal } from "@/components/agent-details-modal"
import { AgentConfigModal } from "@/components/agent-config-modal"
import { TaskAssignmentModal } from "@/components/task-assignment-modal"
import type { AgentInfo } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

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
  // Check if we're in the browser and have the auth function available
  if (typeof window !== "undefined" && (window as any).__authRequest) {
    return (window as any).__authRequest(url, options)
  }

  // Fallback for when auth is not available
  return fetch(url, {
    ...options,
    credentials: "include",
  })
}

async function getAgents(): Promise<AgentInfo[]> {
  try {
    const apiBaseUrl = getApiBaseUrl()
    const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`API Error (${response.status}): ${errorBody}`)
      return []
    }

    const data = await response.json()
    return data as AgentInfo[]
  } catch (error) {
    console.error("Failed to fetch agents:", error)
    return []
  }
}

async function refreshAgentsStatus(): Promise<{ offline_count: number; total_agents: number }> {
  try {
    const apiBaseUrl = getApiBaseUrl()
    const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh agents: ${response.statusText}`)
    }

    const data = await response.json()
    return { offline_count: data.offline_count, total_agents: data.total_agents }
  } catch (error) {
    console.error("Failed to refresh agents status:", error)
    throw error
  }
}

async function deleteAgent(agentId: string): Promise<void> {
  const apiBaseUrl = getApiBaseUrl()
  const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents/${agentId}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error(`Failed to delete agent: ${response.statusText}`)
  }
}

export function AgentsPageContent() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null)

  const fetchAgents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      const agentsData = await getAgents()
      setAgents(agentsData)
      setError(null)
    } catch (err) {
      setError("Failed to load agents")
      console.error("Error fetching agents:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAgents()

    // Refresh agents every 30 seconds
    const interval = setInterval(() => fetchAgents(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      // First trigger the offline check
      const refreshResult = await refreshAgentsStatus()
      console.log(
        `Refresh completed: ${refreshResult.offline_count} agents marked offline out of ${refreshResult.total_agents} total`,
      )

      // Then fetch the updated agent list
      await fetchAgents(false)
    } catch (err) {
      console.error("Error during refresh:", err)
      setError("Failed to refresh agent status")
    } finally {
      setRefreshing(false)
    }
  }

  const handleAgentRegistered = () => {
    // Refresh the agents list when a new agent is registered
    fetchAgents(true)
  }

  const handleTaskCreated = () => {
    // Refresh the agents list when a task is created
    fetchAgents(true)
  }

  const handleConfigUpdated = () => {
    // Refresh the agents list when configuration is updated
    fetchAgents(true)
  }

  const handleViewDetails = (agentId: string) => {
    setSelectedAgentId(agentId)
    setShowDetailsModal(true)
  }

  const handleEditConfig = (agent: AgentInfo) => {
    setSelectedAgent(agent)
    setSelectedAgentId(agent.id)
    setShowConfigModal(true)
  }

  const handleAssignTask = (agentId: string) => {
    setSelectedAgentId(agentId)
    setShowTaskModal(true)
  }

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`Are you sure you want to delete agent "${agentName}"? This action cannot be undone.`)) {
      return
    }

    setDeletingAgentId(agentId)
    try {
      await deleteAgent(agentId)
      await fetchAgents(true) // Refresh the list
    } catch (err) {
      alert(`Failed to delete agent: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setDeletingAgentId(null)
    }
  }

  const formatLastSeen = (dateString?: string | null) => {
    if (!dateString) return "Never"
    try {
      return `${formatDistanceToNow(new Date(dateString))} ago`
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case "online":
      case "idle": // Treat idle as online (agent is connected and ready)
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

  const isAgentAvailable = (status?: string) => {
    // Agent is available for tasks if it's online, idle, or processing
    return status === "online" || status === "idle" || status === "processing"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading agents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive mb-2">{error}</p>
          <Button onClick={() => fetchAgents()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Registered Agents</h2>
          <p className="text-sm text-muted-foreground">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Checking Status..." : "Refresh"}
          </Button>
          <Button onClick={() => setShowRegistrationModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Register New Agent
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No agents registered yet</p>
            <p className="text-sm text-muted-foreground mb-4">Register your first agent to get started</p>
            <Button onClick={() => setShowRegistrationModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Register New Agent
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Agent ID</TableHead>
                <TableHead className="hidden md:table-cell">OS</TableHead>
                <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                <TableHead className="hidden lg:table-cell">Beacon Interval</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(agent.status)}>
                      {agent.status === "idle" ? "online" : agent.status || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs font-mono">
                    {agent.id.toString().substring(0, 8)}...
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{agent.os_type || "N/A"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{agent.ip_address || "N/A"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="font-mono text-sm">{agent.beacon_interval_seconds || 60}s</span>
                  </TableCell>
                  <TableCell>{formatLastSeen(agent.last_seen)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                          disabled={deletingAgentId === agent.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleViewDetails(agent.id)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditConfig(agent)}>Edit Configuration</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleAssignTask(agent.id)}
                          disabled={!isAgentAvailable(agent.status)}
                        >
                          Assign Task
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteAgent(agent.id, agent.name)}
                          disabled={deletingAgentId === agent.id}
                        >
                          {deletingAgentId === agent.id ? "Deleting..." : "Remove Agent"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AgentRegistrationModal
        open={showRegistrationModal}
        onOpenChange={setShowRegistrationModal}
        onAgentRegistered={handleAgentRegistered}
      />

      <AgentDetailsModal open={showDetailsModal} onOpenChange={setShowDetailsModal} agentId={selectedAgentId} />

      <AgentConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        agentId={selectedAgentId}
        agentName={selectedAgent?.name || null}
        currentBeaconInterval={selectedAgent?.beacon_interval_seconds}
        onConfigUpdated={handleConfigUpdated}
      />

      <TaskAssignmentModal
        open={showTaskModal}
        onOpenChange={setShowTaskModal}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onTaskCreated={handleTaskCreated}
      />
    </>
  )
}
