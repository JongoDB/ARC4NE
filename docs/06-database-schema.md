# 06 - ARC4NE Database Schema Design

This document outlines the PostgreSQL relational schema for ARC4NE, designed to store information about users, roles, agents, tasks, telemetry, system configurations, and audit logs. [^1]

## 1. Entity Relationship Diagram (Conceptual - Mermaid Syntax)

\`\`\`mermaid
erDiagram
    USERS ||--o{ USER_ROLES : "has"
    ROLES ||--o{ USER_ROLES : "defines"
    USERS ||--o{ TASKS : "creates"
    USERS ||--o{ AGENTS : "approves"
    USERS ||--o{ AUDIT_LOGS : "performs_action"

    AGENTS ||--o{ TASKS : "assigned_to"
    AGENTS ||--o{ AGENT_TELEMETRY : "reports"
    AGENTS ||--o{ AUDIT_LOGS : "is_subject_of_action"
    AGENTS }|--|| SYSTEM_CONFIGURATIONS : "uses_profile"

    SYSTEM_CONFIGURATIONS {
        UUID id PK
        VARCHAR name
        VARCHAR type
        JSONB configuration_data
        TEXT description
        BOOLEAN is_default
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    ROLES {
        UUID id PK
        VARCHAR name
        TEXT description
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    USERS {
        UUID id PK
        VARCHAR username
        VARCHAR email
        TEXT password_hash
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ last_login_at
        VARCHAR last_login_ip
    }

    USER_ROLES {
        UUID user_id PK, FK
        UUID role_id PK, FK
        TIMESTAMPTZ assigned_at
    }

    AGENTS {
        UUID id PK
        VARCHAR name
        VARCHAR agent_identifier UK
        TEXT psk_hash
        VARCHAR os_info
        VARCHAR internal_ip
        VARCHAR external_ip
        VARCHAR status
        TIMESTAMPTZ last_seen
        VARCHAR agent_version
        JSONB tags
        UUID profile_id FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ approved_at
        UUID approved_by_user_id FK
    }

    TASKS {
        UUID id PK
        UUID agent_id FK
        UUID created_by_user_id FK
        VARCHAR type
        JSONB payload
        VARCHAR status
        TEXT output
        TEXT error_output
        INTEGER exit_code
        TEXT description
        INTEGER timeout_seconds
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ queued_at
        TIMESTAMPTZ started_at
        TIMESTAMPTZ completed_at
    }

    AGENT_TELEMETRY {
        BIGSERIAL id PK
        UUID agent_id FK
        TIMESTAMPTZ timestamp
        VARCHAR metric_type
        JSONB metric_value
        VARCHAR unit
        JSONB tags
    }

    AUDIT_LOGS {
        BIGSERIAL id PK
        UUID user_id FK
        UUID agent_id FK
        UUID target_entity_id
        VARCHAR target_entity_type
        VARCHAR action_type
        JSONB details
        VARCHAR status
        VARCHAR ip_address
        TEXT user_agent
        TIMESTAMPTZ timestamp
    }
\`\`\`

## 2. Table Definitions (SQL CREATE TABLE)

Standard `updated_at` trigger function:

\`\`\`sql
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
\`\`\`

### 2.1 `roles`
Defines user roles within the system. [^1]

\`\`\`sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'admin', 'operator', 'viewer'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE roles IS 'Defines user roles (admin, operator, viewer).';

CREATE TRIGGER set_timestamp_roles
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
\`\`\`

### 2.2 `users`
Stores web UI user accounts. [^1]

\`\`\`sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(45) -- For IPv4 or IPv6
);
COMMENT ON TABLE users IS 'Stores web UI user accounts and their credentials.';

CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
\`\`\`

### 2.3 `user_roles` (Junction Table)
Links users to their roles (many-to-many). [^1]

\`\`\`sql
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE user_roles IS 'Junction table for many-to-many relationship between users and roles.';
\`\`\`

### 2.4 `system_configurations`
Stores agent profiles, system policies, etc. An agent profile would define beacon interval, jitter, telemetry settings. [^1]

\`\`\`sql
CREATE TABLE system_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- e.g., 'agent_profile', 'global_policy', 'telemetry_config'
    configuration_data JSONB NOT NULL, -- Actual configuration settings (e.g., {"beacon_interval": 60, "jitter_percent": 0.1})
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE, -- For indicating a default profile/policy
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE system_configurations IS 'Stores agent profiles, system policies, and other configurations.';
CREATE INDEX idx_system_configurations_type ON system_configurations(type);

CREATE TRIGGER set_timestamp_system_configurations
BEFORE UPDATE ON system_configurations
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
\`\`\`

### 2.5 `agents`
Information about registered ARC4NE agents. [^1]

\`\`\`sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255), -- User-friendly name for the agent
    agent_identifier VARCHAR(255) UNIQUE, -- A unique string identifier used by the agent in its config, could be hostname or a custom ID.
    psk_secret_ref TEXT, -- Reference to the PSK stored in a secure vault or encrypted field. For HMAC, server needs the raw PSK.
                         -- Storing psk_hash is only for password-like verification, not HMAC.
    os_info VARCHAR(255),
    internal_ip VARCHAR(45), -- Last reported internal IP
    external_ip VARCHAR(45), -- Last reported external IP (e.g., from Nginx)
    status VARCHAR(50) NOT NULL DEFAULT 'pending_approval', -- e.g., 'pending_approval', 'online', 'offline', 'error', 'disabled'
    last_seen TIMESTAMPTZ, -- Last time agent successfully beaconed
    agent_version VARCHAR(50),
    tags JSONB, -- e.g., ["critical", "webserver", "location:dc1"]
    profile_id UUID REFERENCES system_configurations(id) ON DELETE SET NULL, -- Link to an agent profile
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When agent record was created
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When agent record was last updated
    approved_at TIMESTAMPTZ, -- When agent was approved by an admin
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL -- User who approved the agent
);
COMMENT ON TABLE agents IS 'Stores information about registered ARC4NE agents.';
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_seen ON agents(last_seen DESC);
CREATE INDEX idx_agents_tags ON agents USING GIN(tags); -- For querying tags in JSONB

CREATE TRIGGER set_timestamp_agents
BEFORE UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
\`\`\`

### 2.6 `tasks`
Tasks assigned to agents, including their status and results. [^1]

\`\`\`sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL, -- e.g., 'execute_command', 'file_transfer_up', 'file_transfer_down', 'run_script', 'update_config'
    payload JSONB NOT NULL, -- Task-specific parameters (e.g., {"command": "ls -l"}, {"source_path": "/tmp/file", "dest_url": "..."})
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- e.g., 'queued', 'sent_to_agent', 'processing', 'completed', 'failed', 'timed_out', 'cancelled'
    output TEXT, -- Standard output from the task
    error_output TEXT, -- Standard error from the task
    exit_code INTEGER, -- Exit code of the command/script
    description TEXT, -- User-provided description of the task
    timeout_seconds INTEGER DEFAULT 300, -- Task execution timeout
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When task was created in system
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When task status or details last changed
    queued_at TIMESTAMPTZ DEFAULT NOW(), -- When task was made available to agent (or first attempted)
    sent_to_agent_at TIMESTAMPTZ, -- When task was actually picked up by agent
    started_at TIMESTAMPTZ, -- When agent reported starting task processing
    completed_at TIMESTAMPTZ -- When agent reported finishing task processing or server marked it as completed/failed
);
COMMENT ON TABLE tasks IS 'Stores tasks assigned to agents, their parameters, status, and results.';
CREATE INDEX idx_tasks_agent_id_status ON tasks(agent_id, status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

CREATE TRIGGER set_timestamp_tasks
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
\`\`\`

### 2.7 `agent_telemetry`
Telemetry data reported by agents (e.g., CPU, memory, disk, network). [^1]

\`\`\`sql
CREATE TABLE agent_telemetry (
    id BIGSERIAL PRIMARY KEY, -- Use BIGSERIAL for high-volume data
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Timestamp of when the metric was recorded by the agent or received by server
    metric_type VARCHAR(100) NOT NULL, -- e.g., 'cpu.usage.percent', 'memory.free.bytes', 'disk.usage.percent./'
    metric_value JSONB NOT NULL, -- Can be number, string, boolean, or a JSON object for complex metrics (e.g. per-core CPU)
    unit VARCHAR(50), -- e.g., '%', 'bytes', 'MB', 'count'
    tags JSONB -- e.g., {'core': '1', 'disk_path': '/dev/sda1', 'process_name': 'nginx'}
);
COMMENT ON TABLE agent_telemetry IS 'Stores time-series telemetry data reported by agents.';
CREATE INDEX idx_agent_telemetry_agent_id_timestamp ON agent_telemetry(agent_id, timestamp DESC);
CREATE INDEX idx_agent_telemetry_metric_type ON agent_telemetry(metric_type);
CREATE INDEX idx_agent_telemetry_tags ON agent_telemetry USING GIN(tags); -- For querying tags in JSONB
-- For performance on very large telemetry tables, consider TimescaleDB extension or native PostgreSQL partitioning.
-- Example: CREATE TABLE agent_telemetry ( ... ) PARTITION BY RANGE (timestamp);
\`\`\`

### 2.8 `audit_logs`
Records significant system actions for security, troubleshooting, and compliance. [^1]

\`\`\`sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY, -- Use BIGSERIAL for high-volume data
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- User performing action (nullable for system/agent actions)
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL, -- Agent subject of action (nullable if not agent-specific)
    target_entity_id TEXT, -- ID of entity being acted upon (e.g. task_id, user_id, agent_id, role_id, profile_id). TEXT for flexibility.
    target_entity_type VARCHAR(50), -- Type of entity (e.g. 'task', 'user', 'agent', 'role', 'profile', 'system_config')
    action_type VARCHAR(100) NOT NULL, -- e.g., 'USER_LOGIN_SUCCESS', 'USER_LOGIN_FAILURE', 'CREATE_TASK', 'AGENT_REGISTERED', 'AGENT_BEACON_SUCCESS', 'AGENT_BEACON_FAILURE', 'CONFIG_UPDATED', 'ROLE_ASSIGNED'
    details JSONB, -- e.g., old and new values for a change, parameters of the action, error messages
    status VARCHAR(50) NOT NULL DEFAULT 'success', -- 'success', 'failure', 'pending'
    ip_address VARCHAR(45), -- Source IP of the request
    user_agent TEXT, -- User-Agent string from HTTP request
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE audit_logs IS 'Records significant system actions for audit, security, and troubleshooting purposes.';
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id NULLS LAST);
CREATE INDEX idx_audit_logs_agent_id ON audit_logs(agent_id NULLS LAST);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_target_entity ON audit_logs(target_entity_id, target_entity_type);
\`\`\`

## 3. Normalization and JSONB Usage

*   **Normalization:** The schema generally adheres to Third Normal Form (3NF) to reduce data redundancy and improve data integrity. Relationships are primarily managed through foreign keys. [^1]
*   **JSONB Usage:** PostgreSQL's `JSONB` data type is strategically used for fields that require flexibility or store semi-structured/dynamic data: [^1]
    *   `agents.tags`: Allows for arbitrary, queryable key-value or array tagging of agents.
    *   `tasks.payload`: Task parameters vary significantly by task type; JSONB provides a flexible way to store these.
    *   `agent_telemetry.metric_value`: Telemetry values can be simple numbers, strings, or complex JSON objects (e.g., per-core CPU stats, list of processes).
    *   `agent_telemetry.tags`: Allows for rich, queryable context for individual telemetry data points.
    *   `system_configurations.configuration_data`: Stores diverse configuration structures for profiles and policies.
    *   `audit_logs.details`: Captures varied and potentially complex information about an audited action.
    *   JSONB fields can be efficiently indexed using GIN indexes, enabling effective querying of their contents.

## 4. Indexing and Performance Considerations

*   **Primary Keys (PKs):** Automatically indexed. UUIDs are used for most PKs to allow for distributed generation and to avoid sequence conflicts if data is merged from multiple instances. `BIGSERIAL` is used for high-volume, append-mostly tables like `agent_telemetry` and `audit_logs` where natural ordering by ID can be beneficial and UUID generation overhead might be a concern.
*   **Foreign Keys (FKs):** Indexed to speed up joins and enforce referential integrity. `ON DELETE CASCADE` or `ON DELETE SET NULL` are used appropriately.
*   **Common Query Patterns:** Additional indexes are created on columns frequently used in `WHERE` clauses, `ORDER BY` clauses, or `JOIN` conditions (e.g., `status` columns, `timestamp` columns, `type` columns, `agent_id` in `tasks` and `agent_telemetry`).
*   **GIN Indexes:** Used for `JSONB` columns (`agents.tags`, `agent_telemetry.tags`, `audit_logs.details` if queried) to enable efficient searching within the JSON structures (e.g., `tags @> '{"key":"value"}'`).
*   **Timestamp Triggers:** The `trigger_set_timestamp()` function and associated triggers automatically update `updated_at` columns on row modification, ensuring these timestamps are always current.
*   **Connection Pooling:** In production, use a connection pooler like PgBouncer in front of PostgreSQL to manage database connections efficiently, especially with a potentially high number of concurrent API requests or agent beacons. This reduces the overhead of establishing new connections.
*   **Partitioning (for high-volume tables):** For tables like `agent_telemetry` and `audit_logs` that are expected to grow very large, consider PostgreSQL's native table partitioning (e.g., by date range on the `timestamp` column). Partitioning can significantly improve query performance on large datasets and simplify data management tasks like archiving or deleting old data.
*   **Regular Maintenance:** Perform regular database maintenance tasks like `VACUUM` and `ANALYZE` to keep statistics up-to-date and optimize query performance.

This database schema provides a comprehensive and robust structure for ARC4NE's data storage needs, balancing normalization for data integrity, flexibility through JSONB, and performance considerations for efficient operation. [^1]
