export interface AgentInfo {
  id: string // UUID as string
  name: string
  os_type?: string | null
  ip_address?: string | null // This might be internal_ip or external_ip
  status?: string // online, offline, error, idle
  last_seen?: string | null // ISO date string
  agent_version?: string | null
  tags?: string[] | null
}

export interface TaskInfo {
  id: string // UUID as string
  agent_id: string
  agent_name?: string
  type: string
  status: string // queued, processing, completed, failed, etc.
  description?: string
  created_at: string // ISO date string
  created_by_user_id?: string
  updated_at?: string
  payload?: Record<string, any>
  output?: string
  error_output?: string
  exit_code?: number
  started_at?: string
  completed_at?: string
}

export interface CreateTaskRequest {
  agent_id: string
  type: string
  payload: Record<string, any>
  description?: string
  timeout_seconds?: number
}

export interface TelemetryDataPoint {
  timestamp: string // ISO date string
  metric_type: string
  metric_value: any
  unit?: string
  tags?: Record<string, string>
}
