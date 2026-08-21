#!/usr/bin/env bash
set -euo pipefail

if command -v corepack >/dev/null 2>&1; then
  corepack enable
fi

pnpm install

if [ -f .env.example ] && [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

cat <<'EOF'
Bootstrap complete.

Next steps:
  1. Fill in .env.local with your Supabase project values.
  2. Pull or reset the local database with the Supabase CLI as needed.
  3. Run pnpm lint, pnpm test, pnpm typecheck, and pnpm build.
EOF
