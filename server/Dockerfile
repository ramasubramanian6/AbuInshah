# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy the rest of the app
COPY . .

# Stage 2: Run (smaller final image)
FROM node:18-alpine

WORKDIR /app

# Copy production node_modules and source
COPY --from=build /app /app

# Set environment variable for Cloud Run or App Engine
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port (Cloud Run uses PORT env var a
