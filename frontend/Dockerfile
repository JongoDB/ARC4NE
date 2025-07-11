# Use Node.js 18 Alpine image
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the development server on all interfaces
CMD ["npm", "run", "dev"]
