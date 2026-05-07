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
  { jsonrpc: "2.0", id: 4, method: "resources/list" },
  { jsonrpc: "2.0", id: 5, method: "resources/read", params: { uri: "fundloop://docs/mcp-overview" } },
  { jsonrpc: "2.0", id: 6, method: "prompts/list" },
  { jsonrpc: "2.0", id: 7, method: "prompts/get", params: { name: "review-pending-tasks", arguments: {} } },
]

const responsesPromise = waitForResponses(child, requests.length)
child.stdin.end(requests.map(encodeFrame).join(""))

const responses = await responsesPromise
child.kill("SIGTERM")
await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 500))])

const initialize = responses.find((message) => message.id === 1)
const toolsList = responses.find((message) => message.id === 2)
const health = responses.find((message) => message.id === 3)
const resourcesList = responses.find((message) => message.id === 4)
const docsResource = responses.find((message) => message.id === 5)
const promptsList = responses.find((message) => message.id === 6)
const reviewPrompt = responses.find((message) => message.id === 7)

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

const resourceUris = resourcesList?.result?.resources?.map((resource) => resource.uri) ?? []
if (!resourceUris.includes("fundloop://docs/mcp-overview")) {
  throw new Error("MCP resources/list did not include fundloop://docs/mcp-overview.")
}

const resourceText = docsResource?.result?.contents?.[0]?.text ?? ""
if (!resourceText.includes("fundloop-mcp-server")) {
  throw new Error("MCP resources/read did not return the MCP overview resource.")
}

const promptNames = promptsList?.result?.prompts?.map((prompt) => prompt.name) ?? []
if (!promptNames.includes("review-pending-tasks")) {
  throw new Error("MCP prompts/list did not include review-pending-tasks.")
}

const promptText = reviewPrompt?.result?.messages?.[0]?.content?.text ?? ""
if (!promptText.includes("user.workspace.summary")) {
  throw new Error("MCP prompts/get did not return the review-pending-tasks prompt.")
}

const stderr = Buffer.concat(stderrChunks).toString("utf8").trim()
console.log(
  JSON.stringify(
    {
      ok: true,
      server: initialize.result.serverInfo,
      toolCount: toolNames.length,
      resourceCount: resourceUris.length,
      promptCount: promptNames.length,
      checkedTools: ["fundloop.health"],
      checkedResources: ["fundloop://docs/mcp-overview"],
      checkedPrompts: ["review-pending-tasks"],
      stderr: stderr || null,
    },
    null,
    2,
  ),
)
