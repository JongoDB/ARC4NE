# 04 - ARC4NE Client Agent Design

This document outlines the architecture, behavior, and key design considerations for the ARC4NE client agent. [^1]

## 1. Core Principles

*   **Language Choice:** [^1]
    *   **Python:** Recommended as the primary choice due to its synergy with the FastAPI backend, extensive standard library, availability of cross-platform libraries (e.g., `psutil` for system telemetry, `requests` for HTTP), and ease of packaging (e.g., PyInstaller).
    *   **Go:** A strong alternative, offering benefits like single static binary compilation, excellent concurrency support, and good performance. Could be considered if Python's performance or packaging becomes a significant bottleneck.
*   **Platform Agnosticism:** [^1]
    *   The agent must be designed to run on various operating systems, including:
        *   Linux (Ubuntu for MVP, then other distributions like CentOS, Debian).
        *   Windows (Desktop and Server versions).
        *   ARM64 architectures (e.g., Raspberry Pi, AWS Graviton).
    *   This requires using cross-platform libraries where possible and implementing platform-specific abstraction layers for OS interactions (e.g., command execution, telemetry gathering) when necessary.
*   **Lightweight and Efficient:** The agent should have a minimal footprint in terms of CPU, memory, and network usage, especially when idle. [^1]

## 2. Beaconing Model

*   **Type:** Pull-based (agent-initiated communication). The agent periodically contacts the C2 server to check for new tasks and report its status. This is generally preferred for agents in potentially restrictive network environments. [^1]
*   **Interval:** The time between beacons should be configurable by the server via an "Agent Profile." The agent will have a default local interval if no profile is received. [^1]
*   **Jitter:** To avoid predictable network patterns that could be flagged by NIDS, a random jitter (e.g., +/- 0-30% of the beacon interval) should be added to the beacon timing. This is also configurable via the Agent Profile. [^1]
*   **Endpoint:** Agents will beacon to a specific API endpoint, e.g., `POST /api/v1/agent/beacon`. [^1]
*   **Beacon Payload (Agent to Server):** [^1]
    *   Agent ID (sent via `X-Agent-ID` header).
    *   Current status (e.g., "idle", "processing_task", "error").
    *   Basic telemetry (OS info, hostname, agent version, IP addresses).
    *   Results of any completed tasks since the last beacon (can be a list).
*   **Beacon Response (Server to Agent):** [^1]
    *   Acknowledgement.
    *   A list of new tasks to execute.
    *   Optionally, updates to agent configuration (e.g., new beacon interval, jitter settings).

## 3. Secure Command Execution & Task Queue

*   **Task Retrieval:** New tasks are delivered to the agent in the response to its beacon. [^1]
*   **Local Task Queue:** [^1]
    *   Tasks received from the server must be stored persistently on the agent (e.g., in a local SQLite database or a simple file-based queue). This ensures tasks are not lost if the agent restarts.
    *   The queue should support FIFO (First-In, First-Out) processing, though future enhancements might include priority-based tasking.
    *   Each task in the queue should have a status (e.g., "pending", "in_progress", "retrying").
*   **Execution:** [^1]
    *   Tasks should be executed with the least privilege necessary.
    *   Supported task types (MVP and beyond):
        *   **Shell Command Execution:** Execute arbitrary shell commands.
        *   **File Upload/Download:** Transfer files to/from the agent.
        *   **Script Execution:** Execute scripts (e.g., Python, PowerShell) provided by the server.
        *   **Configuration Update:** Modify agent's own configuration.
    *   Task execution should have configurable timeouts (provided by the server with the task).
*   **Result Reporting:** [^1]
    *   Results (stdout, stderr, exit code, status like "completed", "failed", "timed_out") are sent back to the server.
    *   This can be done either with the next beacon or via a dedicated endpoint like `POST /api/v1/agent/task_results`, especially for large outputs.

## 4. Telemetry & System Metadata

*   **Types of Telemetry:** [^1]
    *   **Basic Telemetry:** Sent with every beacon. Includes:
        *   Operating System (e.g., "Windows Server 2019", "Ubuntu 22.04 LTS").
        *   Hostname.
        *   Internal/External IP Addresses.
        *   Agent version.
        *   Current agent status.
    *   **Detailed Telemetry:** Collected and uploaded periodically (frequency configurable by server profile). Includes:
        *   CPU usage (overall, per core).
        *   Memory usage (total, free, used).
        *   Disk usage (per volume: total, free, used).
        *   Network statistics (bytes sent/received per interface, active connections).
        *   Running processes (optional, can be resource-intensive).
*   **Collection:** [^1]
    *   Use platform-agnostic libraries like `psutil` in Python where possible.
    *   For platform-specific information not covered by such libraries, implement OS-specific calls.
*   **Upload:** [^1]
    *   Detailed telemetry should be batched and uploaded to a dedicated endpoint, e.g., `POST /api/v1/agent/telemetry`.
    *   The upload frequency is configurable via the agent's server-side profile.

## 5. Cross-Platform Packaging and Deployment

*   **Python Agents:** [^1]
    *   **PyInstaller:** Can bundle a Python script and its dependencies into a single executable for Windows (`.exe`), Linux (ELF binary), and macOS.
    *   These executables can then be packaged into platform-native installers:
        *   Windows: MSI (using tools like WiX Toolset), NSIS.
        *   Linux: DEB (for Debian/Ubuntu), RPM (for Fedora/CentOS).
*   **Go Agents:** [^1]
    *   Go natively compiles to single static binaries for various platforms and architectures (`GOOS` and `GOARCH` environment variables). This simplifies packaging significantly.
*   **Single Binary Goal:** Aim for a single executable file for ease of deployment. [^1]
*   **Code Signing:** For production deployments, agent executables MUST be code-signed to ensure authenticity and integrity, and to avoid issues with antivirus software and OS security mechanisms (e.g., Windows SmartScreen, macOS Gatekeeper). [^1]
*   **Installation & Service:** Agents should ideally be installable as system services (Windows Service, Linux systemd unit) for persistence and auto-start.

## 6. Agent Lifecycle Flow & Beacon Loop Pseudocode

1.  **Initialization (Agent Startup):** [^1]
    a.  Load configuration from `agent_config.json` (Agent ID, PSK, Server URL, default beacon interval/jitter).
    b.  Initialize local task queue (e.g., connect to/create SQLite DB).
    c.  Initialize telemetry collection mechanisms.
    d.  Perform initial self-check (e.g., network connectivity to server).

2.  **Main Beacon Loop:** [^1]
    \`\`\`
    loop forever:
        calculate next_beacon_time = current_beacon_interval + (random_jitter_percentage * current_beacon_interval)
        sleep until next_beacon_time

        prepare basic_telemetry_data
        retrieve completed_task_results from local_queue

        beacon_payload = {
            "status": current_agent_status,
            "basic_telemetry": basic_telemetry_data,
            "task_results": completed_task_results
        }

        response = send_beacon_to_server("/beacon", beacon_payload) # Signed HTTP POST

        if response is successful:
            acknowledged_at = response.get("acknowledged_at")
            new_tasks = response.get("new_tasks", [])
            config_update = response.get("config_update")

            for task in new_tasks:
                add_task_to_local_queue(task)

            if config_update:
                update_local_agent_configuration(config_update) // e.g., beacon_interval, jitter
                current_beacon_interval = config_update.get("beacon_interval_seconds", current_beacon_interval)
            
            clear successfully_sent_task_results from local_queue // or mark as reported
        else:
            log beacon_send_failure (handle retries or backoff if necessary)
            // Keep task results in queue if beacon failed, attempt to send next time

        // Process tasks from local queue (can be in a separate thread/coroutine for non-blocking beaconing)
        process_one_or_more_tasks_from_local_queue() 
    \`\`\`

3.  **Task Processing (Conceptual, could be async):**
    \`\`\`
    function process_one_or_more_tasks_from_local_queue():
        task = get_next_task_from_queue()
        if task:
            update task_status to "processing"
            execute task_payload (command, script, etc.)
            capture output, error, exit_code
            store task_result locally (ready for next beacon)
            update task_status to "completed" or "failed"
    \`\`\`

4.  **Shutdown:** [^1]
    a.  On receiving a shutdown signal (e.g., SIGTERM, service stop command):
    b.  Attempt to complete any in-progress task gracefully (within a short timeout).
    c.  Attempt a final beacon to report any pending results/status.
    d.  Cleanly close resources (database connections, network sockets).

## 7. Local Configuration Persistence

*   **Configuration File (`agent_config.json` or similar):** [^1]
    *   Stores essential bootstrap information required for the agent to connect and authenticate with the C2 server.
    *   **Contents:**
        *   `agent_id` (UUID string).
        *   `psk` (The Pre-Shared Key string).
        *   `server_url` (Base URL of the ARC4NE API's agent-facing endpoints, e.g., `https://c2.example.com/api/v1/agent`).
        *   Default `beacon_interval_seconds` (e.g., 60).
        *   Optionally, default `jitter_percentage` (e.g., 0.2 for 20%).
    *   **Format:** JSON is recommended for its simplicity and wide support in Python.
    *   **Location:** A standard location, e.g., in the agent's installation directory or a platform-specific application data directory.
    *   **Security:** The file permissions must be strictly controlled (e.g., readable only by the user or service account running the agent) as it contains the sensitive PSK.

## 8. Cache Considerations

*   **Task Queue Cache:** [^1]
    *   As detailed in "Secure Command Execution & Task Queue," tasks received from the server must be stored persistently.
    *   **Technology:** SQLite is a robust and lightweight choice for managing the task queue, allowing for structured storage of task ID, payload, status, retry counts, creation time, etc.
    *   **Resilience:** Ensures tasks are not lost if the agent process restarts or the machine reboots.
*   **Telemetry Cache:** [^1]
    *   **General Approach:** Telemetry should ideally be sent to the server promptly after collection.
    *   **Short-Term Caching:** If the C2 server is temporarily unreachable, the agent might implement a small, short-term cache for detailed telemetry batches.
    *   **Limits:** This cache should be size-limited and/or time-limited to prevent excessive disk usage or stale data accumulation.
    *   **Prioritization:** Critical data like task results should generally be prioritized over historical telemetry if network bandwidth or connectivity is constrained. The agent should not let telemetry caching interfere with its primary C2 functions.
*   **Configuration Cache:**
    *   The agent loads its initial configuration from the file. Server-pushed configuration updates (e.g., new beacon interval) should be applied to the running agent and could optionally be persisted back to the `agent_config.json` file or a separate runtime config cache, so they are retained across restarts.

## 9. Authentication Handshake and Payload Encryption

*   **Authentication Handshake:** [^1]
    *   There isn't a separate "handshake" in the traditional sense for each connection. Authentication is performed on a per-request basis.
    *   As defined in the Security Model (Prompt 03) and Agent Authentication section, every HTTP request from the agent to the server includes the `X-Agent-ID` and `X-Signature` (HMAC-SHA256 of the request body) headers. The server validates these on every incoming request.
*   **Payload Encryption:** [^1]
    *   All agent-server communication MUST occur over HTTPS.
    *   The TLS encryption provided by HTTPS protects the confidentiality and integrity of the entire HTTP payload (including beacon data, task instructions, task results, and telemetry) while in transit between the agent and the Nginx reverse proxy.
    *   No additional application-level payload encryption is planned for the MVP, as HTTPS provides this critical layer of security. Future considerations for extreme-security scenarios might explore this, but it adds complexity.

This agent design aims for a balance of functionality, security, platform compatibility, and operational efficiency, with clear paths for future enhancements.
