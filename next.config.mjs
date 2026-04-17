import path from "node:path"
import { fileURLToPath } from "node:url"
import createNextIntlPlugin from "next-intl/plugin"

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url))
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: workspaceRoot,
  },
}

export default withNextIntl(nextConfig)
