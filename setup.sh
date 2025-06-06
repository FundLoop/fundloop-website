#!/usr/bin/env bash

# Enable pnpm via corepack if available
if command -v corepack >/dev/null 2>&1; then
  corepack enable
fi

# Install dependencies
pnpm install

# Copy environment file if example exists and not already present
if [ -f .env.example ] && [ ! -f .env.local ]; then
  cp .env.example .env.local
fi
