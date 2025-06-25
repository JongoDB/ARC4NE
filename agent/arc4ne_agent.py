import platform
import socket
import time
from typing import Any, Dict

import psutil  # For enhanced system metrics
import subprocess
import json
from typing import List

AGENT_VERSION = "0.2.0"


def get_basic_telemetry() -> Dict[str, Any]:
    """Collects basic system information (lightweight)."""
    try:
        # Get internal IP addresses
        internal_ips = []
        hostname = socket.gethostname()
        try:
            for info in socket.getaddrinfo(hostname, None):
                ip = info[4][0]
                if not ip.startswith('127.') and ':' not in ip:
                    if ip not in internal_ips:
                        internal_ips.append(ip)
        except:
            pass
        
        if not internal_ips:
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
            "agent_version": AGENT_VERSION,
            "internal_ips": internal_ips,
            "uptime": time.time() - psutil.boot_time() if 'psutil' in globals() else 0,
            "timestamp": time.time()
        }
    except Exception as e:
        print(f"Warning: Could not collect basic telemetry: {e}")
        return {
            "os_info": "unknown",
            "hostname": "unknown", 
            "agent_version": AGENT_VERSION,
            "internal_ips": ["unknown"],
            "uptime": 0,
            "timestamp": time.time()
        }

def get_system_metrics() -> Dict[str, Any]:
    """Collects system performance metrics."""
    try:
        import psutil
        
        # Get CPU and memory info
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get network I/O stats
        net_io = psutil.net_io_counters()
        
        return {
            "timestamp": time.time(),
            "cpu_percent": cpu_percent,
            "memory_total": memory.total,
            "memory_used": memory.used,
            "memory_percent": memory.percent,
            "disk_total": disk.total,
            "disk_used": disk.used,
            "disk_percent": (disk.used / disk.total) * 100,
            "network_bytes_sent": net_io.bytes_sent,
            "network_bytes_recv": net_io.bytes_recv,
            "network_packets_sent": net_io.packets_sent,
            "network_packets_recv": net_io.packets_recv
        }
    except ImportError:
        print("Warning: psutil not available, system metrics disabled")
        return {}
    except Exception as e:
        print(f"Warning: Could not collect system metrics: {e}")
        return {}

def execute_telemetry_task(task_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Execute specialized telemetry collection tasks."""
    
    if task_type == "collect_process_list":
        try:
            import psutil
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    proc_info = proc.info
                    if payload.get("include_cmdline", False):
                        proc_info['cmdline'] = ' '.join(proc.cmdline())
                    processes.append(proc_info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            return {"processes": processes}
        except ImportError:
            return {"error": "psutil not available"}
    
    elif task_type == "collect_network_connections":
        try:
            import psutil
            connections = []
            for conn in psutil.net_connections():
                conn_info = {
                    "fd": conn.fd,
                    "family": conn.family.name if conn.family else None,
                    "type": conn.type.name if conn.type else None,
                    "laddr": f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                    "status": conn.status
                }
                if payload.get("include_foreign_addresses", False) and conn.raddr:
                    conn_info["raddr"] = f"{conn.raddr.ip}:{conn.raddr.port}"
                connections.append(conn_info)
            return {"connections": connections}
        except ImportError:
            return {"error": "psutil not available"}
    
    elif task_type == "collect_disk_usage":
        try:
            import psutil
            disk_usage = []
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disk_usage.append({
                        "device": partition.device,
                        "mountpoint": partition.mountpoint,
                        "fstype": partition.fstype,
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                        "percent": (usage.used / usage.total) * 100
                    })
                except PermissionError:
                    pass
            return {"disk_usage": disk_usage}
        except ImportError:
            return {"error": "psutil not available"}
    
    else:
        return {"error": f"Unknown telemetry task type: {task_type}"}

def execute_task(task: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a given task and returns the result."""
    task_id = task.get("task_id")
    task_type = task.get("type")
    payload = task.get("payload", {})
    print(f"Executing task {task_id} of type {task_type}...")

    result: Dict[str, Any] = {
        "task_id": task_id,
        "status": "failed",
        "output": None,
        "error_output": None,
        "exit_code": None
    }

    # Handle telemetry collection tasks
    if task_type.startswith("collect_"):
        try:
            telemetry_result = execute_telemetry_task(task_type, payload)
            result["output"] = json.dumps(telemetry_result, indent=2)
            result["status"] = "completed"
            result["exit_code"] = 0
            print(f"Telemetry task {task_id} completed successfully")
        except Exception as e:
            result["error_output"] = f"Telemetry collection failed: {str(e)}"
            print(f"Telemetry task {task_id} failed: {e}")
        return result

    # Handle command execution tasks
    elif task_type == "execute_command":
        command = payload.get("command")
        if not command:
            result["error_output"] = "No command provided in payload."
            return result
        
        try:
            process = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=task.get("timeout_seconds", 300)
            )
            result["output"] = process.stdout
            result["error_output"] = process.stderr
            result["exit_code"] = process.returncode
            result["status"] = "completed" if process.returncode == 0 else "failed"
            print(f"Command task {task_id} completed with exit code {process.returncode}")
        except subprocess.TimeoutExpired:
            result["error_output"] = "Command timed out."
            result["status"] = "timed_out"
            print(f"Command task {task_id} timed out.")
        except Exception as e:
            result["error_output"] = f"Command execution failed: {str(e)}"
            print(f"Command task {task_id} execution failed: {e}")
    else:
        result["error_output"] = f"Unsupported task type: {task_type}"
        print(f"Task {task_id} unsupported type: {task_type}")

    return result

def load_config():
    """Loads agent configuration from a file (or defaults)."""
    # Placeholder for config loading logic (e.g., from JSON file)
    # For now, return a default config
    return {
        "beacon_interval_seconds": 60,
        "server_url": "http://localhost:8000",
        "agent_id": "default_agent_id",
        "agent_secret": "default_agent_secret",
        "collect_system_metrics": True
    }

def make_authenticated_request(method, endpoint, json_payload=None):
    """Makes an authenticated request to the server."""
    import requests
    global AGENT_CONFIG
    server_url = AGENT_CONFIG.get("server_url")
    agent_id = AGENT_CONFIG.get("agent_id")
    agent_secret = AGENT_CONFIG.get("agent_secret")

    url = f"{server_url}/{endpoint}"
    headers = {
        "X-Agent-ID": agent_id,
        "X-Agent-Secret": agent_secret,
        "Content-Type": "application/json"
    }

    try:
        if method == "POST":
            response = requests.post(url, headers=headers, json=json_payload)
        elif method == "GET":
            response = requests.get(url, headers=headers)
        else:
            print(f"Unsupported method: {method}")
            return None

        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        return response

    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def apply_config_update(config_update):
    """Applies configuration updates received from the server."""
    global AGENT_CONFIG
    try:
        for key, value in config_update.items():
            AGENT_CONFIG[key] = value
        print(f"Configuration updated successfully: {config_update}")
        return True
    except Exception as e:
        print(f"Error applying config update: {e}")
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
    collect_metrics = AGENT_CONFIG.get("collect_system_metrics", True)
    print(f"🚀 Agent starting with beacon interval: {beacon_interval}s, metrics: {collect_metrics}")
    
    pending_task_results: List[Dict[str, Any]] = []
    currently_processing = False

    while True:
        print(f"\n--- Beaconing at {time.strftime('%Y-%m-%d %H:%M:%S')} (interval: {beacon_interval}s) ---")
        
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
        
        # Add system metrics if enabled
        if collect_metrics:
            system_metrics = get_system_metrics()
            if system_metrics:
                beacon_payload["system_metrics"] = system_metrics
        
        # Include pending task results
        if pending_task_results:
            beacon_payload["task_results"] = pending_task_results
            print(f"Including {len(pending_task_results)} task result(s) in beacon.")

        response = make_authenticated_request("POST", "beacon", json_payload=beacon_payload)
        
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
                        new_beacon_interval = AGENT_CONFIG.get("beacon_interval_seconds", beacon_interval)
                        collect_metrics = AGENT_CONFIG.get("collect_system_metrics", collect_metrics)
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
