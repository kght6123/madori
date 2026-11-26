# ===== Builder Stage =====
FROM node:22-slim AS builder

# node-pty native build requires build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

COPY . .
RUN npm run build

# ===== Runtime Stage =====
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git lsof procps iproute2 bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/dist ./client/dist

ENV MADORI_HOST=0.0.0.0
ENV MADORI_PORT=3000
ENV SHELL=/bin/bash

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
