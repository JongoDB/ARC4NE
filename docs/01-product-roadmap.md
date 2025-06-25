# 01 - ARC4NE Product Roadmap

This document outlines the phase-based product roadmap for ARC4NE, designed to achieve centralized, secure, and platform-agnostic tasking and telemetry management of distributed servers or agents. [^1]

## Overall ARC4NE Goals

*   **Centralized Management:** Provide a single pane of glass for managing distributed agents. [^1]
*   **Secure Communication:** Ensure all agent-server and user-server communications are encrypted and authenticated. [^1]
*   **Platform Agnostic Agents:** Support agents running on diverse OS environments (Linux, Windows, ARM). [^1]
*   **Efficient Operations:** Design for pull-based beaconing agents to minimize network footprint. [^1]
*   **Scalable & Resilient Architecture:** Deploy as a lightweight, containerized architecture that can scale. [^1]
*   **Extensibility:** Allow for future expansion with new task types, integrations, and features. [^1]
*   **Air-Gapped Support:** Enable functionality in both cloud-connected and isolated environments. [^1]

## Phase 1: Minimum Viable Product (MVP)

*   **Objectives and Priorities:** [^1]
    *   Establish core Command and Control (C2) functionality: agent registration, basic tasking (shell command execution), and basic telemetry (heartbeat, OS information).
    *   Implement secure agent-server communication (PSK-based HMAC for agent, HTTPS for API).
    *   Deploy a minimal containerized backend (FastAPI, PostgreSQL, Nginx) and a basic web UI (Next.js).
    *   Validate the core architecture, beaconing mechanism, and data flow.
    *   Focus on a single agent platform (Ubuntu Linux x64) to streamline initial development.
*   **Core Features and Components:** [^1]
    *   **Agent (Ubuntu Linux x64):**
        *   Secure registration process (manual PSK configuration).
        *   Pull-based beaconing with a configurable interval (no jitter in MVP).
        *   Execution of basic shell commands received from the server.
        *   Collection and transmission of minimal telemetry (OS info, agent version, hostname).
    *   **Backend (FastAPI):**
        *   API endpoints for agent registration (internal endpoint for MVP).
        *   Endpoints for agent beaconing (task polling, telemetry ingestion).
        *   Basic API key/PSK-based authentication for agents.
        *   JWT-based authentication for a single admin UI user.
    *   **Database (PostgreSQL):**
        *   Initial schemas for `Agents`, `Tasks`, and basic `Telemetry` (heartbeats, OS info).
        *   Schema for `Users` (single admin user for MVP).
    *   **Web UI (Next.js, shadcn/ui, Tailwind CSS):**
        *   Login page for the admin user.
        *   Agent list view displaying registered agents and their status.
        *   Simple task creation form (e.g., input for shell command).
        *   Basic display of telemetry received from agents.
    *   **Containerization (Docker Compose):**
        *   All core ARC4NE services (API, DB, WebUI, Proxy) containerized for local deployment.
*   **Integration Milestones:** [^1]
    *   No external service integrations planned for MVP. Focus is on core ARC4NE components.
*   **Constraints and Dependencies:** [^1]
    *   Limited to Ubuntu Linux x64 for the agent.
    *   Manual PSK distribution for agents.
    *   Single admin user for the UI, no RBAC.
    *   Basic error handling and logging.
*   **MVP Exit Criteria:** [^1]
    *   An Ubuntu agent can successfully register with the backend (via internal API for setup).
    *   The admin user can log into the web UI.
    *   The admin user can view the registered agent in the UI.
    *   The admin user can assign a shell command task to the agent via the UI.
    *   The agent successfully executes the command and reports results/status.
    *   The agent reports basic telemetry (OS info, heartbeat) visible in the UI.
    *   All core services are operational and communicating within the Docker Compose environment.
    *   End-to-end communication is secured (HTTPS for UI/API via Nginx, HMAC for agent comms).
*   **Risk Mitigation Strategies:** [^1]
    *   **Complexity:** Keep features minimal and focused on core C2 loop.
    *   **Security:** Implement basic but sound security measures (HTTPS, HMAC) from the start.
    *   **Deployment:** Use Docker Compose to simplify local setup and ensure consistency.

## Phase 2: Functional Release

*   **Objectives and Priorities:** [^1]
    *   Expand agent capabilities to be cross-platform (Windows, other Linux distros).
    *   Enhance task management with more task types and better result handling.
    *   Introduce Role-Based Access Control (RBAC) in the web UI and API.
    *   Improve system observability with metrics and more detailed logging.
    *   Refine agent beaconing with jitter and more configuration options.
*   **Core Features and Components:** [^1]
    *   **Agent:**
        *   Cross-platform support (Windows, other Linux variants, potentially ARM).
        *   Beaconing with configurable jitter.
        *   Support for additional task types (e.g., file upload/download, script execution).
        *   More detailed telemetry collection (CPU, memory, disk, network usage via `psutil` or similar).
        *   Local task queue persistence.
    *   **Backend:**
        *   Full RBAC implementation for API endpoints.
        *   Endpoints for managing users and roles.
        *   Enhanced task management APIs (status tracking, detailed results).
        *   API for agent profile configuration (beacon interval, jitter, telemetry settings).
        *   Metrics endpoint (e.g., Prometheus compatible).
    *   **Database:**
        *   Schemas for `Roles`, `UserRoles`.
        *   Expanded `Tasks` schema for more detailed status and result tracking.
        *   Expanded `AgentTelemetry` schema for detailed metrics.
        *   Schema for `SystemConfigurations` (for agent profiles).
    *   **Web UI:**
        *   Full RBAC implementation (conditional rendering of UI elements based on user role: Admin, Operator, Viewer).
        *   User management interface (Admin).
        *   Agent profile configuration interface (Admin).
        *   Improved task creation and monitoring views.
        *   Basic telemetry visualization (e.g., simple charts for agent metrics).
*   **Integration Milestones:** [^1]
    *   **Grafana:** Integrate with Grafana for visualizing metrics collected from the backend's Prometheus endpoint.
*   **Constraints and Dependencies:** [^1]
    *   Requires careful design of platform abstraction layers for the agent.
    *   RBAC model needs to be robust and consistently enforced.

## Phase 3: Advanced Features

*   **Objectives and Priorities:** [^1]
    *   Achieve full operational capability with advanced tasking and automation.
    *   Mature security posture with features like mTLS (optional).
    *   Enhance extensibility with a plugin system.
    *   Improve data management and reporting capabilities.
*   **Core Features and Components:** [^1]
    *   **Agent:**
        *   Support for scripted/automated task chains.
        *   Stealthier communication options (if required).
        *   Self-update capabilities.
    *   **Backend:**
        *   Workflow engine for complex task automation.
        *   Advanced analytics and reporting on agent data.
        *   Plugin/extension points for new task types or integrations.
        *   Optional: mTLS for agent-server communication.
    *   **Database:**
        *   Optimized for larger datasets and complex queries.
        *   Long-term data archival strategies.
    *   **Web UI:**
        *   Advanced telemetry dashboarding and querying.
        *   Interface for building and managing automated task workflows.
        *   Plugin management interface.
*   **Integration Milestones:** [^1]
    *   **AWS CLI/S3:** Potential integration for offloading large telemetry data or agent binaries.
    *   **n8n (or similar):** Integration with workflow automation tools for complex C2 operations or notifications.
*   **Constraints and Dependencies:** [^1]
    *   Plugin system requires careful security considerations.
    *   Automation workflows can be complex to design and implement reliably.
