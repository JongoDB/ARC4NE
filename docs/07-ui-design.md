# 07 - ARC4NE UI Design and Interaction Flow

This document outlines the design for ARC4NE's web user interface, focusing on a lightweight, user-friendly, and RBAC-aware experience. [^1]

## 1. Recommended UI Stack

*   **Framework:** Next.js (with React) - Utilizing the App Router for modern routing and Server Components for performance. [^1]
*   **Styling:** Tailwind CSS for utility-first CSS, enabling rapid development of responsive designs. [^1]
*   **Component Library:** shadcn/ui - Provides a set of beautifully designed, accessible, and customizable components built on Radix UI and Tailwind CSS. [^1]
*   **Charting/Visualization:** Recharts or a similar library (e.g., Nivo, Chart.js) for embedding telemetry graphs and dashboard widgets. Recharts is lightweight and composable. [^1]
*   **State Management:**
    *   React Context API for simple global state (e.g., theme, user authentication status).
    *   Server state management primarily handled by Next.js App Router's data fetching capabilities (Server Components, Route Handlers, `fetch` with caching/revalidation). Libraries like SWR or React Query can be considered if more complex client-side caching or optimistic updates are needed later.
*   **Icons:** Lucide React for a comprehensive set of open-source icons.

## 2. General Layout and Design Principles

*   **Overall Structure:**
    *   **Persistent Sidebar Navigation:** A collapsible sidebar on the left for main navigation links (Dashboard, Agents, Tasks, Telemetry, Settings). Icons displayed when collapsed, icons and text when expanded.
    *   **Top Header Bar:** Displays the current page title, user profile/logout options, and potentially global actions or notifications.
    *   **Main Content Area:** The central part of the screen where page-specific views, tables, forms, and charts are rendered.
*   **Design Principles:**
    *   **Lightweight & Performant:** Prioritize fast load times and smooth interactions. Leverage Server Components.
    *   **User-Friendly & Intuitive:** Clear navigation, consistent UI patterns, and informative feedback.
    *   **Responsive:** The UI must adapt gracefully to different screen sizes (desktop, tablet, mobile - though desktop is primary).
    *   **Accessible:** Adhere to WCAG guidelines (semantic HTML, keyboard navigation, ARIA attributes).
    *   **RBAC-Aware:** The interface dynamically adjusts based on the logged-in user's role. [^1]
    *   **Dark Mode Support:** Provide a toggle for light and dark themes.

## 3. Key Pages and Wireframe-Style Descriptions

### 3.1 Login Page (`/login`)

*   **Layout:** Centered card on a clean background.
*   **Elements:**
    *   ARC4NE Logo/Title.
    *   Username input field.
    *   Password input field.
    *   "Sign In" button.
    *   Error message display area.
    *   (Optional) "Forgot Password?" link.

### 3.2 Dashboard (`/`)

*   **Layout:** Grid-based layout for overview widgets.
*   **Elements:**
    *   **Summary Cards (KPIs):**
        *   "Active Agents" (count, with link to Agents page).
        *   "Offline Agents" (count).
        *   "Pending Tasks" (count, with link to Tasks page).
        *   "Recently Completed Tasks" (count).
    *   **Charts/Graphs (using Recharts):**
        *   "Agent Status Distribution" (Pie chart: Online, Offline, Error).
        *   "Task Status Overview" (Bar chart: Queued, Processing, Completed, Failed).
        *   "Recent Activity Feed" (List of recent important events, e.g., new agent online, critical task failed).
    *   Quick access buttons for common actions (e.g., "Task New Agent" - if applicable globally).

### 3.3 Agent List Page (`/agents`)

*   **Layout:** Full-width page with a primary table view.
*   **Elements:**
    *   **Header:** Page title "Agents". "Register New Agent" button (Admin only).
    *   **Filtering/Search Bar:**
        *   Search by agent name, ID, IP, OS.
        *   Filter by status (Online, Offline, Error, Pending Approval).
        *   Filter by tags.
    *   **Agent Table (shadcn/ui Table):**
        *   Columns: Checkbox (for bulk actions), Name, Status (badge), OS Info, Internal IP, Last Seen (relative time, e.g., "5 minutes ago"), Agent Version, Tags.
        *   Row Actions (Dropdown menu per row): View Details, Assign Task, Edit Configuration (Admin), Delete Agent (Admin).
    *   **Bulk Actions Bar (appears when checkboxes selected):** Assign Task to Selected, Add Tag to Selected, Delete Selected (Admin).
    *   Pagination for the table.

### 3.4 Agent Detail Page (`/agents/{agentId}`)

*   **Layout:** Tabbed interface for different aspects of the agent. Header shows Agent Name and Status.
*   **Elements:**
    *   **Header:** Agent Name, Status Badge, Quick Actions (e.g., "Assign Task", "Refresh Data").
    *   **Tabs:**
        *   **Info/Overview:**
            *   Detailed metadata: Agent ID, OS, IPs, Version, Current Profile, Tags (editable for Admin/Operator).
            *   Key telemetry summary (CPU, Mem, Disk - current values).
        *   **Tasks:**
            *   Filtered list/table of tasks assigned to this agent (similar to Task Panel but scoped).
            *   "Create New Task for this Agent" button.
        *   **Telemetry:**
            *   Embedded time-series charts (Recharts) for key metrics (CPU, Memory, Network I/O, Disk I/O).
            *   Time range selector (e.g., Last 1hr, 6hr, 24hr, Custom).
            *   Option to jump to advanced Telemetry Viewer with this agent pre-selected.
        *   **Configuration (Admin/Operator):**
            *   View current agent configuration (beacon interval, jitter, telemetry settings).
            *   Edit configuration / Assign different Agent Profile.
        *   **Logs (Future):** View recent logs from the agent itself (if agent supports sending logs).

### 3.5 Task Panel Page (`/tasks`)

*   **Layout:** Full-width page with a primary table view for all tasks.
*   **Elements:**
    *   **Header:** Page title "Tasks". "Create New Task" button (Operator/Admin).
    *   **Filtering/Search Bar:**
        *   Search by task ID, description, agent name/ID.
        *   Filter by status (Queued, Processing, Completed, Failed, Timed Out, Cancelled).
        *   Filter by task type.
        *   Filter by user who created the task.
    *   **Task Table (shadcn/ui Table):**
        *   Columns: Task ID (shortened, clickable to Task Detail), Agent Name (clickable to Agent Detail), Type, Status (badge), Description (truncated), Created At, Created By, Completed At.
        *   Row Actions (Dropdown menu per row): View Details, Re-run Task (if applicable), Cancel Task (if cancellable).
    *   Pagination for the table.

### 3.6 Task Detail Page (`/tasks/{taskId}`)

*   **Layout:** Detailed view of a single task.
*   **Elements:**
    *   **Header:** Task ID, Task Type, Current Status.
    *   **Task Information Section:**
        *   Agent Name (link to agent).
        *   Created By (user).
        *   Created At, Queued At, Started At, Completed At timestamps.
        *   Timeout.
        *   Description.
    *   **Payload Section:** Display the task payload (e.g., command executed, script content).
    *   **Results Section:**
        *   Stdout (formatted, scrollable).
        *   Stderr (formatted, scrollable).
        *   Exit Code.
    *   Actions: Re-run Task, View Agent.

### 3.7 Telemetry Viewer Page (`/telemetry`) (Advanced - Phase 2/3)

*   **Layout:** Flexible dashboard-like interface for custom telemetry exploration.
*   **Elements:**
    *   **Query Builder/Selectors:**
        *   Select Agent(s) (multi-select dropdown with search).
        *   Select Metric Type(s) (e.g., `cpu.usage.percent`, `memory.free.bytes`).
        *   Select Time Range (calendar picker, predefined ranges).
        *   Filter by telemetry tags.
        *   Aggregation options (avg, sum, min, max over time windows).
    *   **Chart Display Area:** Dynamically add/remove charts based on query.
        *   Line charts for time-series data.
        *   Gauges for current values.
        *   Tables for raw data.
    *   Option to save and load telemetry views/dashboards.

### 3.8 Settings Page (`/settings`) (Admin Only)

*   **Layout:** Tabbed interface for different system settings.
*   **Elements:**
    *   **Tabs:**
        *   **User Management:**
            *   Table of users (Username, Email, Roles, Status, Last Login).
            *   Actions: Create User, Edit User (assign roles, activate/deactivate), Delete User.
        *   **Role Management (Future - if roles become more dynamic than fixed set):**
            *   List roles and their permissions.
        *   **Agent Profiles:**
            *   Table of agent profiles (Name, Description, # Agents Assigned).
            *   Actions: Create Profile, Edit Profile (modify beacon interval, jitter, telemetry settings), Delete Profile.
            *   Set a default profile.
        *   **System Settings (Future):**
            *   Global C2 server settings (e.g., default task timeouts, API rate limits).
            *   Secret management links/info (if applicable).
            *   License information (if applicable).
        *   **Audit Logs:**
            *   Interface to view and filter audit logs.

## 4. RBAC-Aware Interface

The UI must dynamically adapt based on the logged-in user's role. [^1]

*   **Conditional Rendering:**
    *   Navigation items in the sidebar (e.g., "Settings" only for Admins).
    *   Buttons and actions (e.g., "Register New Agent", "Create User" only for Admins; "Create Task" for Operators/Admins).
    *   Form fields or entire sections within pages (e.g., editing certain configurations).
*   **Disabled Elements:** Some elements might be visible but disabled for users without sufficient permissions, with a tooltip explaining why.
*   **Data Scoping:** API responses might be implicitly filtered by RBAC, but the UI should also be mindful of not requesting actions the user isn't permitted to perform.
*   **Frontend Logic:** The `useAuth()` hook (or similar) will provide the user's roles, which components can use to make rendering decisions.

## 5. Common Workflows

*   **Tasking an Agent:** [^1]
    1.  Operator/Admin navigates to Agent List or specific Agent Detail page.
    2.  Clicks "Assign Task" / "Create New Task".
    3.  Fills out task creation form (select task type, provide payload, set timeout).
    4.  Submits form. Task appears in Task Panel with "Queued" status.
    5.  Agent beacons, picks up task, status changes to "Processing".
    6.  Agent completes task, reports results, status changes to "Completed" or "Failed".
*   **Registering a New Agent (Admin):** [^1]
    1.  Admin navigates to Agent List page.
    2.  Clicks "Register New Agent".
    3.  Fills out agent details (e.g., name, initial tags).
    4.  System generates Agent ID and PSK, displays them to Admin.
    5.  Admin securely configures the agent with these credentials.
    6.  Agent starts, beacons in, appears in Agent List (possibly as "Pending Approval" initially, then "Online").
*   **Viewing Telemetry:** [^1]
    1.  User navigates to Agent Detail page, Telemetry tab.
    2.  Views pre-configured charts for common metrics.
    3.  Adjusts time range.
    4.  (Optional) Navigates to advanced Telemetry Viewer for custom queries.
*   **Setting/Changing Agent Beacon Policy (Admin):** [^1]
    1.  Admin navigates to Settings -> Agent Profiles.
    2.  Creates a new profile or edits an existing one, setting beacon interval, jitter, etc.
    3.  Admin navigates to Agent Detail page -> Configuration tab (or Agent List for bulk assignment).
    4.  Assigns the desired profile to the agent(s).
    5.  Agent picks up new configuration on its next beacon.

## 6. Live Data Updates

*   **Initial Phases (MVP/Functional Release):** [^1]
    *   **Polling:** Implement regular polling on pages displaying dynamic data (Dashboard, Agent List, Task Panel).
        *   Use hooks like SWR or React Query for efficient data fetching, caching, and revalidation on an interval (e.g., every 5-30 seconds).
        *   Next.js Server Components can also be revalidated periodically or on demand.
*   **Future (Advanced Features):** [^1]
    *   **WebSockets or Server-Sent Events (SSE):** For real-time updates to agent statuses, task progress, and critical alerts. This provides a more responsive experience than polling but adds complexity to the backend and Nginx configuration.
    *   SSE is generally simpler for one-way server-to-client updates. WebSockets are bidirectional.

This UI design aims to provide a functional, intuitive, and scalable interface for managing the ARC4NE C2 system.
