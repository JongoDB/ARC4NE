"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, RefreshCw, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TaskAssignmentModal } from "@/components/task-assignment-modal"
import { TaskDetailsModal } from "@/components/task-details-modal"
import type { TaskInfo, AgentInfo } from "@/lib/types"
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
  if (typeof window !== "undefined" && (window as any).__authRequest) {
    return (window as any).__authRequest(url, options)
  }
  return fetch(url, { ...options, credentials: "include" })
}

async function getTasks(): Promise<TaskInfo[]> {
  try {
    const apiBaseUrl = getApiBaseUrl()
    const response = await makeAuthenticatedRequest(`${apiBaseUrl}/tasks`)

    if (!response.ok) {
      console.error(`API Error (${response.status}): ${await response.text()}`)
      return []
    }

    return await response.json()
  } catch (error) {
    console.error("Failed to fetch tasks:", error)
    return []
  }
}

async function getAgents(): Promise<AgentInfo[]> {
  try {
    const apiBaseUrl = getApiBaseUrl()
    const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agents`)

    if (!response.ok) {
      console.error(`API Error (${response.status}): ${await response.text()}`)
      return []
    }

    return await response.json()
  } catch (error) {
    console.error("Failed to fetch agents:", error)
    return []
  }
}

export function TasksPageContent() {
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const [tasksData, agentsData] = await Promise.all([getTasks(), getAgents()])

      setTasks(tasksData)
      setAgents(agentsData)
    } catch (err) {
      console.error("Error fetching data:", err)
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
  const handleTaskCreated = () => fetchData(true)

  const handleViewDetails = (taskId: string) => {
    setSelectedTaskId(taskId)
    setShowDetailsModal(true)
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
      case "queued":
        return "outline"
      default:
        return "outline"
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Task Management</h2>
          <p className="text-sm text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowTaskModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No tasks found</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first task to get started</p>
            <Button onClick={() => setShowTaskModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden lg:table-cell">Completed</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-mono text-sm">{task.id.substring(0, 8)}...</TableCell>
                  <TableCell>{task.agent_name || "Unknown"}</TableCell>
                  <TableCell>{task.type}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatTime(task.created_at)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatTime(task.completed_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleViewDetails(task.id)}>View Details</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskAssignmentModal
        open={showTaskModal}
        onOpenChange={setShowTaskModal}
        agents={agents}
        onTaskCreated={handleTaskCreated}
      />

      <TaskDetailsModal open={showDetailsModal} onOpenChange={setShowDetailsModal} taskId={selectedTaskId} />
    </>
  )
}
