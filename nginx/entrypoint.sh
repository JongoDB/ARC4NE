#!/bin/sh

# Certificate paths
CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/arc4ne.crt"
KEY_FILE="$CERT_DIR/arc4ne.key"

# Create certificate directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate self-signed certificate if it doesn't exist
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "🔐 Generating self-signed TLS certificate for ARC4NE..."
    
    # Generate private key
    openssl genrsa -out "$KEY_FILE" 2048
    
    # Generate certificate signing request and self-signed certificate
    openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365 -subj "/C=US/ST=Local/L=Local/O=ARC4NE/OU=Development/CN=localhost"
    
    # Set appropriate permissions
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    
    echo "✅ Self-signed certificate generated successfully"
    echo "   Certificate: $CERT_FILE"
    echo "   Private Key: $KEY_FILE"
    echo "   Valid for: 365 days"
    echo ""
    echo "⚠️  WARNING: This is a self-signed certificate."
    echo "   Browsers will show 'Connection is not private' warnings."
    echo "   This is expected for development/internal use."
else
    echo "🔐 Using existing TLS certificate"
    echo "   Certificate: $CERT_FILE"
    echo "   Private Key: $KEY_FILE"
fi

# Verify certificate files exist and are readable
if [ ! -r "$CERT_FILE" ] || [ ! -r "$KEY_FILE" ]; then
    echo "❌ ERROR: Certificate files are not readable"
    exit 1
fi

echo "🚀 Starting Nginx with HTTPS support..."

# Execute the original command (nginx)
exec "$@"
