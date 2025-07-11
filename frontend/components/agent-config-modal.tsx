"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Settings } from "lucide-react"

interface AgentConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string | null
  agentName: string | null
  currentBeaconInterval?: number
  onConfigUpdated: () => void
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

export function AgentConfigModal({
  open,
  onOpenChange,
  agentId,
  agentName,
  currentBeaconInterval = 60,
  onConfigUpdated,
}: AgentConfigModalProps) {
  const [beaconInterval, setBeaconInterval] = useState(currentBeaconInterval)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setBeaconInterval(currentBeaconInterval)
      setError(null)
      setSuccess(null)
    }
  }, [open, currentBeaconInterval])

  const handleSave = async () => {
    if (!agentId) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents/${agentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          beacon_interval_seconds: beaconInterval,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Failed to update configuration: ${response.statusText}`)
      }

      const result = await response.json()
      setSuccess(result.message || "Configuration updated successfully")
      onConfigUpdated()

      // Close modal after a short delay
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update configuration")
    } finally {
      setLoading(false)
    }
  }

  const isValidInterval = beaconInterval >= 10 && beaconInterval <= 3600
  const hasChanges = beaconInterval !== currentBeaconInterval

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agent Configuration
          </DialogTitle>
          <DialogDescription>
            Configure settings for agent: <strong>{agentName || "Unknown Agent"}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription className="text-green-600">{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="beacon-interval">Beacon Interval (seconds)</Label>
              <Input
                id="beacon-interval"
                type="number"
                min="10"
                max="3600"
                value={beaconInterval}
                onChange={(e) => setBeaconInterval(Number.parseInt(e.target.value) || 60)}
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">
                How often the agent reports back to the server (10-3600 seconds)
              </p>
              {!isValidInterval && (
                <p className="text-sm text-destructive">Beacon interval must be between 10 and 3600 seconds</p>
              )}
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Current Settings:</h4>
              <div className="text-sm space-y-1">
                <div>
                  Beacon Interval: <span className="font-mono">{currentBeaconInterval}s</span>
                </div>
                <div>
                  Offline Timeout: <span className="font-mono">{currentBeaconInterval * 3}s</span> (3x beacon interval)
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium mb-2 text-blue-800">💡 Configuration Tips:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Lower intervals = more responsive but more network traffic</li>
                <li>• Higher intervals = less traffic but slower detection of issues</li>
                <li>• Agent will be marked offline after 3x the beacon interval</li>
                <li>• Changes take effect on the agent's next beacon</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !isValidInterval || !hasChanges}>
            {loading ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
