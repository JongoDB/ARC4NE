"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { AlertCircle, Calendar, Monitor, Network, User, HardDrive, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface AgentDetails {
  id: string
  name: string
  os_type?: string
  hostname?: string
  ip_address?: string
  status?: string
  last_seen?: string
  agent_version?: string
  tags?: string[]
  created_at?: string
  beacon_interval_seconds?: number
}

interface AgentDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string | null
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

export function AgentDetailsModal({ open, onOpenChange, agentId }: AgentDetailsModalProps) {
  const [agent, setAgent] = useState<AgentDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && agentId) {
      fetchAgentDetails()
    }
  }, [open, agentId])

  const fetchAgentDetails = async () => {
    if (!agentId) return

    setLoading(true)
    setError(null)

    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents/${agentId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch agent details: ${response.statusText}`)
      }

      const agentData = await response.json()
      setAgent(agentData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent details")
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      return `${formatDistanceToNow(new Date(dateString))} ago`
    } catch {
      return "Invalid date"
    }
  }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Agent Details</DialogTitle>
          <DialogDescription>Detailed information about the selected agent</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {agent && !loading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{agent.name}</h3>
              <Badge variant={getStatusVariant(agent.status)}>
                {agent.status === "idle" ? "online" : agent.status || "Unknown"}
              </Badge>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Agent ID</p>
                  <p className="text-sm text-muted-foreground font-mono">{agent.id}</p>
                </div>
              </div>

              {agent.hostname && (
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Hostname</p>
                    <p className="text-sm text-muted-foreground">{agent.hostname}</p>
                  </div>
                </div>
              )}

              {agent.os_type && (
                <div className="flex items-center gap-3">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Operating System</p>
                    <p className="text-sm text-muted-foreground">{agent.os_type}</p>
                  </div>
                </div>
              )}

              {agent.ip_address && (
                <div className="flex items-center gap-3">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">IP Address</p>
                    <p className="text-sm text-muted-foreground">{agent.ip_address}</p>
                  </div>
                </div>
              )}

              {agent.agent_version && (
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Agent Version</p>
                    <p className="text-sm text-muted-foreground">{agent.agent_version}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Beacon Interval</p>
                  <p className="text-sm text-muted-foreground">
                    {agent.beacon_interval_seconds || 60} seconds
                    <span className="text-xs ml-2">(offline after {(agent.beacon_interval_seconds || 60) * 3}s)</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Seen</p>
                  <p className="text-sm text-muted-foreground">{formatTime(agent.last_seen)}</p>
                </div>
              </div>

              {agent.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Registered</p>
                    <p className="text-sm text-muted-foreground">{formatTime(agent.created_at)}</p>
                  </div>
                </div>
              )}

              {agent.tags && agent.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <Label className="text-sm font-medium">Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {agent.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
