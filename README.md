# ARC4NE - Advanced Remote Command & Control for Network Environments

ARC4NE is a modern, secure command and control (C2) framework designed for legitimate system administration, security testing, and network management purposes.

## 🚀 Features

### Core Functionality
- **Secure Agent Communication**: HMAC-SHA256 authenticated agent beacons
- **Task Management**: Queue and execute commands on remote agents
- **Real-time Telemetry**: System metrics and performance monitoring
- **Web-based UI**: Modern React interface for agent and task management
- **RESTful API**: Complete API for programmatic access

### Enhanced Telemetry System
- **Basic Telemetry**: Always available (OS info, hostname, network interfaces)
- **System Metrics**: CPU, memory, disk, and network usage (requires psutil)
- **Telemetry Tasks**: On-demand collection of process lists, network connections, disk usage
- **Configurable Collection**: Enable/disable metrics collection per agent

### Security Features
- **Pre-shared Key Authentication**: Each agent has a unique PSK
- **Request Signing**: All communications are cryptographically signed
- **Agent Isolation**: Agents can only access their own tasks and data
- **Secure Configuration**: Agent configs include backup and restore functionality

## 📋 Prerequisites

### Server Requirements
- Docker and Docker Compose
- Python 3.8+ (for development)
- Node.js 18+ (for frontend development)

### Agent Requirements
- Python 3.6+
- `requests` library (required)
- `psutil` library (optional, for enhanced telemetry)

## 🛠️ Installation

### Quick Start with Docker
\`\`\`bash
# Clone the repository
git clone <repository-url>
cd arc4ne

# Start the services
docker-compose up -d

# Access the web interface
open http://localhost:3000
\`\`\`

### Development Setup
\`\`\`bash
# Backend setup
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# Access development interface
open http://localhost:3000
\`\`\`

## 🤖 Agent Setup

### Method 1: Download via Web UI
1. Open the ARC4NE web interface
2. Go to "Agents" page
3. Click "Register New Agent"
4. Enter agent name and description
5. Click "Download Agent Package"
6. Extract the ZIP file on target system
7. Run the agent:
   \`\`\`bash
   # Basic installation (basic telemetry only)
   pip3 install requests
   python3 arc4ne_agent.py
   
   # Enhanced installation (full telemetry)
   pip3 install requests psutil
   python3 arc4ne_agent.py
   \`\`\`

### Method 2: Manual Configuration
1. Create agent configuration file:
   \`\`\`json
   {
     "agent_id": "your-agent-uuid-here",
     "psk": "your-pre-shared-key-here",
     "server_url": "http://your-server:80/api/v1/agent",
     "beacon_interval_seconds": 60,
     "collect_system_metrics": true
   }
   \`\`\`

2. Install dependencies and run:
   \`\`\`bash
   pip3 install requests psutil
   python3 arc4ne_agent.py
   \`\`\`

## 📊 Telemetry System

### Basic Telemetry (Always Available)
- Operating system information
- Hostname and network interfaces
- Agent version and uptime
- Timestamp of last beacon

### System Metrics (Requires psutil)
- CPU usage percentage
- Memory usage (total, used, percentage)
- Disk usage (total, used, percentage)
- Network I/O statistics (bytes sent/received, packets)

### Telemetry Tasks (On-Demand)
- **Process List**: `collect_process_list`
  - Lists running processes with CPU/memory usage
  - Optional command line inclusion
- **Network Connections**: `collect_network_connections`
  - Active network connections and listening ports
  - Optional foreign address inclusion
- **Disk Usage**: `collect_disk_usage`
  - Detailed disk usage per partition
  - File system types and mount points

### Agent Status Messages
\`\`\`bash
✅ psutil available - enhanced system metrics enabled
⚠️  psutil not available - basic telemetry only
   Install with: pip3 install psutil
\`\`\`

## 🔧 Configuration

### Agent Configuration Options
\`\`\`json
{
  "agent_id": "uuid-string",
  "psk": "pre-shared-key",
  "server_url": "http://server/api/v1/agent",
  "beacon_interval_seconds": 60,
  "collect_system_metrics": true
}
\`\`\`

### Server Configuration
Environment variables can be set in `.env`:
\`\`\`bash
# Database settings
DATABASE_URL=sqlite:///./arc4ne.db

# Security settings
SECRET_KEY=your-secret-key-here

# Server settings
HOST=0.0.0.0
PORT=8000
\`\`\`

## 🎯 Usage Examples

### Basic Command Execution
\`\`\`bash
# Via web UI: Go to Tasks → Create Task
# Task Type: execute_command
# Payload: {"command": "whoami"}
\`\`\`

### Telemetry Collection
\`\`\`bash
# Collect process list with command lines
# Task Type: collect_process_list
# Payload: {"include_cmdline": true}

# Collect network connections
# Task Type: collect_network_connections
# Payload: {"include_foreign_addresses": true}

# Collect disk usage
# Task Type: collect_disk_usage
# Payload: {}
\`\`\`

### Agent Configuration Updates
\`\`\`bash
# Update beacon interval
# Via web UI: Agent Details → Configuration
# Or via API: POST /api/v1/ui/agents/{agent_id}/config
{
  "beacon_interval_seconds": 30,
  "collect_system_metrics": false
}
\`\`\`

## 🔍 Troubleshooting

### Agent Issues

**Agent won't start - Missing psutil**
\`\`\`bash
# Install psutil for enhanced telemetry
pip3 install psutil

# Or run with basic telemetry only
pip3 install requests
python3 arc4ne_agent.py
\`\`\`

**Agent can't connect to server**
\`\`\`bash
# Check server URL in agent_config.json
# Verify server is running: curl http://your-server/api/v1/health
# Check firewall settings
\`\`\`

**Configuration file not found**
\`\`\`bash
# Create agent_config.json in the same directory as arc4ne_agent.py
# Use the web UI to download a pre-configured agent package
\`\`\`

### Server Issues

**Services won't start**
\`\`\`bash
# Check Docker status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs nginx
\`\`\`

**Database issues**
\`\`\`bash
# Reset database (WARNING: destroys all data)
docker-compose down -v
docker-compose up -d
\`\`\`

## 🔒 Security Considerations

### For Legitimate Use Only
This tool is designed for:
- System administration
- Security testing with proper authorization
- Network management
- Educational purposes

### Security Best Practices
- Use strong, unique PSKs for each agent
- Regularly rotate agent credentials
- Monitor agent activity and task execution
- Use HTTPS in production environments
- Implement network segmentation
- Regular security audits

### Authentication Flow
1. Agent signs each request with HMAC-SHA256
2. Server verifies signature using agent's PSK
3. Server validates agent ID and permissions
4. Request processed only if authentication succeeds

## 📚 API Documentation

### Agent Endpoints
- `POST /api/v1/agent/beacon` - Agent check-in and task retrieval
- `POST /api/v1/agent/task_results` - Submit task results
- `POST /api/v1/agent/telemetry` - Submit telemetry data
- `GET /api/v1/agent/files/{agent_id}` - Download agent package

### UI Endpoints
- `GET /api/v1/ui/agents` - List all agents
- `POST /api/v1/ui/agents/{agent_id}/tasks` - Queue task for agent
- `GET /api/v1/ui/tasks` - List all tasks
- `GET /api/v1/ui/telemetry/{agent_id}` - Get agent telemetry

### Health Check
- `GET /api/v1/health` - Server health status

## 🏗️ Architecture

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │    │   FastAPI       │    │   SQLite DB     │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              ▲
                              │ HMAC-SHA256
                              │ Authentication
                              ▼
                    ┌─────────────────┐
                    │   ARC4NE Agent  │
                    │   (Python)      │
                    └─────────────────┘
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is provided for educational and legitimate system administration purposes only. Users are responsible for ensuring compliance with all applicable laws and regulations. The authors are not responsible for any misuse of this software.

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the GitHub issues
3. Create a new issue with detailed information

---

**Version**: 0.2.0 (Enhanced Telemetry)  
**Last Updated**: January 2024
