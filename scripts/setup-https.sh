#!/bin/bash

# ARC4NE HTTPS Setup Script
# Builds and starts the ARC4NE stack with HTTPS support

set -e

echo "🚀 ARC4NE HTTPS Setup"
echo "===================="

# Check if Docker and Docker Compose are available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed or not in PATH"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create one based on your configuration."
    exit 1
fi

echo "📋 Pre-flight checks passed"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans

# Build and start services
echo "🔨 Building and starting ARC4NE with HTTPS..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

# Test HTTPS connectivity
echo "🔐 Testing HTTPS connectivity..."
NEXT_PUBLIC_API_URL=$(grep NEXT_PUBLIC_API_URL .env | cut -d '=' -f2)
BASE_URL=$(echo $NEXT_PUBLIC_API_URL | sed 's|/api/v1||')

if curl -k -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✅ HTTPS is working!"
    echo ""
    echo "🌐 Access ARC4NE at: $BASE_URL"
    echo "🔒 API available at: $NEXT_PUBLIC_API_URL"
    echo ""
    echo "⚠️  Note: You'll see a 'Connection is not private' warning"
    echo "   This is expected with self-signed certificates."
    echo "   Click 'Advanced' -> 'Proceed to [site]' to continue."
else
    echo "⚠️  HTTPS test failed, but services may still be starting..."
    echo "   Try accessing $BASE_URL in a few minutes."
fi

echo ""
echo "📊 View logs with: docker-compose logs -f"
echo "🛑 Stop services with: docker-compose down"
echo "📜 Check certificate info with: ./scripts/cert-info.sh"
