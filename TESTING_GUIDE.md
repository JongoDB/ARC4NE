# ARC4NE Authentication Testing Guide

This guide walks you through testing the complete authentication flow with the Docker stack.

## Prerequisites

1. Docker and Docker Compose installed
2. Ports 80, 443, 3000, 8000, and 5432 available on your system

## Step 1: Start the Full Stack

1. **Clone/Navigate to the project directory**
   \`\`\`bash
   cd arc4ne
   \`\`\`

2. **Ensure you have the .env file**
   \`\`\`bash
   cp .env.example .env
   # Edit .env if needed, but defaults should work for testing
   \`\`\`

3. **Build and start all services**
   \`\`\`bash
   docker-compose up --build
   \`\`\`

4. **Wait for all services to be ready**
   Look for these log messages:
   - `arc4ne-api` container: "ARC4NE API starting up..."
   - `arc4ne-webui` container: "Ready - started server on..."
   - `arc4ne-db` container: "database system is ready to accept connections"
   - `arc4ne-proxy` container: nginx startup messages

## Step 2: Test Authentication Flow

### 2.1 Access the Application
1. Open your browser and go to: `http://localhost`
2. You should be automatically redirected to: `http://localhost/login`

### 2.2 Test Login
1. **Use the default credentials:**
   - Username: `admin`
   - Password: `admin123`

2. **Click "Sign in"**
   - You should see "Signing in..." briefly
   - On success, you'll be redirected to the dashboard at `http://localhost/`

### 2.3 Verify Dashboard Access
1. You should see the ARC4NE dashboard with:
   - Sidebar navigation (Dashboard, Agents, Tasks, Settings)
   - Three cards showing: Active Agents (0), Offline Agents (0), Pending Tasks (0)

### 2.4 Test Protected Routes
1. **Navigate to Agents page:** Click "Agents" in the sidebar
   - Should show an empty agents table with "Register New Agent" button
   - URL should be `http://localhost/agents`

2. **Navigate to Tasks page:** Click "Tasks" in the sidebar
   - Should show "Task management table will be displayed here"
   - URL should be `http://localhost/tasks`

### 2.5 Test Logout
1. **For now, logout via browser console** (we'll add a logout button later):
   \`\`\`javascript
   // Open browser dev tools (F12) and run:
   fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
     .then(() => window.location.reload())
   \`\`\`

2. **Verify logout:**
   - Page should redirect back to `/login`
   - Trying to access `/` should redirect to `/login`

## Step 3: Test API Authentication

### 3.1 Test Unauthenticated API Access
1. **Open browser dev tools and try accessing protected endpoint:**
   \`\`\`javascript
   fetch('/api/v1/agents')
     .then(r => r.json())
     .then(console.log)
     .catch(console.error)
   \`\`\`
   - Should return 401 Unauthorized

### 3.2 Test Authenticated API Access
1. **Login first through the UI**
2. **Then test the agents endpoint:**
   \`\`\`javascript
   // This should work after login due to the auth context
   fetch('/api/v1/agents', { credentials: 'include' })
     .then(r => r.json())
     .then(console.log)
     .catch(console.error)
   \`\`\`
   - Should return an empty array `[]` (no agents registered yet)

## Step 4: Test with a Real Agent (Optional)

### 4.1 Register a Test Agent
1. **Create a test agent via API:**
   \`\`\`bash
   curl -X POST http://localhost/api/v1/agent/_internal/create_agent_for_testing \
     -H "Content-Type: application/json" \
     -d '{"name": "test-agent-01", "psk": "TestPSK123!"}'
   \`\`\`

2. **Note the returned agent_id**

### 4.2 Configure and Run Agent
1. **Create agent config file:**
   \`\`\`bash
   cd agent
   cat > agent_config.json << EOF
   {
     "agent_id": "YOUR_AGENT_ID_FROM_STEP_4.1",
     "psk": "TestPSK123!",
     "server_url": "http://localhost/api/v1/agent",
     "beacon_interval_seconds": 15
   }
   EOF
   \`\`\`

2. **Install Python dependencies and run agent:**
   \`\`\`bash
   pip install requests
   python arc4ne_agent.py
   \`\`\`

### 4.3 Verify Agent in UI
1. **Refresh the Agents page in the browser**
2. **You should now see:**
   - The test agent listed in the table
   - Status should show as "idle" or "online"
   - Last seen should be recent

## Expected Results

✅ **Login page loads correctly**
✅ **Authentication with admin/admin123 works**
✅ **Dashboard loads after successful login**
✅ **All navigation links work**
✅ **Unauthenticated API calls are blocked**
✅ **Authenticated API calls work**
✅ **Logout redirects to login page**
✅ **Protected routes redirect to login when not authenticated**

## Troubleshooting

### Common Issues:

1. **"Failed to fetch" errors:**
   - Check that all containers are running: `docker-compose ps`
   - Check container logs: `docker-compose logs arc4ne-api`

2. **Login fails with correct credentials:**
   - Check API logs: `docker-compose logs arc4ne-api`
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
docker-compose ps

# View logs for specific service
docker-compose logs arc4ne-api
docker-compose logs arc4ne-webui
docker-compose logs arc4ne-proxy

# Restart specific service
docker-compose restart arc4ne-api

# Stop all services
docker-compose down

# Clean rebuild
docker-compose down
docker-compose up --build
