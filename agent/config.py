import json
import os
from typing import Dict, Any, Optional

CONFIG_FILE_PATH = "agent_config.json"

DEFAULT_SERVER_URL = "https://localhost/api/v1/agent"
DEFAULT_BEACON_INTERVAL = 60
DEFAULT_COLLECT_METRICS = True
DEFAULT_VERIFY_SSL = False  # Set to False for self-signed certificates

config_cache: Optional[Dict[str, Any]] = None

def load_config() -> Dict[str, Any]:
    global config_cache
    if config_cache is not None:
        return config_cache

    if not os.path.exists(CONFIG_FILE_PATH):
        print(f"ERROR: Configuration file '{CONFIG_FILE_PATH}' not found.")
        print("Please create it with your agent_id, psk, and server_url.")
        print("Example agent_config.json:")
        print("{")
        print('  "agent_id": "your-agent-uuid-here",')
        print('  "psk": "your-pre-shared-key-here",')
        print('  "server_url": "http://localhost/api/v1/agent",')
        print('  "beacon_interval_seconds": 60,')
        print('  "collect_system_metrics": true')
        print('  "verify_ssl": false')
        print("}")
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
            loaded_conf.setdefault("collect_system_metrics", DEFAULT_COLLECT_METRICS)
            loaded_conf.setdefault("verify_ssl", DEFAULT_VERIFY_SSL)
            
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
