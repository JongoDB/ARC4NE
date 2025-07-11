from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List as PyList

# Import from our existing modules
from ..db import (
    DB_AGENTS, queue_task_for_agent_in_db, get_all_tasks, DB_TASK_RESULTS,
    get_all_tasks_with_metadata, get_agent_by_id, get_task_by_id, delete_agent_from_db,
    get_telemetry_for_agent, get_recent_telemetry, update_agent_beacon_interval,
    check_and_update_offline_agents
)
from ..routers.auth_api import get_current_user
from ..models import TaskInstructionSchema

router = APIRouter(
    prefix="/api/v1",
    tags=["UI API"],
    dependencies=[Depends(get_current_user)]  # Protect all UI API endpoints
)

# Pydantic model for AgentInfo that matches frontend types
class AgentInfo(BaseModel):
    id: str  # Changed to string to match frontend expectation
    name: str
    os_type: Optional[str] = None
    ip_address: Optional[str] = None
    status: Optional[str] = "unknown"
    last_seen: Optional[str] = None  # Changed to string for ISO format
    agent_version: Optional[str] = None
    tags: Optional[PyList[str]] = None
    beacon_interval_seconds: Optional[int] = 60

class AgentDetails(BaseModel):
    id: str
    name: str
    os_type: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    status: Optional[str] = "unknown"
    last_seen: Optional[str] = None
    agent_version: Optional[str] = None
    tags: Optional[PyList[str]] = None
    created_at: Optional[str] = None
    beacon_interval_seconds: Optional[int] = 60

class UpdateAgentConfigRequest(BaseModel):
    beacon_interval_seconds: Optional[int] = None

class CreateTaskRequest(BaseModel):
    agent_id: str
    type: str
    payload: dict
    description: Optional[str] = None
    timeout_seconds: Optional[int] = 300

class TaskInfo(BaseModel):
    id: str
    agent_id: str
    agent_name: Optional[str] = None
    type: str
    status: str
    description: Optional[str] = None
    created_at: str
    created_by_user_id: Optional[str] = None
    updated_at: Optional[str] = None
    payload: Optional[dict] = None
    output: Optional[str] = None
    error_output: Optional[str] = None
    exit_code: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class TaskDetails(BaseModel):
    id: str
    agent_id: str
    agent_name: Optional[str] = None
    type: str
    status: str
    description: Optional[str] = None
    created_at: str
    created_by_user_id: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    payload: Optional[dict] = None
    output: Optional[str] = None
    error_output: Optional[str] = None
    exit_code: Optional[int] = None
    timeout_seconds: Optional[int] = None

class TelemetryEntry(BaseModel):
    agent_id: str
    agent_name: Optional[str] = None
    timestamp: str
    metrics: List[dict]

@router.post("/agents/refresh")
async def refresh_agents_status(current_user: dict = Depends(get_current_user)):
    """
    Manually trigger offline check for all agents.
    This is called when the user clicks the refresh button.
    """
    offline_count = check_and_update_offline_agents()
    return {
        "message": f"Agent status refresh completed. {offline_count} agents marked offline.",
        "offline_count": offline_count,
        "total_agents": len(DB_AGENTS)
    }

@router.get("/agents", response_model=List[AgentInfo])
async def get_all_agents(current_user: dict = Depends(get_current_user)):
    """
    Provides a list of agents for the UI.
    Requires authentication.
    """
    agents_list = []
    for agent_id, agent_data in DB_AGENTS.items():
        # Adapt the data from DB_AGENTS to AgentInfo schema
        last_seen_str = None
        if agent_data.get("last_seen"):
            last_seen_str = agent_data["last_seen"].isoformat()
        
        agent_info_data = {
            "id": str(agent_id),  # Convert UUID to string
            "name": agent_data.get("name", "Unknown Agent"),
            "os_type": agent_data.get("os_info"),
            "ip_address": agent_data.get("internal_ip"),
            "status": agent_data.get("status", "unknown"),
            "last_seen": last_seen_str,
            "agent_version": agent_data.get("agent_version"),
            "tags": agent_data.get("tags"),
            "beacon_interval_seconds": agent_data.get("beacon_interval_seconds", 60)
        }
        agents_list.append(AgentInfo(**agent_info_data))
    return agents_list

@router.get("/agents/{agent_id}", response_model=AgentDetails)
async def get_agent_details(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed information about a specific agent"""
    try:
        agent_uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")
    
    agent_data = get_agent_by_id(agent_uuid)
    if not agent_data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    last_seen_str = None
    if agent_data.get("last_seen"):
        last_seen_str = agent_data["last_seen"].isoformat()
    
    created_at_str = None
    if agent_data.get("created_at"):
        created_at_str = agent_data["created_at"].isoformat()
    
    return AgentDetails(
        id=str(agent_uuid),
        name=agent_data.get("name", "Unknown Agent"),
        os_type=agent_data.get("os_info"),
        hostname=agent_data.get("hostname"),
        ip_address=agent_data.get("internal_ip"),
        status=agent_data.get("status", "unknown"),
        last_seen=last_seen_str,
        agent_version=agent_data.get("agent_version"),
        tags=agent_data.get("tags"),
        created_at=created_at_str,
        beacon_interval_seconds=agent_data.get("beacon_interval_seconds", 60)
    )

@router.patch("/agents/{agent_id}")
async def update_agent_config(
    agent_id: str,
    config_update: UpdateAgentConfigRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update agent configuration"""
    try:
        agent_uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")
    
    agent_data = get_agent_by_id(agent_uuid)
    if not agent_data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    updates_made = []
    
    if config_update.beacon_interval_seconds is not None:
        if config_update.beacon_interval_seconds < 10 or config_update.beacon_interval_seconds > 3600:
            raise HTTPException(status_code=400, detail="Beacon interval must be between 10 and 3600 seconds")
        
        success = update_agent_beacon_interval(agent_uuid, config_update.beacon_interval_seconds)
        if success:
            updates_made.append(f"beacon_interval_seconds: {config_update.beacon_interval_seconds}")
    
    if not updates_made:
        raise HTTPException(status_code=400, detail="No valid updates provided")
    
    return {
        "message": f"Agent configuration updated: {', '.join(updates_made)}",
        "updates": updates_made
    }

@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an agent"""
    try:
        agent_uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")
    
    success = delete_agent_from_db(agent_uuid)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {"message": "Agent deleted successfully"}

@router.post("/tasks")
async def create_task(
    task_request: CreateTaskRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new task for an agent.
    """
    try:
        agent_id = UUID(task_request.agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")
    
    # Check if agent exists
    if agent_id not in DB_AGENTS:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Create the task with a generated task_id
    task_id = uuid4()
    task = TaskInstructionSchema(
        task_id=task_id,  # Add the missing task_id field
        type=task_request.type,
        payload=task_request.payload,
        timeout_seconds=task_request.timeout_seconds or 300
    )
    
    # Queue the task for the agent
    success = queue_task_for_agent_in_db(agent_id, task, current_user.get("username"))
    if not success:
        raise HTTPException(status_code=500, detail="Failed to queue task")
    
    return {
        "task_id": str(task_id),  # Use the generated task_id instead of task.task_id
        "message": "Task created and queued successfully"
    }

@router.get("/tasks", response_model=List[TaskInfo])
async def get_all_tasks(current_user: dict = Depends(get_current_user)):
    """
    Get all tasks with their results.
    """
    tasks_list = []
    
    # Get all tasks with metadata
    for task_id, task_data in get_all_tasks_with_metadata().items():
        # Find the agent name
        agent_name = "Unknown Agent"
        agent_id = task_data.get("agent_id")
        if agent_id and agent_id in DB_AGENTS:
            agent_name = DB_AGENTS[agent_id].get("name", "Unknown Agent")
        
        # Convert datetime objects to ISO strings
        created_at_str = task_data.get("created_at")
        if created_at_str and hasattr(created_at_str, 'isoformat'):
            created_at_str = created_at_str.isoformat()
        
        started_at_str = task_data.get("started_at")
        if started_at_str and hasattr(started_at_str, 'isoformat'):
            started_at_str = started_at_str.isoformat()
        
        completed_at_str = task_data.get("completed_at")
        if completed_at_str and hasattr(completed_at_str, 'isoformat'):
            completed_at_str = completed_at_str.isoformat()
        
        task_info = TaskInfo(
            id=str(task_id),
            agent_id=str(agent_id) if agent_id else "unknown",
            agent_name=agent_name,
            type=task_data.get("type", "unknown"),
            status=task_data.get("status", "unknown"),
            description=None,  # We don't store descriptions yet
            created_at=created_at_str or datetime.utcnow().isoformat(),
            created_by_user_id=task_data.get("created_by_user_id"),
            payload=task_data.get("payload"),
            output=task_data.get("output"),
            error_output=task_data.get("error_output"),
            exit_code=task_data.get("exit_code"),
            started_at=started_at_str,
            completed_at=completed_at_str
        )
        tasks_list.append(task_info)
    
    # Sort by created_at descending (newest first)
    tasks_list.sort(key=lambda x: x.created_at, reverse=True)
    return tasks_list

@router.get("/tasks/{task_id}", response_model=TaskDetails)
async def get_task_details(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed information about a specific task"""
    try:
        task_uuid = UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID format")
    
    task_data = get_task_by_id(task_uuid)
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Find the agent name
    agent_name = "Unknown Agent"
    agent_id = task_data.get("agent_id")
    if agent_id and agent_id in DB_AGENTS:
        agent_name = DB_AGENTS[agent_id].get("name", "Unknown Agent")
    
    # Convert datetime objects to ISO strings
    created_at_str = task_data.get("created_at")
    if created_at_str and hasattr(created_at_str, 'isoformat'):
        created_at_str = created_at_str.isoformat()
    
    started_at_str = task_data.get("started_at")
    if started_at_str and hasattr(started_at_str, 'isoformat'):
        started_at_str = started_at_str.isoformat()
    
    completed_at_str = task_data.get("completed_at")
    if completed_at_str and hasattr(completed_at_str, 'isoformat'):
        completed_at_str = completed_at_str.isoformat()
    
    return TaskDetails(
        id=str(task_uuid),
        agent_id=str(agent_id) if agent_id else "unknown",
        agent_name=agent_name,
        type=task_data.get("type", "unknown"),
        status=task_data.get("status", "unknown"),
        description=None,  # We don't store descriptions yet
        created_at=created_at_str or datetime.utcnow().isoformat(),
        created_by_user_id=task_data.get("created_by_user_id"),
        started_at=started_at_str,
        completed_at=completed_at_str,
        payload=task_data.get("payload"),
        output=task_data.get("output"),
        error_output=task_data.get("error_output"),
        exit_code=task_data.get("exit_code"),
        timeout_seconds=task_data.get("timeout_seconds")
    )

@router.get("/telemetry", response_model=List[TelemetryEntry])
async def get_recent_telemetry_data(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get recent telemetry data from all agents"""
    telemetry_data = get_recent_telemetry(limit)
    
    result = []
    for entry in telemetry_data:
        agent_id = entry.get("agent_id")
        agent_name = "Unknown Agent"
        
        if agent_id and agent_id in DB_AGENTS:
            agent_name = DB_AGENTS[agent_id].get("name", "Unknown Agent")
        
        timestamp_str = entry.get("timestamp")
        if hasattr(timestamp_str, 'isoformat'):
            timestamp_str = timestamp_str.isoformat()
        
        result.append(TelemetryEntry(
            agent_id=str(agent_id) if agent_id else "unknown",
            agent_name=agent_name,
            timestamp=timestamp_str or datetime.utcnow().isoformat(),
            metrics=entry.get("metrics", [])
        ))
    
    return result

@router.get("/agents/{agent_id}/telemetry", response_model=List[TelemetryEntry])
async def get_agent_telemetry(
    agent_id: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get telemetry data for a specific agent"""
    try:
        agent_uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")
    
    # Check if agent exists
    agent_data = get_agent_by_id(agent_uuid)
    if not agent_data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    telemetry_data = get_telemetry_for_agent(agent_uuid, limit)
    agent_name = agent_data.get("name", "Unknown Agent")
    
    result = []
    for entry in telemetry_data:
        timestamp_str = entry.get("timestamp")
        if hasattr(timestamp_str, 'isoformat'):
            timestamp_str = timestamp_str.isoformat()
        
        result.append(TelemetryEntry(
            agent_id=agent_id,
            agent_name=agent_name,
            timestamp=timestamp_str or datetime.utcnow().isoformat(),
            metrics=entry.get("metrics", [])
        ))
    
    return result
