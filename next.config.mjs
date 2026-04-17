import path from "node:path"
import { fileURLToPath } from "node:url"

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: workspaceRoot,
  },
}

export default nextConfig
