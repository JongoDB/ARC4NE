FROM nginx:1.25-alpine

# Install OpenSSL for certificate generation
RUN apk add --no-cache openssl

# Create directory for certificates
RUN mkdir -p /etc/nginx/certs

# Copy our custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
