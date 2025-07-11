import sqlite3
import time
import logging
import threading
import json
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATABASE_PATH = 'arc4ne.db'
TELEMETRY_TABLE = 'telemetry_data'
SYSTEM_METRICS_TABLE = 'system_metrics'

# In-memory storage for MVP (will be replaced with proper DB in production)
DB_AGENTS: Dict[UUID, Dict[str, Any]] = {}
DB_AGENT_PSKS: Dict[UUID, str] = {}
DB_TASKS: Dict[UUID, Dict[str, Any]] = {}
DB_TASK_RESULTS: Dict[UUID, List[Dict[str, Any]]] = {}
DB_TELEMETRY: Dict[UUID, List[Dict[str, Any]]] = {}
DB_CONFIG_UPDATES: Dict[UUID, Optional[Dict[str, Any]]] = {}

class DatabaseManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(DatabaseManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.conn = self.create_connection()
            self.create_tables()
            self.initialized = True

    def create_connection(self):
        """Create a database connection to a SQLite database."""
        conn = None
        try:
            conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
            logging.info(f"Connected to SQLite database: {DATABASE_PATH}")
        except sqlite3.Error as e:
            logging.error(f"Error connecting to SQLite database: {e}")
        return conn

    def create_tables(self):
        """Create tables for telemetry data and system metrics if they don't exist."""
        try:
            cursor = self.conn.cursor()

            # Telemetry Data Table
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {TELEMETRY_TABLE} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    message TEXT,
                    log_level TEXT
                )
            """)
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_telemetry_agent_id ON {TELEMETRY_TABLE} (agent_id)")
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON {TELEMETRY_TABLE} (timestamp)")

            # System Metrics Table
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {SYSTEM_METRICS_TABLE} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    cpu_usage REAL,
                    memory_usage REAL,
                    disk_usage REAL,
                    network_stats TEXT -- JSON representation of network stats
                )
            """)
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_system_metrics_agent_id ON {SYSTEM_METRICS_TABLE} (agent_id)")
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON {SYSTEM_METRICS_TABLE} (timestamp)")

            self.conn.commit()
            logging.info("Telemetry and System Metrics tables created (if they didn't exist).")
        except sqlite3.Error as e:
            logging.error(f"Error creating tables: {e}")

    def store_telemetry_in_db_sqlite(self, agent_id, timestamp, message, log_level):
        """Store telemetry data in the SQLite database."""
        try:
            cursor = self.conn.cursor()
            cursor.execute(f"""
                INSERT INTO {TELEMETRY_TABLE} (agent_id, timestamp, message, log_level)
                VALUES (?, ?, ?, ?)
            """, (agent_id, timestamp, message, log_level))
            self.conn.commit()
            logging.debug(f"Telemetry data stored for agent {agent_id} at {timestamp}")
        except sqlite3.Error as e:
            logging.error(f"Error storing telemetry data: {e}")

    def store_system_metrics_in_db_sqlite(self, agent_id, timestamp, cpu_usage, memory_usage, disk_usage, network_stats):
        """Store system metrics data in the SQLite database."""
        try:
            cursor = self.conn.cursor()
            cursor.execute(f"""
                INSERT INTO {SYSTEM_METRICS_TABLE} (agent_id, timestamp, cpu_usage, memory_usage, disk_usage, network_stats)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (agent_id, timestamp, cpu_usage, memory_usage, disk_usage, network_stats))
            self.conn.commit()
            logging.debug(f"System metrics stored for agent {agent_id} at {timestamp}")
        except sqlite3.Error as e:
            logging.error(f"Error storing system metrics data: {e}")

    def get_telemetry_data(self, agent_id, start_time, end_time):
        """Retrieve telemetry data for a specific agent within a time range."""
        try:
            cursor = self.conn.cursor()
            cursor.execute(f"""
                SELECT timestamp, message, log_level
                FROM {TELEMETRY_TABLE}
                WHERE agent_id = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp
            """, (agent_id, start_time, end_time))
            rows = cursor.fetchall()
            return rows
        except sqlite3.Error as e:
            logging.error(f"Error retrieving telemetry data: {e}")
            return []

    def get_system_metrics(self, agent_id, start_time, end_time):
        """Retrieve system metrics for a specific agent within a time range."""
        try:
            cursor = self.conn.cursor()
            cursor.execute(f"""
                SELECT timestamp, cpu_usage, memory_usage, disk_usage, network_stats
                FROM {SYSTEM_METRICS_TABLE}
                WHERE agent_id = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp
            """, (agent_id, start_time, end_time))
            rows = cursor.fetchall()
            return rows
        except sqlite3.Error as e:
            logging.error(f"Error retrieving system metrics: {e}")
            return []

    def cleanup_old_telemetry_data(self, retention_period_seconds=604800):  # Default: 7 days
        """Clean up old telemetry data based on a retention period."""
        cutoff_timestamp = int(time.time()) - retention_period_seconds
        try:
            cursor = self.conn.cursor()
            cursor.execute(f"""
                DELETE FROM {TELEMETRY_TABLE}
                WHERE timestamp < ?
            """, (cutoff_timestamp,))
            deleted_rows = cursor.rowcount
            self.conn.commit()
            logging.info(f"Deleted {deleted_rows} rows of old telemetry data.")

            cursor.execute(f"""
                DELETE FROM {SYSTEM_METRICS_TABLE}
                WHERE timestamp < ?
            """, (cutoff_timestamp,))
            deleted_rows = cursor.rowcount
            self.conn.commit()
            logging.info(f"Deleted {deleted_rows} rows of old system metrics data.")

        except sqlite3.Error as e:
            logging.error(f"Error cleaning up old telemetry data: {e}")

    def close_connection(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            logging.info("Database connection closed.")

# Initialize database manager
db_manager = DatabaseManager()

# Agent Management Functions (MVP - In-memory storage)
def create_agent_in_db(agent_data) -> UUID:
    """Create a new agent in the database."""
    agent_id = uuid4()
    
    DB_AGENTS[agent_id] = {
        "name": agent_data.name,
        "status": "offline",
        "created_at": datetime.utcnow(),
        "last_seen": None,
        "basic_telemetry": None,
        "beacon_interval_seconds": 60,
        "os_info": None,
        "hostname": None,
        "internal_ip": None,
        "agent_version": None,
        "tags": []
    }
    
    DB_AGENT_PSKS[agent_id] = agent_data.psk
    DB_TASK_RESULTS[agent_id] = []
    DB_TELEMETRY[agent_id] = []
    DB_CONFIG_UPDATES[agent_id] = None
    
    logging.info(f"Created agent {agent_id} with name '{agent_data.name}'")
    return agent_id

def update_agent_status_in_db(agent_id: UUID, status: str, basic_telemetry: Optional[Dict[str, Any]] = None):
    """Update agent status and telemetry."""
    if agent_id in DB_AGENTS:
        DB_AGENTS[agent_id]["status"] = status
        DB_AGENTS[agent_id]["last_seen"] = datetime.utcnow()
        if basic_telemetry:
            DB_AGENTS[agent_id]["basic_telemetry"] = basic_telemetry
            # Update additional fields from telemetry
            if "os_info" in basic_telemetry:
                DB_AGENTS[agent_id]["os_info"] = basic_telemetry["os_info"]
            if "hostname" in basic_telemetry:
                DB_AGENTS[agent_id]["hostname"] = basic_telemetry["hostname"]
            if "internal_ips" in basic_telemetry and basic_telemetry["internal_ips"]:
                DB_AGENTS[agent_id]["internal_ip"] = basic_telemetry["internal_ips"][0]
            if "agent_version" in basic_telemetry:
                DB_AGENTS[agent_id]["agent_version"] = basic_telemetry["agent_version"]
        logging.debug(f"Updated agent {agent_id} status to {status}")

def store_system_metrics_in_db(agent_id: UUID, system_metrics: Dict[str, Any]):
    """Store system metrics from beacon."""
    if agent_id not in DB_TELEMETRY:
        DB_TELEMETRY[agent_id] = []
    
    # Get basic telemetry to include uptime in system metrics if not present
    basic_telemetry = None
    if agent_id in DB_AGENTS and DB_AGENTS[agent_id].get("basic_telemetry"):
        basic_telemetry = DB_AGENTS[agent_id]["basic_telemetry"]
    
    # Copy uptime from basic telemetry to system metrics if missing
    if basic_telemetry and "uptime" in basic_telemetry and "uptime" not in system_metrics:
        system_metrics["uptime"] = basic_telemetry["uptime"]
        print(f"📊 Copied uptime from basic_telemetry to system_metrics: {basic_telemetry['uptime']}s")
    
    # Create a telemetry entry with system metrics
    telemetry_entry = {
        "timestamp": datetime.utcnow(),
        "metrics": [{"system_metrics": system_metrics}],
        "received_at": datetime.utcnow()
    }
    
    DB_TELEMETRY[agent_id].append(telemetry_entry)
    
    # Keep only last 100 entries in memory
    if len(DB_TELEMETRY[agent_id]) > 100:
        DB_TELEMETRY[agent_id] = DB_TELEMETRY[agent_id][-100:]
    
    # Also store in SQLite for persistence
    try:
        timestamp = int(system_metrics.get("timestamp", time.time()))
        cpu_usage = system_metrics.get("cpu_percent")
        memory_usage = system_metrics.get("memory_percent")
        disk_usage = system_metrics.get("disk_percent")
        
        # Create network stats JSON
        network_stats = {
            "bytes_sent": system_metrics.get("network_bytes_sent"),
            "bytes_recv": system_metrics.get("network_bytes_recv"),
            "packets_sent": system_metrics.get("network_packets_sent"),
            "packets_recv": system_metrics.get("network_packets_recv")
        }
        
        db_manager.store_system_metrics_in_db_sqlite(
            str(agent_id), timestamp, cpu_usage, memory_usage, disk_usage, 
            json.dumps(network_stats)
        )
        
        logging.info(f"Stored system metrics for agent {agent_id}: CPU={cpu_usage}%, Memory={memory_usage}%, Disk={disk_usage}%, Uptime={system_metrics.get('uptime', 'N/A')}s")
        
    except Exception as e:
        logging.error(f"Error storing system metrics for agent {agent_id}: {e}")

def get_queued_tasks_for_agent_from_db(agent_id: UUID) -> List[Dict[str, Any]]:
    """Get queued tasks for an agent."""
    tasks = []
    for task_id, task_data in DB_TASKS.items():
        if (task_data.get("agent_id") == agent_id and 
            task_data.get("status") == "queued"):
            tasks.append({
                "task_id": str(task_id),
                "type": task_data.get("type"),
                "payload": task_data.get("payload", {}),
                "timeout_seconds": task_data.get("timeout_seconds", 300)
            })
            # Mark as dispatched
            DB_TASKS[task_id]["status"] = "dispatched"
            DB_TASKS[task_id]["started_at"] = datetime.utcnow()
    
    return tasks

def store_task_result_in_db(agent_id: UUID, result):
    """Store task result."""
    if agent_id not in DB_TASK_RESULTS:
        DB_TASK_RESULTS[agent_id] = []
    
    # Handle both UUID and string task_id
    task_id_str = str(result.task_id) if hasattr(result, 'task_id') else str(result.get('task_id', ''))
    
    result_data = {
        "task_id": task_id_str,
        "status": result.status,
        "output": result.output,
        "error_output": result.error_output,
        "exit_code": result.exit_code,
        "timestamp": datetime.utcnow()
    }
    
    DB_TASK_RESULTS[agent_id].append(result_data)
    
    # Update task status in DB_TASKS
    try:
        task_uuid = UUID(task_id_str) if isinstance(task_id_str, str) else task_id_str
        if task_uuid in DB_TASKS:
            DB_TASKS[task_uuid]["status"] = result.status
            DB_TASKS[task_uuid]["completed_at"] = datetime.utcnow()
            DB_TASKS[task_uuid]["output"] = result.output
            DB_TASKS[task_uuid]["error_output"] = result.error_output
            DB_TASKS[task_uuid]["exit_code"] = result.exit_code
            print(f"✅ Updated task {task_uuid} status to {result.status}")
        else:
            print(f"⚠️  Task {task_uuid} not found in DB_TASKS")
    except ValueError as e:
        print(f"❌ Invalid UUID format for task_id: {task_id_str}, error: {e}")
    
    logging.info(f"Stored task result for agent {agent_id}, task {task_id_str}")

def store_telemetry_in_db(agent_id: UUID, telemetry_batch):
    """Store telemetry batch."""
    if agent_id not in DB_TELEMETRY:
        DB_TELEMETRY[agent_id] = []
    
    for entry in telemetry_batch.entries:
        telemetry_data = {
            "timestamp": entry.timestamp,
            "message": entry.message,
            "log_level": entry.log_level,
            "received_at": datetime.utcnow()
        }
        DB_TELEMETRY[agent_id].append(telemetry_data)
        
        # Also store in SQLite for persistence
        db_manager.store_telemetry_in_db_sqlite(
            str(agent_id), entry.timestamp, entry.message, entry.log_level
        )
    
    logging.info(f"Stored {len(telemetry_batch.entries)} telemetry entries for agent {agent_id}")

def queue_task_for_agent_in_db(agent_id: UUID, task, created_by_user: str = None) -> bool:
    """Queue a task for an agent."""
    if agent_id not in DB_AGENTS:
        return False
    
    task_id = getattr(task, 'task_id', uuid4())
    DB_TASKS[task_id] = {
        "agent_id": agent_id,
        "type": task.type,
        "payload": task.payload,
        "timeout_seconds": getattr(task, 'timeout_seconds', 300),
        "status": "queued",
        "created_at": datetime.utcnow(),
        "created_by_user_id": created_by_user,
        "started_at": None,
        "completed_at": None,
        "output": None,
        "error_output": None,
        "exit_code": None
    }
    
    logging.info(f"Queued task {task_id} for agent {agent_id}")
    return True

def get_pending_config_update(agent_id: UUID) -> Optional[Dict[str, Any]]:
    """Get pending configuration update for an agent."""
    config_update = DB_CONFIG_UPDATES.get(agent_id)
    if config_update:
        # Clear the update after retrieving it
        DB_CONFIG_UPDATES[agent_id] = None
        logging.info(f"Retrieved config update for agent {agent_id}")
    return config_update

def set_agent_config_update(agent_id: UUID, config_update: Dict[str, Any]):
    """Set a configuration update for an agent."""
    DB_CONFIG_UPDATES[agent_id] = config_update
    logging.info(f"Set config update for agent {agent_id}: {config_update}")

def get_all_agents() -> List[Dict[str, Any]]:
    """Get all agents."""
    agents = []
    for agent_id, agent_data in DB_AGENTS.items():
        agents.append({
            "id": str(agent_id),
            "name": agent_data["name"],
            "status": agent_data["status"],
            "created_at": agent_data["created_at"],
            "last_seen": agent_data["last_seen"],
            "basic_telemetry": agent_data.get("basic_telemetry"),
            "beacon_interval_seconds": agent_data.get("beacon_interval_seconds", 60),
            "os_info": agent_data.get("os_info"),
            "hostname": agent_data.get("hostname"),
            "internal_ip": agent_data.get("internal_ip"),
            "agent_version": agent_data.get("agent_version"),
            "tags": agent_data.get("tags", [])
        })
    return agents

def get_all_tasks() -> List[Dict[str, Any]]:
    """Get all tasks."""
    tasks = []
    for task_id, task_data in DB_TASKS.items():
        tasks.append({
            "id": str(task_id),
            "agent_id": str(task_data["agent_id"]),
            "type": task_data["type"],
            "payload": task_data["payload"],
            "status": task_data["status"],
            "created_at": task_data["created_at"],
            "completed_at": task_data.get("completed_at"),
            "timeout_seconds": task_data.get("timeout_seconds", 300)
        })
    return tasks

def get_all_tasks_with_metadata() -> Dict[UUID, Dict[str, Any]]:
    """Get all tasks with full metadata."""
    return DB_TASKS.copy()

def get_agent_by_id(agent_id: UUID) -> Optional[Dict[str, Any]]:
    """Get agent by ID."""
    return DB_AGENTS.get(agent_id)

def get_task_by_id(task_id: UUID) -> Optional[Dict[str, Any]]:
    """Get task by ID."""
    return DB_TASKS.get(task_id)

def delete_agent_from_db(agent_id: UUID) -> bool:
    """Delete an agent from the database."""
    if agent_id in DB_AGENTS:
        del DB_AGENTS[agent_id]
        if agent_id in DB_AGENT_PSKS:
            del DB_AGENT_PSKS[agent_id]
        if agent_id in DB_TASK_RESULTS:
            del DB_TASK_RESULTS[agent_id]
        if agent_id in DB_TELEMETRY:
            del DB_TELEMETRY[agent_id]
        if agent_id in DB_CONFIG_UPDATES:
            del DB_CONFIG_UPDATES[agent_id]
        
        # Remove tasks for this agent
        tasks_to_remove = [task_id for task_id, task_data in DB_TASKS.items() 
                          if task_data.get("agent_id") == agent_id]
        for task_id in tasks_to_remove:
            del DB_TASKS[task_id]
        
        logging.info(f"Deleted agent {agent_id}")
        return True
    return False

def get_telemetry_for_agent(agent_id: UUID, limit: int = 100) -> List[Dict[str, Any]]:
    """Get recent telemetry for an agent."""
    if agent_id not in DB_TELEMETRY:
        return []
    
    # Return most recent entries
    telemetry = DB_TELEMETRY[agent_id]
    recent_telemetry = telemetry[-limit:] if len(telemetry) > limit else telemetry
    
    # Convert to expected format
    result = []
    for entry in recent_telemetry:
        result.append({
            "agent_id": str(agent_id),
            "agent_name": DB_AGENTS.get(agent_id, {}).get("name", "Unknown"),
            "timestamp": entry["timestamp"].isoformat() if isinstance(entry["timestamp"], datetime) else str(entry["timestamp"]),
            "metrics": entry.get("metrics", [{"message": entry.get("message", ""), "log_level": entry.get("log_level", "INFO")}])
        })
    
    return result

def get_recent_telemetry(limit: int = 50) -> List[Dict[str, Any]]:
    """Get recent telemetry from all agents."""
    all_telemetry = []
    
    for agent_id, telemetry_list in DB_TELEMETRY.items():
        agent_name = DB_AGENTS.get(agent_id, {}).get("name", "Unknown")
        for entry in telemetry_list:
            all_telemetry.append({
                "agent_id": str(agent_id),
                "agent_name": agent_name,
                "timestamp": entry["timestamp"].isoformat() if isinstance(entry["timestamp"], datetime) else str(entry["timestamp"]),
                "metrics": entry.get("metrics", [{"message": entry.get("message", ""), "log_level": entry.get("log_level", "INFO")}])
            })
    
    # Sort by timestamp (most recent first) and limit
    all_telemetry.sort(key=lambda x: x["timestamp"], reverse=True)
    return all_telemetry[:limit]

def update_agent_beacon_interval(agent_id: UUID, beacon_interval_seconds: int) -> bool:
    """Update agent beacon interval."""
    if agent_id in DB_AGENTS:
        DB_AGENTS[agent_id]["beacon_interval_seconds"] = beacon_interval_seconds
        # Set a config update for the agent
        set_agent_config_update(agent_id, {"beacon_interval_seconds": beacon_interval_seconds})
        logging.info(f"Updated beacon interval for agent {agent_id} to {beacon_interval_seconds} seconds")
        return True
    return False

def check_and_update_offline_agents() -> int:
    """Check for agents that haven't beaconed recently and mark them offline."""
    offline_count = 0
    current_time = datetime.utcnow()
    
    for agent_id, agent_data in DB_AGENTS.items():
        last_seen = agent_data.get("last_seen")
        beacon_interval = agent_data.get("beacon_interval_seconds", 60)
        
        if last_seen and isinstance(last_seen, datetime):
            # Consider agent offline if it hasn't beaconed in 3x the beacon interval
            offline_threshold = timedelta(seconds=beacon_interval * 3)
            if current_time - last_seen > offline_threshold:
                if agent_data["status"] != "offline":
                    DB_AGENTS[agent_id]["status"] = "offline"
                    offline_count += 1
                    logging.info(f"Marked agent {agent_id} as offline (last seen: {last_seen})")
    
    return offline_count

def get_agent_telemetry(agent_id: UUID, limit: int = 100) -> List[Dict[str, Any]]:
    """Get recent telemetry for an agent."""
    if agent_id not in DB_TELEMETRY:
        return []
    
    # Return most recent entries
    telemetry = DB_TELEMETRY[agent_id]
    return telemetry[-limit:] if len(telemetry) > limit else telemetry

def get_task_results_for_agent(agent_id: UUID, limit: int = 100) -> List[Dict[str, Any]]:
    """Get recent task results for an agent."""
    if agent_id not in DB_TASK_RESULTS:
        return []
    
    # Return most recent results
    results = DB_TASK_RESULTS[agent_id]
    return results[-limit:] if len(results) > limit else results

def get_agent_psk_hash_from_db(agent_id: UUID) -> Optional[str]:
    """Get agent PSK hash from database (for HMAC verification)."""
    # For MVP, we return the raw PSK since we need it for HMAC
    # In production, you'd store a derived key or use proper key management
    return DB_AGENT_PSKS.get(agent_id)

def get_agent_psk_from_db(agent_id: UUID) -> Optional[str]:
    """Get raw agent PSK from database (for HMAC verification)."""
    return DB_AGENT_PSKS.get(agent_id)

# Example Usage (for testing)
if __name__ == '__main__':
    # Test telemetry functionality
    db_manager.store_telemetry_in_db_sqlite("agent001", int(time.time()), "System started", "INFO")
    db_manager.store_system_metrics_in_db_sqlite("agent001", int(time.time()), 75.5, 60.2, 80.1, '{"eth0": {"rx": 1000, "tx": 500}}')

    # Test agent management
    from types import SimpleNamespace
    agent_data = SimpleNamespace(name="test-agent", psk="test-psk-123")
    agent_id = create_agent_in_db(agent_data)
    print(f"Created agent: {agent_id}")
    
    # Test getting agents
    agents = get_all_agents()
    print(f"All agents: {agents}")
