import time
import json
import platform
import socket
import subprocess
import hmac
import hashlib
import requests # type: ignore
import urllib3
from typing import Dict, Any, List, Optional
from uuid import UUID # For type hinting if needed, though config stores as str

from config import load_config, save_config_updates

# Disable SSL warnings when verification is disabled
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Try to import psutil, but make it optional
try:
    import psutil
    PSUTIL_AVAILABLE = True
    print("✅ psutil available - enhanced system metrics enabled")
except ImportError:
    PSUTIL_AVAILABLE = False
    print("⚠️  psutil not available - basic telemetry only")
    print("   Install with: pip3 install psutil")

# Global agent configuration
AGENT_CONFIG: Dict[str, Any] = {}
AGENT_VERSION = "0.2.0"

def get_agent_id() -> str:
    return AGENT_CONFIG.get("agent_id", "unknown_agent")

def get_psk() -> str:
    return AGENT_CONFIG.get("psk", "")

def get_server_url() -> str:
    return AGENT_CONFIG.get("server_url", "")

def get_verify_ssl() -> bool:
    return AGENT_CONFIG.get("verify_ssl", False)

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
    verify_ssl = get_verify_ssl()

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

        if method.upper() == "POST":
            response = requests.post(url, data=payload_bytes, headers=headers, timeout=30, verify=verify_ssl)
        elif method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30, verify=verify_ssl)
        else:
            print(f"Unsupported HTTP method: {method}")
            return None

        response.raise_for_status()
        print(f"Request successful: {response.status_code}")
        return response
    except requests.exceptions.RequestException as e:
        print(f"ERROR: HTTP Request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                print(f"Server response: {e.response.text}")
            except Exception:
                pass
        return None
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during request: {e}")
        return None

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

        basic_info = {
            "os_info": f"{platform.system()} {platform.release()}",
            "hostname": hostname,
            "agent_version": AGENT_VERSION,
            "internal_ips": internal_ips,
            "timestamp": time.time()
        }

        # Add uptime if psutil is available
        if PSUTIL_AVAILABLE:
            try:
                basic_info["uptime"] = time.time() - psutil.boot_time()
            except:
                basic_info["uptime"] = 0
        else:
            basic_info["uptime"] = 0

        return basic_info

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
    """Collects system performance metrics (requires psutil)."""
    if not PSUTIL_AVAILABLE:
        return {}

    try:
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
    except Exception as e:
        print(f"Warning: Could not collect system metrics: {e}")
        return {}

def execute_telemetry_task(task_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Execute specialized telemetry collection tasks."""

    if not PSUTIL_AVAILABLE:
        return {"error": "psutil not available - enhanced telemetry disabled"}

    if task_type == "collect_process_list":
        try:
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
        except Exception as e:
            return {"error": f"Failed to collect process list: {str(e)}"}

    elif task_type == "collect_network_connections":
        try:
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
        except Exception as e:
            return {"error": f"Failed to collect network connections: {str(e)}"}

    elif task_type == "collect_disk_usage":
        try:
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
        except Exception as e:
            return {"error": f"Failed to collect disk usage: {str(e)}"}

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

        # Handle system metrics collection toggle
        if "collect_system_metrics" in config_update:
            new_setting = config_update["collect_system_metrics"]
            if isinstance(new_setting, bool):
                old_setting = AGENT_CONFIG.get("collect_system_metrics", True)
                AGENT_CONFIG["collect_system_metrics"] = new_setting
                updates_applied.append(f"collect_system_metrics: {old_setting} → {new_setting}")
            else:
                print(f"⚠️  Invalid collect_system_metrics setting: {new_setting}")

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
    collect_metrics = AGENT_CONFIG.get("collect_system_metrics", True)
    verify_ssl = AGENT_CONFIG.get("verify_ssl", False)

    print(f"🚀 Agent starting with:")
    print(f"   - Beacon interval: {beacon_interval}s")
    print(f"   - System metrics: {'enabled' if collect_metrics else 'disabled'}")
    print(f"   - Enhanced telemetry: {'available' if PSUTIL_AVAILABLE else 'unavailable (install psutil)'}")
    print(f"   - SSL verification: {'enabled' if verify_ssl else 'disabled (self-signed certs allowed)'}")

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

        # Add system metrics if enabled and available
        if collect_metrics and PSUTIL_AVAILABLE:
            system_metrics = get_system_metrics()
            if system_metrics:
                beacon_payload["system_metrics"] = system_metrics
                print(f"📊 Including system metrics in beacon")
        elif collect_metrics and not PSUTIL_AVAILABLE:
            print(f"⚠️  System metrics requested but psutil unavailable")

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
                        new_collect_metrics = AGENT_CONFIG.get("collect_system_metrics", collect_metrics)
                        if new_beacon_interval != beacon_interval:
                            beacon_interval = new_beacon_interval
                            print(f"🔄 Beacon interval updated to {beacon_interval}s (takes effect next cycle)")
                        if new_collect_metrics != collect_metrics:
                            collect_metrics = new_collect_metrics
                            print(f"🔄 System metrics collection {'enabled' if collect_metrics else 'disabled'}")

            except json.JSONDecodeError:
                print("ERROR: Could not decode JSON response from server.")
            except Exception as e:
                print(f"ERROR: Error processing beacon response: {e}")
        else:
            print("Beacon failed or received non-200 response.")

        print(f"😴 Sleeping for {beacon_interval} seconds...")
        time.sleep(beacon_interval)

if __name__ == "__main__":
    print("ARC4NE Agent (Enhanced Telemetry) starting...")
    beacon_loop()
