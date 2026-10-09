import { NextResponse } from "next/server"
import { apiServers } from "@/lib/api/v1/config"

// GET /api/v1/openapi.json — OpenAPI 3.1 for the public surface (#266).
// Stage 1 documents the two tokenless endpoints. The OAuth security scheme and the /me routes are
// declared as the scopes they will require, so third parties can read the shape before stage 2 lands.
export const dynamic = "force-dynamic"

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "request_id"],
      properties: {
        code: {
          type: "string",
          enum: ["unauthorized", "insufficient_scope", "forbidden", "not_found", "conflict", "validation_failed", "rate_limited", "internal_error"],
        },
        message: { type: "string" },
        request_id: { type: "string" },
        details: { type: "object", additionalProperties: true },
      },
    },
  },
} as const

const projectSchema = {
  type: "object",
  required: ["id", "name", "description", "member_count"],
  properties: {
    id: { type: "string", description: "Stable project id (its slug)." },
    name: { type: "string" },
    description: { type: "string" },
    website: { type: ["string", "null"], format: "uri" },
    logo_url: { type: ["string", "null"], format: "uri" },
    category: { type: ["string", "null"] },
    member_count: { type: "integer", minimum: 0 },
    created_at: { type: ["string", "null"], format: "date-time" },
  },
} as const

// Withheld rather than zero: every aggregate of a cohort below the publication threshold is null,
// and a client must be able to tell that apart from a real zero.
const amount = {
  type: ["string", "null"],
  description: "Canonical USD minor units (cents) as a decimal integer string, or null when withheld below the publication threshold.",
} as const

const publishedCount = {
  type: ["integer", "null"],
  description: "Null when withheld below the publication threshold.",
} as const

const cycleSchema = {
  type: ["object", "null"],
  description:
    "The project's most recent published epoch-close package, or null when none is published. "
    + "These packages are provisional: they are prepared before any payout and no transfer has occurred, "
    + "which `provisional` states on every response. Aggregates are withheld (null) for cohorts below the publication threshold.",
  properties: {
    project_id: { type: "string" },
    cycle_key: { type: "string", examples: ["2026-08"] },
    status: { type: "string", description: "Stage of the close package, for example payout_readying." },
    provisional: { const: true, description: "Always true: no payout has occurred for the figures in this response." },
    root_hash: { type: ["string", "null"] },
    published_cohort_count: publishedCount,
    source_count: publishedCount,
    funded_usd_minor: amount,
    harvested_unclaimed_usd_minor: amount,
    cap_multiple: { type: ["string", "null"], description: "Decimal string, for example \"3.00\"; null when withheld." },
    created_at: { type: ["string", "null"], format: "date-time" },
    network: {
      type: ["object", "null"],
      description: "Network-wide totals for the same cycle.",
      properties: {
        status: { type: "string" },
        published_user_count: publishedCount,
        funded_usd_minor: amount,
        final_allocation_usd_minor: amount,
        returned_residue_usd_minor: amount,
      },
    },
  },
} as const

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
})

const document = {
  openapi: "3.1.0",
  info: {
    title: "FundLoop public API",
    version: "1.0.0",
    description:
      "Read-only API over FundLoop's public project data and, with a delegated token, a person's own award and payout routes. "
      + "Times are ISO-8601 UTC. Money is integer minor units as decimal strings, so no amount passes through a float. "
      + "Ids are stable strings. A null count or amount means the value is withheld, not zero. "
      + "Responses are plain text, never HTML.",
  },
  servers: apiServers(),
  paths: {
    "/projects": {
      get: {
        summary: "List public projects",
        description: "No token. The same projects fundloop.org lists publicly.",
        security: [],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
          {
            name: "cursor",
            in: "query",
            schema: { type: "string" },
            description: "Opaque; pass meta.next_cursor verbatim. A cursor this version cannot read is rejected rather than restarting the list.",
          },
          { name: "search", in: "query", schema: { type: "string", maxLength: 200 } },
        ],
        responses: {
          200: {
            description: "A page of projects.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { type: "array", items: projectSchema },
                    meta: { type: "object", properties: { next_cursor: { type: ["string", "null"] } } },
                  },
                },
              },
            },
          },
          422: errorResponse("limit, search or cursor is invalid."),
          429: errorResponse("Rate limited; see Retry-After."),
        },
      },
    },
    "/projects/{projectId}/cycle": {
      get: {
        summary: "A project's latest published cycle",
        description:
          "No token. projectId is the id from /projects. The package is provisional: prepared before any payout, "
          + "and published only where fundloop.org publishes it, so a deployment with nothing published answers data: null.",
        security: [],
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "The latest published cycle, or null.",
            content: { "application/json": { schema: { type: "object", required: ["data"], properties: { data: cycleSchema } } } },
          },
          404: errorResponse("No public project matches that id."),
          429: errorResponse("Rate limited; see Retry-After."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      // Stage 2 (#266): OAuth 2.1 authorization code with PKCE S256.
      fundloopOAuth: {
        type: "oauth2",
        description: "Delegated access to one person's own data. Not yet issued; see FundLoop issue #266.",
        flows: {
          authorizationCode: {
            authorizationUrl: "/oauth/authorize",
            tokenUrl: "/oauth/token",
            refreshUrl: "/oauth/token",
            scopes: {
              "profile:read": "Read which account the token acts for.",
              "awards:read": "Read this person's own award and allocation history.",
              "payout-routes:read": "Read this person's own payout routes, without destination details.",
            },
          },
        },
      },
    },
  },
}

export function GET() {
  return NextResponse.json(document, {
    headers: { "Cache-Control": "public, max-age=300", "X-Fundloop-Api-Stage": "1" },
  })
}
