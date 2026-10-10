import path from "node:path"
import { fileURLToPath } from "node:url"
import createNextIntlPlugin from "next-intl/plugin"

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url))
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: workspaceRoot,
  },
  async rewrites() {
    return [
      // RFC 8414 fixes this path, and Next's router ignores directories whose names start with a
      // dot, so the handler lives at /api/oauth/metadata and is served from the well-known path.
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/metadata" },
    ]
  },
}

export default withNextIntl(nextConfig)
