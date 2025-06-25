# ARC4NE - C2 System

This repository contains the source code for ARC4NE: **Accelerated Remote Configuration, Collection, Command, and Control for Node-based Environments**.

## Project Structure

\`\`\`
arc4ne/
├── backend/          # FastAPI backend API
├── frontend/         # Next.js web UI
├── agent/           # Python-based agent
├── nginx/           # Nginx reverse proxy configuration
├── docs/            # Detailed planning and design documents
├── docker-compose.yml
├── .env.example
└── README.md
\`\`\`

## Getting Started

1. **Prerequisites:**
   - Docker and Docker Compose installed
   - Ports 80, 443, 3000, 8000, and 5432 available on your system

2. **Setup:**
   \`\`\`bash
   # Create environment file
   cp .env.example .env
   # Edit .env if needed, but defaults should work for testing
   \`\`\`

3. **Start all services:**
   \`\`\`bash
   docker compose up --build
   \`\`\`

4. **Access the application:**
   - Web UI: http://localhost
   - Default login: username `admin`, password `admin123`

## MVP Testing Steps

This guide outlines how to test the communication between the agent and the backend API.

### Prerequisites

1. **Backend Running:** All services are running via `docker compose up`.
2. **Agent Environment:** You have a local Python environment with `requests` installed (`pip install requests`).

### Step 1: Register a Test Agent & Configure

1. **Register Agent via API:** Use an HTTP client (like `curl` or Postman) to send a `POST` request to the internal agent creation endpoint.

   - **URL:** `http://localhost/api/v1/agent/_internal/create_agent_for_testing`
   - **Method:** `POST`
   - **Body (JSON):**
     \`\`\`json
     {
       "name": "test-ubuntu-agent-01",
       "psk": "MySuperSecretPSK123!"
     }
     \`\`\`

2. **Capture Response:** The API will return an `agent_id`. Note this ID and the PSK you used.

3. **Create `agent_config.json`:** In the `/agent` directory, create an `agent_config.json` file with the details from the previous step.

   \`\`\`json
   {
     "agent_id": "your-actual-agent-uuid-from-backend",
     "psk": "MySuperSecretPSK123!",
     "server_url": "http://localhost/api/v1/agent",
     "beacon_interval_seconds": 15
   }
   \`\`\`

### Step 2: Run Agent & Observe Beacon

1. **Start Agent:** In a new terminal, run the agent script:
   \`\`\`bash
   python agent/arc4ne_agent.py
   \`\`\`
2. **Observe Logs:**
   - **Agent Terminal:** Look for successful beacon messages (`Request successful: 200`).
   - **Docker Terminal:** Check the `arc4ne-api` logs for incoming requests to `/api/v1/agent/beacon` and status update messages.

### Step 3: Test Tasking

1. **Queue a Task:** While the agent is running, use your HTTP client to queue a task.

   - **URL:** `http://localhost/api/v1/agent/_internal/queue_task_for_testing/{your_agent_id}` (replace with your agent's ID).
   - **Method:** `POST`
   - **Body (JSON):**
     \`\`\`json
     {
       "type": "execute_command",
       "payload": { "command": "echo 'Hello ARC4NE from Agent!'" }
     }
     \`\`\`

2. **Observe Logs:**
   - **Agent Terminal:** The agent should receive the task on its next beacon, log that it's executing it, and then include the result in a subsequent beacon.
   - **Docker Terminal:** The `arc4ne-api` logs should show the task result being received and stored.

### Step 4: Test Authentication Failure

1. **Modify PSK:** Stop the agent. In `agent_config.json`, change the `psk` to an incorrect value.
2. **Restart Agent:** Run the agent again.
3. **Observe Logs:** The agent's requests should now fail with a `401 Unauthorized` error. The `arc4ne-api` logs will show requests being rejected due to an invalid signature.

## Troubleshooting

### Common Issues:

1. **"Failed to fetch" errors:**
   - Check that all containers are running: `docker compose ps`
   - Check container logs: `docker compose logs arc4ne-api`

2. **Login fails with correct credentials:**
   - Check API logs: `docker compose logs arc4ne-api`
   - Verify CORS settings in the backend

3. **Redirects not working:**
   - Check browser console for JavaScript errors
   - Verify nginx proxy configuration

4. **Agent can't connect:**
   - Ensure agent config has correct server_url
   - Check that agent PSK matches what was generated

### Debug Commands:

\`\`\`bash
# Check all container status
docker compose ps

# View logs for specific service
docker compose logs arc4ne-api
docker compose logs arc4ne-webui
docker compose logs arc4ne-proxy

# Restart specific service
docker compose restart arc4ne-api

# Stop all services
docker compose down

# Clean rebuild
docker compose down
docker compose up --build
\`\`\`

## Architecture

ARC4NE follows a microservices architecture with the following components:

- **arc4ne-proxy** (Nginx): Reverse proxy and SSL termination
- **arc4ne-api** (FastAPI): Backend API server
- **arc4ne-webui** (Next.js): Frontend web interface
- **arc4ne-db** (PostgreSQL): Database for persistent storage

For detailed architecture documentation, see the `/docs` directory.
\`\`\`

Let me also remove the shell scripts that are no longer needed:

```typescriptreact file="check-imports.sh" isDeleted="true"
...deleted...
