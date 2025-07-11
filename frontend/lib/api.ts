import type { AgentInfo } from "./types"

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    console.log("API: Using env API URL:", process.env.NEXT_PUBLIC_API_URL)
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== "undefined") {
    const dynamicUrl = `${window.location.origin}/api/v1`
    console.log("API: Using dynamic API URL:", dynamicUrl)
    return dynamicUrl
  }
  console.log("API: Using fallback API URL: /api/v1")
  return "/api/v1"
}

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
  // Check if we're in the browser and have the auth function available
  if (typeof window !== "undefined" && (window as any).__authRequest) {
    return (window as any).__authRequest(url, options)
  }

  // Fallback for server-side rendering or when auth is not available
  return fetch(url, {
    ...options,
    credentials: "include",
  })
}

export async function getAgents(): Promise<AgentInfo[]> {
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

// Updated registerAgent function
export async function registerAgent(agentData: { name: string; os_info?: string; tags?: string[] }) {
  const apiBaseUrl = getApiBaseUrl()
  const response = await makeAuthenticatedRequest(`${apiBaseUrl}/agent/_internal/register_agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: agentData.name,
      description: agentData.os_info || null,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to register agent: ${response.status} ${errorText}`)
  }

  return response.json()
}

// Add more authenticated API functions here
export async function createTask(taskData: any) {
  const apiBaseUrl = getApiBaseUrl()
  const response = await makeAuthenticatedRequest(`${apiBaseUrl}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(taskData),
  })

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`)
  }

  return response.json()
}

// Function to get agent files content
export async function getAgentFiles() {
  // These would typically be served from the backend or a CDN
  // For now, we'll include them as static content

  const agentPyContent = `import time
import json
import platform
import socket
import subprocess
import hmac
import hashlib
import requests # type: ignore
from typing import Dict, Any, List, Optional
from uuid import UUID # For type hinting if needed, though config stores as str

from config import load_config

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
    return {
        "os_info": f"{platform.system()} {platform.release()}",
        "hostname": socket.gethostname(),
        "agent_version": "0.1.0-mvp" # Hardcoded for MVP
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

def beacon_loop():
    """Main beaconing loop for the agent."""
    global AGENT_CONFIG
    try:
        AGENT_CONFIG = load_config()
    except Exception as e:
        print(f"CRITICAL: Could not load agent configuration. Exiting. Error: {e}")
        return

    beacon_interval = AGENT_CONFIG.get("beacon_interval_seconds", 60)
    
    # Task results to be sent with the next beacon
    # For MVP, we'll send results with the beacon. A dedicated endpoint is better for larger results.
    pending_task_results: List[Dict[str, Any]] = []

    while True:
        print(f"\\n--- Beaconing at {time.strftime('%Y-%m-%d %H:%M:%S')} ---")
        
        beacon_payload: Dict[str, Any] = {
            "status": "idle", # Could be 'processing' if tasks were handled async
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
                    for task in new_tasks:
                        task_result = execute_task(task)
                        pending_task_results.append(task_result)
                
                # Handle config updates if any (for later phases)
                # config_update = response_data.get("config_update")
                # if config_update:
                #     print(f"Received config update: {config_update}")
                #     beacon_interval = config_update.get("beacon_interval_seconds", beacon_interval)
                #     AGENT_CONFIG["beacon_interval_seconds"] = beacon_interval # Update runtime config

            except json.JSONDecodeError:
                print("ERROR: Could not decode JSON response from server.")
            except Exception as e:
                print(f"ERROR: Error processing beacon response: {e}")
        else:
            print("Beacon failed or received non-200 response.")

        print(f"Sleeping for {beacon_interval} seconds...")
        time.sleep(beacon_interval)

if __name__ == "__main__":
    print("ARC4NE Agent (MVP) starting...")
    beacon_loop()
`

  const configPyContent = `import json
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

if __name__ == '__main__':
    # Test loading config
    try:
        conf = load_config()
        print("Configuration loaded successfully:")
        for key, value in conf.items():
            print(f"  {key}: {value}")
    except Exception as e:
        print(f"Failed to load config for testing: {e}")
`

  return {
    agentPy: agentPyContent,
    configPy: configPyContent,
  }
}
