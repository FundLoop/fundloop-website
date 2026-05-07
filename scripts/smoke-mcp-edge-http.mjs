#!/usr/bin/env node

const baseUrl = (process.env.FUNDLOOP_MCP_HTTP_URL || "http://127.0.0.1:54321/functions/v1/mcp").replace(/\/$/, "")
const bearerToken = process.env.FUNDLOOP_MCP_BEARER_TOKEN || "local-smoke-token"

async function request(payload) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${bearerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`MCP Edge HTTP request failed with ${response.status}: ${text}`)
  }

  const eventData = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter(Boolean)

  const body = eventData.at(-1) ?? text
  return JSON.parse(body)
}

async function health() {
  const response = await fetch(`${baseUrl}/health`, {
    headers: {
      authorization: `Bearer ${bearerToken}`,
    },
  })
  const body = await response.json()
  if (!response.ok || body.ok !== true) {
    throw new Error(`MCP Edge health failed: ${JSON.stringify(body)}`)
  }
  return body
}

const healthResult = await health()
const initialize = await request({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "fundloop-edge-smoke",
      version: "0.1.0",
    },
  },
})
if (initialize.error || !initialize.result) {
  throw new Error(`MCP Edge initialize failed: ${JSON.stringify(initialize)}`)
}
const toolsList = await request({ jsonrpc: "2.0", id: 2, method: "tools/list" })
if (toolsList.error || !toolsList.result) {
  throw new Error(`MCP Edge tools/list failed: ${JSON.stringify(toolsList)}`)
}
const toolNames = toolsList.result?.tools?.map((tool) => tool.name) ?? []
if (!toolNames.includes("fundloop.health")) {
  throw new Error("MCP Edge tools/list did not include fundloop.health.")
}

const resourcesList = await request({ jsonrpc: "2.0", id: 4, method: "resources/list" })
if (resourcesList.error || !resourcesList.result) {
  throw new Error(`MCP Edge resources/list failed: ${JSON.stringify(resourcesList)}`)
}
const resourceUris = resourcesList.result?.resources?.map((resource) => resource.uri) ?? []
if (!resourceUris.includes("fundloop://docs/mcp-overview")) {
  throw new Error("MCP Edge resources/list did not include fundloop://docs/mcp-overview.")
}

const promptsList = await request({ jsonrpc: "2.0", id: 5, method: "prompts/list" })
if (promptsList.error || !promptsList.result) {
  throw new Error(`MCP Edge prompts/list failed: ${JSON.stringify(promptsList)}`)
}
const promptNames = promptsList.result?.prompts?.map((prompt) => prompt.name) ?? []
if (!promptNames.includes("review-pending-tasks")) {
  throw new Error("MCP Edge prompts/list did not include review-pending-tasks.")
}

const toolCall = await request({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "fundloop.health", arguments: {} },
})
if (toolCall.error || !toolCall.result) {
  throw new Error(`MCP Edge tools/call failed: ${JSON.stringify(toolCall)}`)
}
const toolText = toolCall.result?.content?.[0]?.text ?? ""
if (!toolText.includes("fundloop-mcp-server")) {
  throw new Error("MCP Edge fundloop.health did not return service content.")
}

console.log(
  JSON.stringify(
    {
      ok: true,
      endpoint: baseUrl,
      health: healthResult,
      server: initialize.result?.serverInfo,
      toolCount: toolNames.length,
      resourceCount: resourceUris.length,
      promptCount: promptNames.length,
      checkedTools: ["fundloop.health"],
      checkedResources: ["fundloop://docs/mcp-overview"],
      checkedPrompts: ["review-pending-tasks"],
    },
    null,
    2,
  ),
)
