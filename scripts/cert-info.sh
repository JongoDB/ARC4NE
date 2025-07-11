#!/bin/bash

# ARC4NE Certificate Information Script
# Displays information about the generated TLS certificate

set -e

echo "🔐 ARC4NE Certificate Information"
echo "================================"

# Check if the nginx container is running
if ! docker ps | grep -q "arc4ne-proxy"; then
    echo "❌ ARC4NE proxy container is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi

# Get certificate information from the container
echo "📋 Certificate Details:"
echo "----------------------"

# Check if certificate exists
if docker exec arc4ne-proxy test -f /etc/nginx/certs/arc4ne.crt; then
    # Display certificate information
    docker exec arc4ne-proxy openssl x509 -in /etc/nginx/certs/arc4ne.crt -text -noout | grep -A 5 "Subject:"
    echo ""
    docker exec arc4ne-proxy openssl x509 -in /etc/nginx/certs/arc4ne.crt -text -noout | grep -A 2 "Validity"
    echo ""
    
    # Show certificate fingerprint
    echo "🔑 Certificate Fingerprint:"
    docker exec arc4ne-proxy openssl x509 -in /etc/nginx/certs/arc4ne.crt -fingerprint -noout
    echo ""
    
    # Show certificate expiration
    echo "📅 Certificate Expiration:"
    docker exec arc4ne-proxy openssl x509 -in /etc/nginx/certs/arc4ne.crt -enddate -noout
    echo ""
    
    # Check certificate validity
    echo "✅ Certificate Status:"
    if docker exec arc4ne-proxy openssl x509 -in /etc/nginx/certs/arc4ne.crt -checkend 86400 > /dev/null 2>&1; then
        echo "   Certificate is valid and not expiring within 24 hours"
    else
        echo "   ⚠️  Certificate expires within 24 hours!"
    fi
else
    echo "❌ Certificate not found in container"
    echo "   The certificate should be auto-generated on startup"
    echo "   Check container logs: docker-compose logs arc4ne-proxy"
fi

echo ""
echo "📊 Container Status:"
echo "-------------------"
docker-compose ps arc4ne-proxy

echo ""
echo "🔄 To regenerate certificate:"
echo "   1. docker-compose down"
echo "   2. docker volume rm arc4ne-scaffolding_nginx_certs"
echo "   3. docker-compose up --build -d"
