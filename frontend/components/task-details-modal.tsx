"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertCircle, Calendar, Terminal, User, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface TaskDetails {
  id: string
  agent_id: string
  agent_name?: string
  type: string
  status: string
  description?: string
  created_at: string
  created_by_user_id?: string
  started_at?: string
  completed_at?: string
  payload?: Record<string, any>
  output?: string
  error_output?: string
  exit_code?: number
  timeout_seconds?: number
}

interface TaskDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
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

export function TaskDetailsModal({ open, onOpenChange, taskId }: TaskDetailsModalProps) {
  const [task, setTask] = useState<TaskDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails()
    }
  }, [open, taskId])

  const fetchTaskDetails = async () => {
    if (!taskId) return

    setLoading(true)
    setError(null)

    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/tasks/${taskId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch task details: ${response.statusText}`)
      }

      const taskData = await response.json()
      setTask(taskData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task details")
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "failed":
      case "timed_out":
        return "destructive"
      case "processing":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
          <DialogDescription>Detailed information about the selected task</DialogDescription>
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

        {task && !loading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold font-mono">{task.id.substring(0, 16)}...</h3>
              <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Agent</p>
                  <p className="text-sm text-muted-foreground">{task.agent_name || "Unknown Agent"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Task Type</p>
                  <p className="text-sm text-muted-foreground">{task.type}</p>
                </div>
              </div>

              {task.timeout_seconds && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Timeout</p>
                    <p className="text-sm text-muted-foreground">{task.timeout_seconds} seconds</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">{formatTime(task.created_at)}</p>
                </div>
              </div>

              {task.started_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Started</p>
                    <p className="text-sm text-muted-foreground">{formatTime(task.started_at)}</p>
                  </div>
                </div>
              )}

              {task.completed_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Completed</p>
                    <p className="text-sm text-muted-foreground">{formatTime(task.completed_at)}</p>
                  </div>
                </div>
              )}

              {task.exit_code !== undefined && (
                <div className="flex items-center gap-3">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Exit Code</p>
                    <p className="text-sm text-muted-foreground">{task.exit_code}</p>
                  </div>
                </div>
              )}
            </div>

            {task.payload && (
              <div className="space-y-2">
                <Label>Command/Payload</Label>
                <Textarea
                  value={task.payload.command || JSON.stringify(task.payload, null, 2)}
                  readOnly
                  className="font-mono text-sm"
                  rows={3}
                />
              </div>
            )}

            {task.output && (
              <div className="space-y-2">
                <Label>Output</Label>
                <Textarea
                  value={task.output}
                  readOnly
                  className="font-mono text-sm bg-green-50 dark:bg-green-950"
                  rows={6}
                />
              </div>
            )}

            {task.error_output && (
              <div className="space-y-2">
                <Label>Error Output</Label>
                <Textarea
                  value={task.error_output}
                  readOnly
                  className="font-mono text-sm bg-red-50 dark:bg-red-950"
                  rows={4}
                />
              </div>
            )}
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
