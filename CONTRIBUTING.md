# Contributing

## Setup

1. Install Node.js `22.22.1` and pnpm `10.x`.
2. Run `pnpm install`.
3. Optionally copy `.env.example` to `.env.local` if you need live Supabase-backed flows.

## Before opening a change

- Run `pnpm lint`
- Run `pnpm test`
- Run `pnpm build`

Or run the full baseline suite with:

```bash
pnpm check
```

## Project notes

- This repo includes demo seed data and placeholder content for local and staging use.
- Build currently ignores TypeScript errors while a broader type cleanup is still in progress.
- Keep changes focused. Avoid mixing repo hygiene work with unrelated feature changes.
