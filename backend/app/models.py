from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

# --- Agent Models ---
class AgentCreateInternalSchema(BaseModel):
    name: str
    psk: str

class AgentRegisteredSchema(BaseModel):
    agent_id: UUID
    name: str
    psk_provided: str

class BasicTelemetrySchema(BaseModel):
    os_info: Optional[str] = None
    hostname: Optional[str] = None
    agent_version: Optional[str] = None
    internal_ips: Optional[List[str]] = None
    timestamp: Optional[float] = None
    uptime: Optional[float] = None

class SystemMetricsSchema(BaseModel):
    timestamp: Optional[float] = None
    cpu_percent: Optional[float] = None
    memory_total: Optional[int] = None
    memory_used: Optional[int] = None
    memory_percent: Optional[float] = None
    disk_total: Optional[int] = None
    disk_used: Optional[int] = None
    disk_percent: Optional[float] = None
    network_bytes_sent: Optional[int] = None
    network_bytes_recv: Optional[int] = None
    network_packets_sent: Optional[int] = None
    network_packets_recv: Optional[int] = None

class AgentBeaconSchema(BaseModel):
    status: str = Field(..., description="Agent status: online, processing, error")
    basic_telemetry: Optional[BasicTelemetrySchema] = None
    system_metrics: Optional[SystemMetricsSchema] = None
    task_results: Optional[List[Dict[str, Any]]] = None

class BeaconResponseSchema(BaseModel):
    new_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    config_update: Optional[Dict[str, Any]] = None

# --- Task Models ---
class TaskInstructionSchema(BaseModel):
    task_id: UUID
    type: str = Field(..., description="Task type: execute_command, file_transfer, etc.")
    payload: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: int = Field(default=300, ge=1, le=3600)

class TaskResultSchema(BaseModel):
    task_id: UUID
    status: str = Field(..., description="Task result status: completed, failed, timed_out")
    output: Optional[str] = None
    error_output: Optional[str] = None
    exit_code: Optional[int] = None

# --- Telemetry Models ---
class TelemetryMetricSchema(BaseModel):
    name: str
    value: Any
    timestamp: datetime
    tags: Optional[Dict[str, str]] = None

class AgentTelemetryBatchSchema(BaseModel):
    timestamp: datetime
    metrics: List[TelemetryMetricSchema]

# --- UI API Models ---
class AgentInfoSchema(BaseModel):
    id: str
    name: str
    status: str
    last_seen: Optional[datetime]
    os_info: Optional[str]
    hostname: Optional[str]
    agent_version: Optional[str]
    internal_ip: Optional[str]
    external_ip: Optional[str]
    tags: Optional[str]
    created_at: datetime
    beacon_interval_seconds: int

class TaskInfoSchema(BaseModel):
    id: str
    agent_id: str
    agent_name: Optional[str]
    type: str
    status: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    output: Optional[str]
    error_output: Optional[str]
    exit_code: Optional[int]
    timeout_seconds: int

class CreateTaskSchema(BaseModel):
    agent_id: str
    type: str
    payload: Dict[str, Any]
    description: Optional[str] = None
    timeout_seconds: int = Field(default=300, ge=1, le=3600)

class UpdateAgentConfigSchema(BaseModel):
    beacon_interval_seconds: Optional[int] = Field(None, ge=10, le=3600)
