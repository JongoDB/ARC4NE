"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"
import { createTask } from "@/lib/api"
import type { AgentInfo } from "@/lib/types"

interface TaskAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: AgentInfo[]
  selectedAgentId?: string
  onTaskCreated: () => void
}

// Helper function to normalize status display
const getDisplayStatus = (status: string): string => {
  switch (status.toLowerCase()) {
    case "idle":
      return "online"
    case "processing":
      return "processing"
    case "offline":
      return "offline"
    default:
      return status
  }
}

export function TaskAssignmentModal({
  open,
  onOpenChange,
  agents,
  selectedAgentId,
  onTaskCreated,
}: TaskAssignmentModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    agent_id: selectedAgentId || "",
    type: "execute_command",
    command: "",
    description: "",
    timeout_seconds: "300",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload: Record<string, any> = {}

      if (formData.type === "execute_command") {
        payload.command = formData.command
      }

      await createTask({
        agent_id: formData.agent_id,
        type: formData.type,
        payload,
        description: formData.description || undefined,
        timeout_seconds: Number.parseInt(formData.timeout_seconds),
      })

      setSuccess(true)
      setTimeout(() => {
        handleClose()
        onTaskCreated()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      agent_id: selectedAgentId || "",
      type: "execute_command",
      command: "",
      description: "",
      timeout_seconds: "300",
    })
    setError(null)
    setSuccess(false)
    onOpenChange(false)
  }

  // Filter for online agents (including those marked as 'idle' which should be treated as online)
  const onlineAgents = agents.filter(
    (agent) => agent.status === "online" || agent.status === "idle" || agent.status === "processing",
  )

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Task Created Successfully
            </DialogTitle>
            <DialogDescription>
              The task has been queued and will be executed by the agent on its next beacon.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Task to Agent</DialogTitle>
          <DialogDescription>Create a new task to be executed by the selected agent.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent">Target Agent *</Label>
            <Select
              value={formData.agent_id}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, agent_id: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {onlineAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} ({getDisplayStatus(agent.status)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onlineAgents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No online agents available. Agents must be online to receive tasks.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Task Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="execute_command">Execute Command</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.type === "execute_command" && (
            <div className="space-y-2">
              <Label htmlFor="command">Command *</Label>
              <Textarea
                id="command"
                value={formData.command}
                onChange={(e) => setFormData((prev) => ({ ...prev, command: e.target.value }))}
                placeholder="e.g., ls -la, whoami, ps aux"
                required
                rows={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this task"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (seconds)</Label>
            <Input
              id="timeout"
              type="number"
              value={formData.timeout_seconds}
              onChange={(e) => setFormData((prev) => ({ ...prev, timeout_seconds: e.target.value }))}
              min="1"
              max="3600"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || onlineAgents.length === 0 || !formData.agent_id}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
