#!/usr/bin/env node
import { spawn } from "node:child_process"
import { once } from "node:events"

function encodeFrame(message) {
  const payload = JSON.stringify(message)
  return `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`
}

function parseFrames(buffer) {
  const messages = []
  let remaining = buffer

  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf("\r\n\r\n")
    if (headerEnd < 0) break

    const header = remaining.subarray(0, headerEnd).toString("utf8")
    const contentLengthLine = header
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-length:"))
    const contentLength = Number(contentLengthLine?.slice("content-length:".length).trim())
    if (!Number.isInteger(contentLength) || contentLength < 0) {
      throw new Error("Invalid MCP stdio frame in server output.")
    }

    const bodyStart = headerEnd + 4
    const frameEnd = bodyStart + contentLength
    if (remaining.length < frameEnd) break

    messages.push(JSON.parse(remaining.subarray(bodyStart, frameEnd).toString("utf8")))
    remaining = remaining.subarray(frameEnd)
  }

  return { messages, remaining }
}

function waitForResponses(child, expectedCount) {
  let buffer = Buffer.alloc(0)
  const responses = []

  return new Promise((resolve, reject) => {
    let settled = false
    const stderrText = () => Buffer.concat(stderrChunks).toString("utf8").trim()
    const fail = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    }
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(responses)
    }
    const timeout = setTimeout(() => {
      fail(new Error(`Timed out waiting for ${expectedCount} MCP stdio responses. ${stderrText()}`.trim()))
    }, 10_000)

    child.stdout.on("data", (chunk) => {
      try {
        buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)])
        const parsed = parseFrames(buffer)
        buffer = parsed.remaining
        responses.push(...parsed.messages)
        if (responses.length >= expectedCount) {
          finish()
        }
      } catch (error) {
        fail(
          new Error(
            `Failed to parse MCP stdio response: ${error instanceof Error ? error.message : String(error)} ${stderrText()}`.trim(),
          ),
        )
      }
    })

    child.once("error", (error) => {
      fail(error)
    })

    child.once("exit", (code, signal) => {
      if (settled) return
      fail(
        new Error(
          `MCP server exited before ${expectedCount} responses were received. code=${code ?? "null"} signal=${signal ?? "null"} ${stderrText()}`.trim(),
        ),
      )
    })
  })
}

const env = {
  ...process.env,
  FUNDLOOP_MCP_BEARER_TOKEN: process.env.FUNDLOOP_MCP_BEARER_TOKEN || "local-smoke-token",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-smoke-anon-key",
}

const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "packages/mcp-server/src/server.ts"], {
  cwd: new URL("..", import.meta.url),
  env,
  stdio: ["pipe", "pipe", "pipe"],
})

const stderrChunks = []
child.stderr.on("data", (chunk) => {
  stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
})

const requests = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "fundloop.health", arguments: {} } },
]

const responsesPromise = waitForResponses(child, requests.length)
child.stdin.end(requests.map(encodeFrame).join(""))

const responses = await responsesPromise
child.kill("SIGTERM")
await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 500))])

const initialize = responses.find((message) => message.id === 1)
const toolsList = responses.find((message) => message.id === 2)
const health = responses.find((message) => message.id === 3)

if (initialize?.result?.serverInfo?.name !== "fundloop-mcp-server") {
  throw new Error("MCP initialize did not return fundloop-mcp-server.")
}

const toolNames = toolsList?.result?.tools?.map((tool) => tool.name) ?? []
if (!toolNames.includes("fundloop.health")) {
  throw new Error("MCP tools/list did not include fundloop.health.")
}

const healthText = health?.result?.content?.[0]?.text ?? ""
if (!healthText.includes("fundloop-mcp-server")) {
  throw new Error("MCP fundloop.health did not return service health content.")
}

const stderr = Buffer.concat(stderrChunks).toString("utf8").trim()
console.log(
  JSON.stringify(
    {
      ok: true,
      server: initialize.result.serverInfo,
      toolCount: toolNames.length,
      checkedTools: ["fundloop.health"],
      stderr: stderr || null,
    },
    null,
    2,
  ),
)
