# 02 - ARC4NE Service Architecture & Containerized Scaffolding

This document details ARC4NE's backend architecture, containerization, and related structural decisions. [^1]

## Core Technologies & Components

*   **Backend API:** Python with FastAPI (`arc4ne-api`). [^1]
*   **Database:** PostgreSQL (`arc4ne-db`). [^1]
*   **Web UI:** Next.js with React (`arc4ne-webui`). [^1]
*   **Reverse Proxy:** Nginx (`arc4ne-proxy`). [^1]
*   **Local Orchestration:** Docker Compose. [^1]

## Container Breakdown

1.  `arc4ne-api`: Handles all API logic, business rules, and interaction with the `arc4ne-db`. [^1]
2.  `arc4ne-db`: The PostgreSQL database instance for persistent storage of all ARC4NE data (agents, tasks, users, telemetry, etc.). [^1]
3.  `arc4ne-webui`: Serves the Next.js frontend application to users. [^1]
4.  `arc4ne-proxy`: Nginx acts as the single entry point for all incoming HTTP/HTTPS traffic, routing requests to the appropriate backend service (`arc4ne-api` or `arc4ne-webui`) and handling SSL/TLS termination. [^1]

## File & Directory Structure

A monorepo structure is adopted for managing all ARC4NE components: [^1]
\`\`\`
arc4ne/
├── backend/          # FastAPI application source code
│   ├── app/          # Core application logic (routers, models, db, security)
│   ├── Dockerfile
│   └── requirements.txt (or pyproject.toml for Poetry)
├── frontend/         # Next.js application source code
│   ├── app/          # Next.js App Router structure
│   ├── components/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── nginx/            # Nginx configuration
│   └── nginx.conf
├── docs/             # Project documentation (including these files)
├── scripts/          # Utility scripts (e.g., database migrations, test data seeding)
├── docker-compose.yml # Docker Compose file for local orchestration
├── .env              # Local environment variables (gitignored)
└── .env.example      # Example environment variables template
\`\`\`

## Internal and External Networking Layout

*   **Internal Networking:** [^1]
    *   A custom Docker bridge network named `arc4ne_network` is defined in `docker-compose.yml`.
    *   All backend services (`arc4ne-api`, `arc4ne-db`, `arc4ne-webui`) are attached to this network.
    *   Services can communicate with each other using their service names as hostnames (e.g., `arc4ne-api` can connect to `arc4ne-db:5432`).
*   **External Networking:** [^1]
    *   The `arc4ne-proxy` (Nginx) is the only service that exposes ports to the host machine (typically port 80 for HTTP and port 443 for HTTPS).
    *   Nginx listens on these external ports and routes traffic based on the request path:
        *   Requests to `/api/...` are proxied to `arc4ne-api` (e.g., `http://arc4ne-api:8000`).
        *   All other requests (e.g., `/`, `/dashboard`, `/agents`) are proxied to `arc4ne-webui` (e.g., `http://arc4ne-webui:3000`).
    *   This setup centralizes ingress control, simplifies SSL/TLS management, and hides internal service ports.

## Environment Variable and Secrets Strategy

*   **Local Development:** [^1]
    *   A `.env` file at the root of the project (gitignored) stores environment-specific configurations.
    *   Docker Compose automatically loads variables from this `.env` file and injects them into the respective containers.
    *   An `.env.example` file is committed to the repository as a template for required variables.
*   **Production & Staging:** [^1]
    *   Secrets (database passwords, JWT secret keys, API keys) must NOT be hardcoded or stored in `.env` files in version control for these environments.
    *   Use the orchestration platform's native secret management system (e.g., Kubernetes Secrets, Docker Swarm Secrets, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault).
    *   Environment variables are injected into containers at runtime by the orchestration platform.
*   **Key Variables:** [^1]
    *   `DATABASE_URL` (e.g., `postgresql://user:password@arc4ne-db:5432/arc4ne_db`)
    *   `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (for PostgreSQL container setup)
    *   `JWT_SECRET_KEY` (a strong, random string for signing JWTs)
    *   `JWT_ALGORITHM` (e.g., `HS256`)
    *   `ACCESS_TOKEN_EXPIRE_MINUTES`
    *   `REFRESH_TOKEN_EXPIRE_DAYS`
    *   `NEXT_PUBLIC_API_URL` (for Next.js frontend to locate the API, e.g., `http://localhost/api/v1` or `https://arc4ne.example.com/api/v1`)
    *   `API_HOST`, `API_PORT` (for FastAPI/Uvicorn, e.g., `0.0.0.0`, `8000`)
    *   `NODE_ENV` (for Next.js, e.g., `development` or `production`)
    *   `CORS_ALLOWED_ORIGINS` (comma-separated list of allowed origins for the API)

## Logging, Metrics, and Observability Considerations

*   **Logging:** [^1]
    *   All services (FastAPI, Next.js, Nginx) should be configured to output structured logs (preferably JSON) to `stdout` and `stderr`.
    *   Docker captures these logs, which can then be aggregated by a log management solution (e.g., ELK stack, Grafana Loki, Datadog, Splunk) in production environments.
    *   FastAPI can use libraries like `structlog` or Python's built-in `logging` module with custom JSON formatters.
    *   Include correlation IDs in logs to trace requests across services.
*   **Metrics:** [^1]
    *   The `arc4ne-api` service should expose a `/metrics` endpoint in a Prometheus-compatible format. This can be achieved using libraries like `starlette-prometheus` for FastAPI.
    *   Key metrics to expose: API request counts, error rates, response latencies per endpoint, database connection pool status, active agent counts, task queue lengths.
    *   Nginx can also be configured to expose metrics (e.g., using `nginx-prometheus-exporter` or `ngx_http_stub_status_module`).
    *   The `arc4ne-webui` can report client-side performance metrics if needed.
*   **Health Checks:** [^1]
    *   Each service (`arc4ne-api`, `arc4ne-webui`) must expose a `/health` endpoint (e.g., `/api/health`, `/healthz`).
    *   These endpoints should perform basic checks (e.g., database connectivity for the API, critical dependency availability) and return a 200 OK status if healthy, or an appropriate error code otherwise.
    *   Docker Compose (`healthcheck` directive) and Kubernetes (liveness/readiness probes) can use these health checks to monitor container health and manage restarts or traffic routing.
*   **Distributed Tracing (Future Consideration for Phase 3):** [^1]
    *   For more complex debugging in later phases, consider implementing distributed tracing (e.g., OpenTelemetry with Jaeger or Zipkin) to trace requests as they flow across services.

## Detailed Docker Configuration Examples

### Backend Dockerfile (`backend/Dockerfile`)

\`\`\`dockerfile
FROM python:3.11-slim

WORKDIR /usr/src/app

# Set environment variables to prevent Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application source code
COPY ./app ./app

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
\`\`\`

### Frontend Dockerfile (`frontend/Dockerfile`)

\`\`\`dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the development server on all interfaces
CMD ["npm", "run", "dev"]
\`\`\`

### Docker Compose Configuration (`docker-compose.yml`)

\`\`\`yaml
services:
  # Nginx Reverse Proxy
  arc4ne-proxy:
    image: nginx:1.25-alpine
    container_name: arc4ne-proxy
    ports:
      - "80:80"
      - "443:443" # For future HTTPS
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      # - ./certs:/etc/nginx/certs:ro # For future HTTPS certs
    networks:
      - arc4ne_network
    depends_on:
      - arc4ne-api
      - arc4ne-webui
    restart: unless-stopped

  # FastAPI Backend
  arc4ne-api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: arc4ne-api
    env_file:
      - .env
    volumes:
      - ./backend:/usr/src/app # Mount for local development hot-reloading
    networks:
      - arc4ne_network
    depends_on:
      - arc4ne-db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Next.js Frontend
  arc4ne-webui:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: arc4ne-webui
    env_file:
      - .env
    environment:
      - NODE_ENV=development
    volumes:
      - ./frontend:/app  # Mount the frontend directory to /app in container
      - /app/node_modules  # Prevent node_modules from being overwritten
    networks:
      - arc4ne_network
    restart: unless-stopped

  # PostgreSQL Database
  arc4ne-db:
    image: postgres:16-alpine
    container_name: arc4ne-db
    env_file:
      - .env
    volumes:
      - postgres_data:/var/lib/postgresql/data/
    networks:
      - arc4ne_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 30s
      timeout: 10s
      retries: 5

# Define the network
networks:
  arc4ne_network:
    driver: bridge

# Define the volume for persistent DB data
volumes:
  postgres_data:
\`\`\`

### Nginx Configuration (`nginx/nginx.conf`)

\`\`\`nginx
events {
    worker_connections 1024;
}

http {
    # Define upstream servers to proxy to
    upstream api {
        server arc4ne-api:8000;
    }

    upstream webui {
        server arc4ne-webui:3000;
    }

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=1r/s;

    server {
        listen 80;
        server_name localhost;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";

        # Route API requests to the FastAPI backend
        location /api/ {
            # Apply rate limiting
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Special rate limiting for login endpoint
        location /api/v1/auth/login {
            limit_req zone=login_limit burst=5 nodelay;
            
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Route all other requests to the Next.js frontend
        location / {
            proxy_pass http://webui;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Required for WebSocket connections if used by Next.js
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /nginx-health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }

    # --- HTTPS Server Block (for future use) ---
    # server {
    #     listen 443 ssl http2;
    #     server_name arc4ne.example.com;
    #
    #     ssl_certificate /etc/nginx/certs/fullchain.pem;
    #     ssl_certificate_key /etc/nginx/certs/privkey.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    #     ssl_prefer_server_ciphers off;
    #     ssl_session_cache shared:SSL:10m;
    #     ssl_session_timeout 10m;
    #
    #     # HSTS
    #     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    #
    #     location /api/ {
    #         limit_req zone=api_limit burst=20 nodelay;
    #         proxy_pass http://api;
    #         # ... same proxy headers as above
    #     }
    #
    #     location / {
    #         proxy_pass http://webui;
    #         # ... same proxy headers as above
    #     }
    # }

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
}
\`\`\`

## Kubernetes Deployment Considerations (Future)

For production deployments, Kubernetes provides better scalability and management:

*   **Deployments:** Each service (`arc4ne-api`, `arc4ne-webui`, `arc4ne-proxy`) would have its own Kubernetes Deployment.
*   **Services:** Kubernetes Services would handle internal networking and load balancing.
*   **Ingress:** A Kubernetes Ingress controller would replace the Nginx proxy for external traffic routing.
*   **ConfigMaps/Secrets:** For environment variables and sensitive data management.
*   **Persistent Volumes:** For PostgreSQL data persistence.
*   **Horizontal Pod Autoscaler:** For automatic scaling based on CPU/memory usage.

This architecture promotes modularity, scalability, and a clear separation of concerns, facilitating development and future deployment to various environments. [^1]
