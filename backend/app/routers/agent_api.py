from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from typing import List
from uuid import UUID
from datetime import datetime
import secrets
import string
import os
import zipfile
import io
import json
from fastapi.responses import Response

from ..models import (
    AgentBeaconSchema, BeaconResponseSchema, TaskInstructionSchema,
    TaskResultSchema, AgentTelemetryBatchSchema
)
from ..db import (
    update_agent_status_in_db, get_queued_tasks_for_agent_from_db,
    store_task_result_in_db, store_telemetry_in_db, queue_task_for_agent_in_db,
    get_pending_config_update, DB_AGENTS, DB_AGENT_PSKS  # Added DB_AGENT_PSKS for PSK access
)
from ..security import verify_agent_signature

router = APIRouter(
    prefix="/api/v1/agent",
    tags=["Agent Communication"],
    # dependencies=[Depends(verify_agent_signature)] # Apply to all routes in this router
)

def generate_secure_psk(length: int = 32) -> str:
    """Generate a cryptographically secure PSK"""
    # Use a mix of letters, digits, and some safe special characters
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

@router.post("/beacon", response_model=BeaconResponseSchema)
async def agent_beacon(
    beacon_data: AgentBeaconSchema,
    agent_id: UUID = Depends(verify_agent_signature) # Authenticates and provides agent_id
):
    """
    Agent beacons in, sends status/basic telemetry, gets tasks and config updates.
    """
    update_agent_status_in_db(agent_id, beacon_data.status, beacon_data.basic_telemetry.model_dump() if beacon_data.basic_telemetry else None)

    # For MVP, if beacon_data contains task_results, process them here
    if beacon_data.task_results:
        for res_data in beacon_data.task_results:
            try:
                # Convert task_id to UUID if it's a string
                if isinstance(res_data.get("task_id"), str):
                    res_data["task_id"] = UUID(res_data["task_id"])
            
                result = TaskResultSchema(**res_data) # Validate result structure
                store_task_result_in_db(agent_id, result)
                print(f"✅ Processed task result for task {result.task_id}")
            except Exception as e:
                print(f"❌ Error processing task result from beacon: {e}")
                print(f"   Raw result data: {res_data}")

    # Get new tasks for the agent
    new_tasks = get_queued_tasks_for_agent_from_db(agent_id)
    
    # Check for pending config updates
    config_update = get_pending_config_update(agent_id)
    
    return BeaconResponseSchema(new_tasks=new_tasks, config_update=config_update)

@router.post("/task_results")
async def report_task_results(
    results: List[TaskResultSchema],
    agent_id: UUID = Depends(verify_agent_signature)
):
    """
    Agent reports results for one or more completed tasks.
    """
    for result in results:
        store_task_result_in_db(agent_id, result)
    return {"message": f"{len(results)} task result(s) received"}

@router.post("/telemetry")
async def submit_telemetry(
    telemetry_batch: AgentTelemetryBatchSchema,
    agent_id: UUID = Depends(verify_agent_signature)
):
    """
    Agent uploads a batch of telemetry data.
    """
    store_telemetry_in_db(agent_id, telemetry_batch)
    return {"message": "Telemetry batch received"}

# --- MVP: Temporary endpoint to create an agent and queue a task for testing ---
# This would normally be done via an admin UI.
from ..models import AgentCreateInternalSchema, AgentRegisteredSchema
from ..db import create_agent_in_db

@router.post("/_internal/create_agent_for_testing", response_model=AgentRegisteredSchema, tags=["Internal Testing"])
async def internal_create_agent(agent_data: AgentCreateInternalSchema):
    agent_id = create_agent_in_db(agent_data)
    return AgentRegisteredSchema(agent_id=agent_id, name=agent_data.name, psk_provided=agent_data.psk)

# New endpoint for UI-based agent registration
@router.post("/_internal/register_agent", response_model=AgentRegisteredSchema, tags=["Internal Testing"])
async def register_agent_for_ui(name: str = Body(...), description: str = Body(None)):
    """
    Register a new agent with auto-generated PSK for UI use
    """
    # Generate a secure PSK
    generated_psk = generate_secure_psk(32)
    
    agent_data = AgentCreateInternalSchema(name=name, psk=generated_psk)
    agent_id = create_agent_in_db(agent_data)
    
    return AgentRegisteredSchema(
        agent_id=agent_id, 
        name=agent_data.name, 
        psk_provided=generated_psk
    )

@router.post("/_internal/queue_task_for_testing/{agent_id}", tags=["Internal Testing"])
async def internal_queue_task(agent_id: UUID, task: TaskInstructionSchema = Body(...)):
    if not queue_task_for_agent_in_db(agent_id, task):
        raise HTTPException(status_code=404, detail="Agent not found for task queuing")
    return {"message": f"Task {task.task_id} queued for agent {agent_id}"}

def get_current_agent_files():
    """Get the current/correct agent files content"""
    
    # This is the CORRECT arc4ne_agent.py with all config update functionality
    arc4ne_agent_content = '''import time
import json
import platform
import socket
import subprocess
import hmac
import hashlib
import requests # type: ignore
from typing import Dict, Any, List, Optional
from uuid import UUID # For type hinting if needed, though config stores as str

from config import load_config, save_config_updates

# Global agent configuration
AGENT_CONFIG: Dict[str, Any] = {}

def get_agent_id() -> str:
    return AGENT_CONFIG.get("agent_id", "unknown_agent")

def get_psk() -> str:
    return AGENT_CONFIG.get("psk", "")

def get_server_url() -> str:
    return AGENT_CONFIG.get("server_url", "")

def sign_payload(payload_bytes: bytes) -> str:
    """Signs the payload using HMAC-SHA256 with the agent's PSK."""
    psk = get_psk()
    if not psk:
        raise ValueError("PSK not configured, cannot sign payload.")
    
    signature = hmac.new(
        psk.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    return signature

def make_authenticated_request(method: str, endpoint_suffix: str, json_payload: Optional[Dict[str, Any]] = None) -> Optional[requests.Response]:
    """Makes an authenticated HTTP request to the ARC4NE server."""
    url = f"{get_server_url().rstrip('/')}/{endpoint_suffix.lstrip('/')}"
    agent_id = get_agent_id()
    
    headers = {
        "Content-Type": "application/json",
        "X-Agent-ID": agent_id
    }

    payload_bytes = b""
    if json_payload is not None:
        payload_bytes = json.dumps(json_payload, separators=(',', ':')).encode('utf-8') # Compact JSON

    try:
        signature = sign_payload(payload_bytes)
        headers["X-Signature"] = signature
    except ValueError as e:
        print(f"ERROR: Could not sign payload: {e}")
        return None

    try:
        print(f"Sending {method} request to {url}...")
        # print(f"Payload: {payload_bytes.decode('utf-8') if payload_bytes else 'No payload'}")
        # print(f"Headers: {headers}")

        if method.upper() == "POST":
            response = requests.post(url, data=payload_bytes, headers=headers, timeout=30)
        elif method.upper() == "GET": # Though most agent comms are POST
            response = requests.get(url, headers=headers, timeout=30) 
        else:
            print(f"Unsupported HTTP method: {method}")
            return None
        
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        print(f"Request successful: {response.status_code}")
        return response
    except requests.exceptions.RequestException as e:
        print(f"ERROR: HTTP Request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                print(f"Server response: {e.response.text}")
            except Exception:
                pass # Ignore if response text is not available or not decodable
        return None
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during request: {e}")
        return None


def get_basic_telemetry() -> Dict[str, Any]:
    """Collects basic system telemetry."""
    try:
        # Get internal IP addresses
        internal_ips = []
        hostname = socket.gethostname()
        try:
            # Get all IP addresses for this host
            for info in socket.getaddrinfo(hostname, None):
                ip = info[4][0]
                if not ip.startswith('127.') and ':' not in ip:  # Skip localhost and IPv6
                    if ip not in internal_ips:
                        internal_ips.append(ip)
        except:
            pass
        
        if not internal_ips:
            # Fallback method
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                internal_ips.append(s.getsockname()[0])
                s.close()
            except:
                internal_ips.append("unknown")

        return {
            "os_info": f"{platform.system()} {platform.release()}",
            "hostname": hostname,
            "agent_version": "0.1.0-mvp",
            "internal_ips": internal_ips
        }
    except Exception as e:
        print(f"Warning: Could not collect full telemetry: {e}")
        return {
            "os_info": "unknown",
            "hostname": "unknown", 
            "agent_version": "0.1.0-mvp",
            "internal_ips": ["unknown"]
        }

def execute_task(task: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a given task and returns the result."""
    task_id = task.get("task_id")
    task_type = task.get("type")
    payload = task.get("payload", {})
    print(f"Executing task {task_id} of type {task_type}...")

    result: Dict[str, Any] = {
        "task_id": task_id,
        "status": "failed", # Default to failed
        "output": None,
        "error_output": None,
        "exit_code": None
    }

    if task_type == "execute_command":
        command = payload.get("command")
        if not command:
            result["error_output"] = "No command provided in payload."
            return result
        
        try:
            # For security, on Linux, consider using shell=False and passing command as a list
            # For MVP, shell=True is simpler for complex commands but carries risks.
            # Ensure commands are sanitized or come from a trusted source (the C2 server).
            process = subprocess.run(
                command,
                shell=True, # Be cautious with shell=True
                capture_output=True,
                text=True,
                timeout=task.get("timeout_seconds", 300)
            )
            result["output"] = process.stdout
            result["error_output"] = process.stderr
            result["exit_code"] = process.returncode
            result["status"] = "completed" if process.returncode == 0 else "failed"
            print(f"Task {task_id} completed with exit code {process.returncode}")
        except subprocess.TimeoutExpired:
            result["error_output"] = "Command timed out."
            result["status"] = "timed_out"
            print(f"Task {task_id} timed out.")
        except Exception as e:
            result["error_output"] = f"Command execution failed: {str(e)}"
            print(f"Task {task_id} execution failed: {e}")
    else:
        result["error_output"] = f"Unsupported task type: {task_type}"
        print(f"Task {task_id} unsupported type: {task_type}")

    return result

def apply_config_update(config_update: Dict[str, Any]) -> bool:
    """Apply configuration updates and save to file."""
    global AGENT_CONFIG
    
    try:
        print(f"📝 Applying configuration update: {config_update}")
        
        updates_applied = []
        
        # Handle beacon interval updates
        if "beacon_interval_seconds" in config_update:
            new_interval = config_update["beacon_interval_seconds"]
            if isinstance(new_interval, int) and 10 <= new_interval <= 3600:
                old_interval = AGENT_CONFIG.get("beacon_interval_seconds", 60)
                AGENT_CONFIG["beacon_interval_seconds"] = new_interval
                updates_applied.append(f"beacon_interval_seconds: {old_interval}s → {new_interval}s")
            else:
                print(f"⚠️  Invalid beacon interval: {new_interval}")
        
        # Save updates to config file if any were applied
        if updates_applied:
            success = save_config_updates(AGENT_CONFIG)
            if success:
                print(f"✅ Configuration updated successfully: {', '.join(updates_applied)}")
                print(f"📁 Changes saved to agent_config.json")
                return True
            else:
                print(f"❌ Failed to save configuration updates to file")
                return False
        else:
            print(f"ℹ️  No valid configuration updates to apply")
            return False
            
    except Exception as e:
        print(f"❌ Error applying configuration update: {e}")
        return False

def beacon_loop():
    """Main beaconing loop for the agent."""
    global AGENT_CONFIG
    try:
        AGENT_CONFIG = load_config()
    except Exception as e:
        print(f"CRITICAL: Could not load agent configuration. Exiting. Error: {e}")
        return

    beacon_interval = AGENT_CONFIG.get("beacon_interval_seconds", 60)
    print(f"🚀 Agent starting with beacon interval: {beacon_interval}s")
    
    # Task results to be sent with the next beacon
    # For MVP, we'll send results with the beacon. A dedicated endpoint is better for larger results.
    pending_task_results: List[Dict[str, Any]] = []
    
    # Track if we're currently processing tasks
    currently_processing = False

    while True:
        print(f"\\n--- Beaconing at {time.strftime('%Y-%m-%d %H:%M:%S')} (interval: {beacon_interval}s) ---")
        
        # Agent is online when beaconing, processing when executing tasks
        if currently_processing:
            status = "processing"
            print("Status: PROCESSING (executing tasks)")
        else:
            status = "online"
            print("Status: ONLINE (ready for tasks)")
        
        beacon_payload: Dict[str, Any] = {
            "status": status,
            "basic_telemetry": get_basic_telemetry()
        }
        
        # If there are pending task results, include them in the beacon
        if pending_task_results:
            beacon_payload["task_results"] = pending_task_results
            print(f"Including {len(pending_task_results)} task result(s) in beacon.")

        response = make_authenticated_request("POST", "beacon", json_payload=beacon_payload)
        
        # Clear pending results after attempting to send them
        # (even if send failed, to avoid re-sending potentially large data repeatedly on transient errors)
        # A more robust system would have retries or a separate queue for results.
        pending_task_results = [] 

        if response and response.status_code == 200:
            try:
                response_data = response.json()
                print(f"Beacon response received: {response_data}")

                new_tasks = response_data.get("new_tasks", [])
                if new_tasks:
                    print(f"Received {len(new_tasks)} new task(s).")
                    currently_processing = True
                    for task in new_tasks:
                        task_result = execute_task(task)
                        pending_task_results.append(task_result)
                    currently_processing = False
                    print("Task execution completed, returning to online status.")
                
                # Handle config updates
                config_update = response_data.get("config_update")
                if config_update:
                    print(f"🔧 Received configuration update from server")
                    success = apply_config_update(config_update)
                    if success:
                        # Update beacon interval if it was changed
                        new_beacon_interval = AGENT_CONFIG.get("beacon_interval_seconds", beacon_interval)
                        if new_beacon_interval != beacon_interval:
                            beacon_interval = new_beacon_interval
                            print(f"🔄 Beacon interval updated to {beacon_interval}s (takes effect next cycle)")

            except json.JSONDecodeError:
                print("ERROR: Could not decode JSON response from server.")
            except Exception as e:
                print(f"ERROR: Error processing beacon response: {e}")
        else:
            print("Beacon failed or received non-200 response.")

        print(f"😴 Sleeping for {beacon_interval} seconds...")
        time.sleep(beacon_interval)

if __name__ == "__main__":
    print("ARC4NE Agent (MVP) starting...")
    beacon_loop()
'''

    # This is the CORRECT config.py with save_config_updates functionality
    config_content = '''import json
import os
from typing import Dict, Any, Optional

CONFIG_FILE_PATH = "agent_config.json" # Expect this in the same directory as the agent script

DEFAULT_SERVER_URL = "http://localhost/api/v1/agent" # Assuming Nginx proxy is on localhost:80
DEFAULT_BEACON_INTERVAL = 60 # seconds

config_cache: Optional[Dict[str, Any]] = None

def load_config() -> Dict[str, Any]:
    global config_cache
    if config_cache is not None:
        return config_cache

    if not os.path.exists(CONFIG_FILE_PATH):
        print(f"ERROR: Configuration file '{CONFIG_FILE_PATH}' not found.")
        print("Please create it with your agent_id, psk, and server_url.")
        # Example agent_config.json:
        # {
        #   "agent_id": "your-agent-uuid-here",
        #   "psk": "your-pre-shared-key-here",
        #   "server_url": "http://localhost/api/v1/agent", # Or your actual server URL
        #   "beacon_interval_seconds": 60
        # }
        raise FileNotFoundError(f"Configuration file '{CONFIG_FILE_PATH}' not found.")

    try:
        with open(CONFIG_FILE_PATH, 'r') as f:
            loaded_conf = json.load(f)
            
            # Validate required fields
            required_fields = ["agent_id", "psk"]
            for field in required_fields:
                if field not in loaded_conf:
                    raise ValueError(f"Missing required field '{field}' in config.")

            # Set defaults for optional fields
            loaded_conf.setdefault("server_url", DEFAULT_SERVER_URL)
            loaded_conf.setdefault("beacon_interval_seconds", DEFAULT_BEACON_INTERVAL)
            
            config_cache = loaded_conf
            return config_cache
    except json.JSONDecodeError as e:
        print(f"ERROR: Could not decode JSON from '{CONFIG_FILE_PATH}': {e}")
        raise
    except ValueError as e:
        print(f"ERROR: Configuration error: {e}")
        raise
    except Exception as e:
        print(f"ERROR: Failed to load configuration: {e}")
        raise

def save_config_updates(updated_config: Dict[str, Any]) -> bool:
    """Save configuration updates to the config file."""
    global config_cache
    
    try:
        # Create a backup of the current config
        backup_path = f"{CONFIG_FILE_PATH}.backup"
        if os.path.exists(CONFIG_FILE_PATH):
            with open(CONFIG_FILE_PATH, 'r') as src, open(backup_path, 'w') as dst:
                dst.write(src.read())
            print(f"📋 Created backup: {backup_path}")
        
        # Write the updated configuration
        with open(CONFIG_FILE_PATH, 'w') as f:
            json.dump(updated_config, f, indent=2, separators=(',', ': '))
        
        # Update the cache
        config_cache = updated_config.copy()
        
        print(f"💾 Configuration saved to {CONFIG_FILE_PATH}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to save configuration: {e}")
        
        # Try to restore from backup if it exists
        backup_path = f"{CONFIG_FILE_PATH}.backup"
        if os.path.exists(backup_path):
            try:
                with open(backup_path, 'r') as src, open(CONFIG_FILE_PATH, 'w') as dst:
                    dst.write(src.read())
                print(f"🔄 Restored configuration from backup")
            except Exception as restore_error:
                print(f"❌ Failed to restore from backup: {restore_error}")
        
        return False

def reload_config() -> Dict[str, Any]:
    """Force reload configuration from file (clears cache)."""
    global config_cache
    config_cache = None
    return load_config()

if __name__ == '__main__':
    # Test loading config
    try:
        conf = load_config()
        print("Configuration loaded successfully:")
        for key, value in conf.items():
            print(f"  {key}: {value}")
    except Exception as e:
        print(f"Failed to load config for testing: {e}")
'''

    return {
        'arc4ne_agent.py': arc4ne_agent_content,
        'config.py': config_content
    }

@router.get("/files", tags=["Agent Files"])
async def get_agent_files():
    """
    Returns a ZIP file containing the current agent files from the codebase
    """
    try:
        files_content = get_current_agent_files()
        
        # Create a ZIP file in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename, content in files_content.items():
                zip_file.writestr(filename, content)
                print(f"✅ Added {filename} to ZIP ({len(content)} chars)")
    
        zip_buffer.seek(0)
        
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=arc4ne_agent_files.zip"}
        )
        
    except Exception as e:
        print(f"❌ Error creating agent files ZIP: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create agent files package: {str(e)}")

@router.get("/files/{agent_id}", tags=["Agent Files"])
async def get_agent_files_with_config(agent_id: str, request: Request):
    """
    Returns a ZIP file containing the current agent files plus the specific agent config
    """
    try:
        # Validate agent ID
        try:
            agent_uuid = UUID(agent_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid agent ID format")
        
        # Check if agent exists and get agent data
        if agent_uuid not in DB_AGENTS:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        agent_data = DB_AGENTS[agent_uuid]
        print(f"📋 Found agent data for {agent_id}:")
        print(f"   - Name: {agent_data.get('name', 'unnamed')}")
        
        # Get PSK from the separate PSK storage (DB_AGENT_PSKS)
        psk = DB_AGENT_PSKS.get(agent_uuid, "")
        print(f"   - PSK from DB_AGENT_PSKS: {psk[:8]}..." if psk else "   - PSK: MISSING from DB_AGENT_PSKS")
        
        # Get current agent files
        files_content = get_current_agent_files()
        
        # Create a ZIP file in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add Python files
            for filename, content in files_content.items():
                zip_file.writestr(filename, content)
                print(f"✅ Added {filename} to ZIP ({len(content)} chars)")
            
            # Create agent_config.json with the specific agent's details
            # Get server URL from request
            server_url = f"{request.url.scheme}://{request.url.hostname}"
            if request.url.port and request.url.port not in [80, 443]:
                server_url += f":{request.url.port}"
            server_url += "/api/v1/agent"
            
            agent_config = {
                "agent_id": str(agent_uuid),
                "psk": psk,  # Use PSK from DB_AGENT_PSKS
                "server_url": server_url,
                "beacon_interval_seconds": agent_data.get("beacon_interval_seconds", 60)
            }
            
            config_json = json.dumps(agent_config, indent=2)
            zip_file.writestr("agent_config.json", config_json)
            print(f"✅ Added agent_config.json:")
            print(f"   - Agent ID: {agent_config['agent_id']}")
            print(f"   - PSK: {agent_config['psk'][:8]}..." if agent_config['psk'] else "   - PSK: EMPTY!")
            print(f"   - Server URL: {server_url}")
            print(f"   - Beacon Interval: {agent_config['beacon_interval_seconds']}s")
    
        zip_buffer.seek(0)
        
        agent_name = agent_data.get("name", "agent").replace(" ", "_")
        filename = f"arc4ne_agent_{agent_name}_{agent_id[:8]}.zip"
        
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating agent package: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create agent package: {str(e)}")
