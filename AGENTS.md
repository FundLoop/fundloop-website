# Contributor Notes

- Use `pnpm` as the package manager. Run `pnpm install` to install dependencies.
- The `codex.json` file instructs Codex to run `bash setup.sh` when the
  environment starts. Ensure `setup.sh` installs dependencies and prepares the
environment.
- After making changes, run `pnpm lint` to check formatting and code quality.
- Environment variables `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set for the app to run.
- Database migration scripts live in the `database/` directory. Run them in
  order on your Supabase project.
