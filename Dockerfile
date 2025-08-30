# Multi-stage Dockerfile for production deployment

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Deposit listener service
FROM node:18-alpine AS deposit-service
WORKDIR /app

# Install deposit listener dependencies
COPY deposit-listener/package*.json ./deposit-listener/
RUN cd deposit-listener && npm ci --only=production

# Copy deposit listener source
COPY deposit-listener/ ./deposit-listener/

# Stage 3: Production runtime
FROM node:18-alpine AS production
WORKDIR /app

# Install serve for frontend
RUN npm install -g serve

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Copy deposit listener
COPY --from=deposit-service /app/deposit-listener ./deposit-listener

# Create startup script
RUN echo '#!/bin/sh\n\
# Start frontend server in background\n\
serve -s dist -l 3000 &\n\
\n\
# Start deposit listener\n\
cd deposit-listener\n\
node multi-network-listener.js &\n\
\n\
# Start auto-transfer service\n\
node multi-network-auto-transfer.js listen &\n\
\n\
# Wait for all background processes\n\
wait' > /app/start.sh

RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]