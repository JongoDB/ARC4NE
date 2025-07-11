# ARC4NE HTTPS Setup Guide

This guide covers the automatic HTTPS setup for ARC4NE using self-signed certificates.

## 🔐 Overview

ARC4NE automatically generates and uses self-signed TLS certificates to provide encrypted communication between:
- Web browsers and the frontend
- Frontend and backend API
- External tools and the API

## 🚀 Quick Start

1. **Update your .env file** to use HTTPS URLs:
   \`\`\`bash
   NEXT_PUBLIC_API_URL=https://your-server-ip/api/v1
   \`\`\`

2. **Start ARC4NE with HTTPS**:
   \`\`\`bash
   ./scripts/setup-https.sh
   \`\`\`

3. **Access the application**:
   - Navigate to `https://your-server-ip`
   - Accept the security warning (expected for self-signed certs)
   - Login and use ARC4NE normally

## 🔧 Manual Setup

If you prefer manual control:

\`\`\`bash
# Build and start services
docker-compose up --build -d

# Check certificate generation
docker-compose logs arc4ne-proxy

# Verify HTTPS is working
curl -k https://localhost/health
\`\`\`

## 📋 Certificate Details

### Automatic Generation
- **Location**: `/etc/nginx/certs/` in the nginx container
- **Persistence**: Stored in Docker volume `nginx_certs`
- **Validity**: 365 days from generation
- **Algorithm**: RSA 2048-bit
- **Subject**: `CN=localhost, O=ARC4NE, OU=Development`

### Certificate Information
View certificate details:
\`\`\`bash
./scripts/cert-info.sh
\`\`\`

### Certificate Regeneration
To generate a new certificate:
\`\`\`bash
docker-compose down
docker volume rm arc4ne-scaffolding_nginx_certs
docker-compose up --build -d
\`\`\`

## 🌐 Browser Warnings

### Expected Behavior
When accessing ARC4NE with self-signed certificates, browsers will show:
- "Your connection is not private"
- "NET::ERR_CERT_AUTHORITY_INVALID"
- "This site may be impersonating..."

### Proceeding Safely
1. Click **"Advanced"** or **"Show Details"**
2. Click **"Proceed to [site]"** or **"Accept Risk"**
3. The warning appears because the certificate is self-signed, not because of actual security issues

### Adding Certificate to Browser (Optional)
For frequent use, you can add the certificate to your browser's trusted certificates:

1. **Export certificate from container**:
   \`\`\`bash
   docker cp arc4ne-proxy:/etc/nginx/certs/arc4ne.crt ./arc4ne.crt
   \`\`\`

2. **Import to browser**:
   - **Chrome**: Settings → Privacy & Security → Security → Manage Certificates
   - **Firefox**: Settings → Privacy & Security → Certificates → View Certificates
   - **Safari**: Keychain Access → File → Import Items

## 🔧 Configuration

### Environment Variables
\`\`\`bash
# Required - Update to use HTTPS
NEXT_PUBLIC_API_URL=https://your-server-ip/api/v1

# Optional - Certificate customization
TLS_CERT_DAYS=365
TLS_CERT_COUNTRY=US
TLS_CERT_STATE=Local
TLS_CERT_CITY=Local
TLS_CERT_ORG=ARC4NE
TLS_CERT_UNIT=Development
\`\`\`

### Nginx Configuration
The HTTPS configuration includes:
- **TLS 1.2/1.3** support
- **Modern cipher suites**
- **HTTP to HTTPS redirect**
- **Security headers** (HSTS, X-Frame-Options, etc.)
- **WebSocket support** for Next.js hot reloading

## 🔍 Troubleshooting

### Certificate Not Generated
\`\`\`bash
# Check nginx container logs
docker-compose logs arc4ne-proxy

# Verify OpenSSL is available
docker exec arc4ne-proxy openssl version
\`\`\`

### HTTPS Not Working
\`\`\`bash
# Test connectivity
curl -k https://localhost/health

# Check port binding
docker-compose ps

# Verify certificate files
docker exec arc4ne-proxy ls -la /etc/nginx/certs/
\`\`\`

### Permission Issues
\`\`\`bash
# Check certificate permissions
docker exec arc4ne-proxy ls -la /etc/nginx/certs/

# Expected permissions:
# -rw-r--r-- arc4ne.crt (644)
# -rw------- arc4ne.key (600)
\`\`\`

## 🔮 Future Enhancements

This self-signed setup is designed to be easily extended:

### Let's Encrypt Integration
- Automatic certificate provisioning
- Automatic renewal
- Domain validation

### Internal CA Support
- Corporate certificate authority
- Centralized certificate management
- Client certificate authentication

### mTLS for Agents
- Mutual authentication
- Agent certificate provisioning
- Enhanced security for agent communication

## 📊 Monitoring

### Certificate Expiration
Monitor certificate expiration:
\`\`\`bash
# Check expiration date
./scripts/cert-info.sh

# Set up monitoring (future enhancement)
# - Grafana dashboard
# - Email alerts
# - Automatic renewal
\`\`\`

### HTTPS Health Checks
\`\`\`bash
# Manual health check
curl -k https://localhost/health

# Automated monitoring
# - Uptime checks
# - SSL certificate monitoring
# - Performance metrics
\`\`\`

## 🛡️ Security Considerations

### Self-Signed Certificate Limitations
- **No third-party validation**: Browsers cannot verify certificate authenticity
- **MITM vulnerability**: Susceptible to man-in-the-middle attacks without proper certificate validation
- **User training required**: Users must understand and accept security warnings

### Recommended for:
- ✅ **Development environments**
- ✅ **Internal/private networks**
- ✅ **Air-gapped deployments**
- ✅ **Testing and evaluation**

### Not recommended for:
- ❌ **Public internet deployment**
- ❌ **Production environments with external users**
- ❌ **Compliance-sensitive deployments**

### Mitigation Strategies
1. **Network isolation**: Deploy on private networks
2. **VPN access**: Require VPN for external access
3. **Certificate pinning**: Pin certificates in agent configurations
4. **Upgrade path**: Plan migration to proper CA certificates for production
\`\`\`

Finally, let's make the scripts executable by updating the docker-compose.yml to ensure proper permissions:

```typescriptreact file="docker-compose.yml"
[v0-no-op-code-block-prefix]services:
  # Nginx Reverse Proxy with HTTPS
  arc4ne-proxy:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: arc4ne-proxy
    ports:
      - "80:80"   # HTTP (redirects to HTTPS)
      - "443:443" # HTTPS
    volumes:
      - nginx_certs:/etc/nginx/certs  # Persistent certificate storage
      - nginx_logs:/var/log/nginx     # Persistent logs
    networks:
      - arc4ne_network
    depends_on:
      - arc4ne-api
      - arc4ne-webui
    restart: unless-stopped
    environment:
      - TZ=UTC

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
    environment:
      - TZ=UTC

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
      - TZ=UTC
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
    environment:
      - TZ=UTC

# Define the network
networks:
  arc4ne_network:
    driver: bridge

# Define volumes for persistent data
volumes:
  postgres_data:
    driver: local
  nginx_certs:
    driver: local
  nginx_logs:
    driver: local

# Make scripts executable (run this manually after first clone)
# chmod +x scripts/*.sh
