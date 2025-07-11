# 03 - ARC4NE Security and Authentication Model

This document defines the end-to-end security architecture for ARC4NE, covering user authentication, agent authentication, data in transit, and secret management. [^1]

## 1. Web UI User Authentication (JWT Lifecycle)

Authentication for web UI users is handled via JSON Web Tokens (JWTs) with a refresh token mechanism. [^1]

*   **Login (`POST /api/v1/auth/login`):** [^1]
    *   User submits username and password.
    *   Server validates credentials against the `users` table.
    *   On success, the server generates:
        1.  **Access Token:** A short-lived JWT (e.g., 15-60 minutes expiry) containing user ID, username, roles, and expiry (`exp`). This token is returned in the JSON response.
        2.  **Refresh Token:** A long-lived, cryptographically secure random string (e.g., 7-30 days expiry). This token is stored server-side (e.g., in a `refresh_tokens` table linked to the user) and sent to the client as an HttpOnly, Secure (in production) cookie.
*   **Access Token Usage:** [^1]
    *   The client (Next.js UI) stores the Access Token in memory (e.g., React Context state).
    *   For every API request to protected endpoints, the client includes the Access Token in the `Authorization: Bearer <access_token>` header.
    *   The API server validates the Access Token (signature, expiry, claims) on each request.
*   **Token Refresh (`POST /api/v1/auth/refresh`):** [^1]
    *   When the Access Token expires, or proactively before it expires, the client makes a request to this endpoint.
    *   The client sends no body but relies on the HttpOnly Refresh Token cookie being automatically included by the browser.
    *   The server validates the Refresh Token (existence, expiry, validity against its store).
    *   If valid, the server issues a new Access Token. The Refresh Token itself may also be rotated (a new refresh token issued, old one invalidated) for enhanced security.
*   **Logout (`POST /api/v1/auth/logout`):** [^1]
    *   The client sends a request to this endpoint.
    *   The server invalidates the Refresh Token associated with the session (e.g., deletes it from the `refresh_tokens` table or marks it as revoked).
    *   The server also instructs the client to clear the Refresh Token cookie (e.g., by sending a `Set-Cookie` header with an expired date).
    *   The client clears the Access Token from its memory.
*   **JWT Claims:**
    *   `sub` (Subject): User ID.
    *   `username`: Username.
    *   `roles`: List of user roles (e.g., `["admin", "operator"]`).
    *   `exp` (Expiration Time): Timestamp for Access Token expiry.
    *   `iat` (Issued At): Timestamp when the token was issued.
    *   `jti` (JWT ID): Unique identifier for the token, useful for revocation if needed (more advanced).

## 2. Agent Onboarding & Authentication

Agent authentication ensures that only legitimate, registered agents can communicate with the C2 server. [^1]

*   **Onboarding Process:** [^1]
    1.  An Administrator uses the ARC4NE web UI to register a new agent.
    2.  The system generates a unique Agent ID (UUID) and a strong, random Pre-Shared Key (PSK).
    3.  The Agent ID and PSK are displayed to the Administrator *once*.
    4.  The Administrator securely transfers and configures the Agent ID and PSK on the target machine where the agent software will run (e.g., in an `agent_config.json` file).
    5.  The server stores the Agent ID and a hash of the PSK (if using password-style verification) or the PSK itself if needed for HMAC and stored securely (e.g., encrypted at rest or in a secrets manager). *Correction for HMAC: The server needs the actual PSK or a key derived from it to verify the signature. Storing the PSK itself requires strong protection like encryption at rest or using a dedicated secrets manager.*
*   **Authentication Mechanism (HMAC-SHA256):** [^1]
    *   For every request to the server, the agent performs the following:
        1.  Constructs the request body (e.g., JSON payload for beaconing).
        2.  Calculates an HMAC-SHA256 signature of the raw request body using its configured PSK as the secret key.
        3.  Sends the following HTTP headers:
            *   `X-Agent-ID`: The agent's unique UUID.
            *   `X-Signature`: The hex-encoded HMAC-SHA256 signature.
    *   The server, upon receiving the request:
        1.  Retrieves the request body.
        2.  Uses the `X-Agent-ID` to look up the corresponding PSK (or derived key).
        3.  Independently calculates the HMAC-SHA256 signature of the received request body using the retrieved PSK.
        4.  Compares its calculated signature with the `X-Signature` header value using a constant-time comparison function (e.g., `hmac.compare_digest` in Python) to prevent timing attacks.
        5.  If the signatures match, the request is considered authentic. Otherwise, it's rejected (e.g., HTTP 401 Unauthorized).
*   **Timestamp/Nonce (Future Enhancement):** To prevent replay attacks, consider including a timestamp or a nonce in the signed payload or as a separate header, validated by the server.

## 3. HTTPS/TLS Setup

All communication between clients (web UI, agents) and the server (Nginx proxy) MUST be over HTTPS. [^1]

*   **TLS Termination:** The Nginx reverse proxy (`arc4ne-proxy`) handles TLS termination. Backend services (`arc4ne-api`, `arc4ne-webui`) can communicate over HTTP internally within the Docker network, as this network is considered trusted. [^1]
*   **Certificate Management:**
    *   **Production (Internet-facing):** Use Let's Encrypt with Certbot (or similar ACME client) to automatically obtain and renew SSL/TLS certificates. Nginx can be configured to handle the ACME challenge process. [^1]
    *   **Air-Gapped/Internal Environments:** Use an internal Certificate Authority (CA) to issue certificates for the ARC4NE server. The CA's root certificate will need to be trusted by clients (browsers, agents). [^1]
    *   **Development:** Use self-signed certificates for local development, or rely on HTTP if TLS is not strictly needed for local testing (though testing with HTTPS locally is good practice).
*   **Security Configuration:** Configure Nginx with strong TLS protocols (e.g., TLS 1.2, TLS 1.3), secure cipher suites, and enable HSTS (HTTP Strict Transport Security).

## 4. RBAC Model (Web UI/API)

Role-Based Access Control (RBAC) restricts user access based on their assigned roles. [^1]

*   **Roles:** [^1]
    1.  **Viewer:** Read-only access to view agents, tasks, and telemetry. Cannot make changes or initiate actions.
    2.  **Operator:** Viewer permissions + ability to create and manage tasks for agents. Cannot manage users or system settings.
    3.  **Admin:** Full control. Operator permissions + ability to register/manage agents, manage users and their roles, and configure system settings/profiles.
*   **Implementation:** [^1]
    *   **JWT Claims:** User roles are included in the JWT Access Token.
    *   **API Enforcement (FastAPI):**
        *   FastAPI dependencies are used to protect endpoints. These dependencies decode the JWT, extract roles, and verify if the user has the required role(s) for the requested operation.
        *   Example: An endpoint for creating a new agent would require the 'admin' role.
    *   **Web UI Enforcement (Next.js):**
        *   The UI conditionally renders components, buttons, navigation items, and form fields based on the logged-in user's roles (obtained from the JWT or a `/users/me` endpoint).
        *   For example, the "Register New Agent" button is only visible and enabled for users with the 'admin' role.
        *   Client-side checks are for UX; authoritative enforcement always happens at the API level.

## 5. Secret Storage and Rotation

Secure management of secrets is critical. [^1]

*   **Storage:** [^1]
    *   **Local Development:** Use `.env` files (gitignored) for convenience.
    *   **Production/Staging:**
        *   **JWT Secret Key, Database Credentials, other API keys:** Store in a secure secrets management system like HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, or Kubernetes Secrets. These are injected into the application containers as environment variables at runtime.
        *   **Agent PSKs:**
            *   If the server needs the raw PSK for HMAC (as is typical), these PSKs must be stored encrypted at rest in the database (e.g., using PostgreSQL's `pgcrypto` extension or application-level encryption before storing) or retrieved from a secrets manager at runtime when needed for verification.
            *   Storing only a hash of the PSK (like a password) is not sufficient if the server needs the original PSK to perform HMAC verification itself.
*   **Rotation:** [^1]
    *   **JWT Secret Key:** Rotate periodically. This will invalidate all active JWTs, requiring users to log in again. Implement a strategy for graceful rotation if zero-downtime is critical (e.g., supporting old and new keys for a short overlap).
    *   **Agent PSKs:** Provide a mechanism for administrators to rotate PSKs for individual agents. This would involve generating a new PSK on the server, updating the agent's configuration with the new PSK, and then invalidating the old PSK on the server.
    *   **Database Credentials, other API keys:** Rotate according to organizational policy, updating the values in the secrets manager.
    *   **MVP/Functional Release:** Manual rotation procedures.
    *   **Advanced Features:** Consider dual-key systems or automated rotation mechanisms for zero-downtime rotation of critical keys.

## 6. Optional: mTLS / PKI (Future Consideration - Phase 3)

For environments requiring an even higher level of security for agent-server communication, Mutual TLS (mTLS) using a Public Key Infrastructure (PKI) can be considered. [^1]

*   **Concept:** Both the server and the agent present SSL/TLS certificates to each other for mutual authentication.
*   **Complexity:** Adds significant complexity in terms of certificate generation, distribution, revocation, and management for all agents.
*   **Use Case:** Suitable for highly sensitive environments where the overhead is justified.

This security model provides a layered approach to protect ARC4NE, addressing authentication, authorization, data protection in transit, and secret management. Regular security audits and updates will be necessary to maintain a strong security posture.
