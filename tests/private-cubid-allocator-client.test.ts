import { generateKeyPairSync } from "node:crypto"
import { describe, expect, test, vi } from "vitest"
import {
  CUBID_ALLOCATOR_CLIENT_NAME,
  CUBID_ALLOCATOR_CONTRACT_VERSION,
  PrivateCubidAllocatorClient,
  buildSignedHeaders,
  buildSigningString,
  canonicalJsonStringify,
  validateCubidAllocatorRequestBody,
  validateCubidAllocatorResponseBody,
} from "../lib/cubid/private-allocator-client"

function generateTestEd25519Keys() {
  const { privateKey } = generateKeyPairSync("ed25519")
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string
  return { privateKeyPem }
}

describe("PrivateCubidAllocatorClient", () => {
  const primaryKeys = generateTestEd25519Keys()
  const secondaryKeys = generateTestEd25519Keys()

  test("canonicalJsonStringify sorts keys recursively and removes undefined values", () => {
    const raw = {
      z: 1,
      a: {
        d: "foo",
        b: 2,
        c: undefined,
      },
      arr: [{ y: 2, x: 1 }],
    }
    const stringified = canonicalJsonStringify(raw)
    expect(stringified).toBe('{"a":{"b":2,"d":"foo"},"arr":[{"x":1,"y":2}],"z":1}')
  })

  test("buildSigningString joins parameters deterministically with newlines", () => {
    const signingString = buildSigningString({
      method: "POST",
      route: "/api/internal/v1/allocator/resolve",
      contractVersion: "2026-08-14",
      client: "fundloop-allocator",
      environment: "preview",
      keyId: "key-123",
      requestId: "req-456",
      timestamp: "2026-08-18T00:00:00.000Z",
      nonce: "nonce-789",
      canonicalBody: '{"items":[],"project_id":1}',
    })

    const lines = signingString.split("\n")
    expect(lines).toHaveLength(10)
    expect(lines[0]).toBe("POST")
    expect(lines[1]).toBe("/api/internal/v1/allocator/resolve")
    expect(lines[2]).toBe("2026-08-14")
    expect(lines[3]).toBe("fundloop-allocator")
    expect(lines[4]).toBe("preview")
    expect(lines[5]).toBe("key-123")
    expect(lines[6]).toBe("req-456")
    expect(lines[7]).toBe("2026-08-18T00:00:00.000Z")
    expect(lines[8]).toBe("nonce-789")
    expect(lines[9]).toMatch(/^[0-9a-f]{64}$/)
  })

  test("buildSignedHeaders creates valid Ed25519 workload signature and required headers", () => {
    const headers = buildSignedHeaders({
      environment: "preview",
      keyConfig: {
        keyId: "key-primary-1",
        privateKeyPem: primaryKeys.privateKeyPem,
      },
      canonicalBody: '{"contract_version":"2026-08-14","items":[],"project_id":10}',
    })

    expect(headers["X-Cubid-Allocator-Client"]).toBe(CUBID_ALLOCATOR_CLIENT_NAME)
    expect(headers["X-Cubid-Allocator-Environment"]).toBe("preview")
    expect(headers["X-Cubid-Allocator-Key-Id"]).toBe("key-primary-1")
    expect(headers["X-Cubid-Allocator-Contract-Version"]).toBe(CUBID_ALLOCATOR_CONTRACT_VERSION)
    expect(headers["X-Cubid-Allocator-Request-Id"]).toMatch(/^fl_req_[0-9a-f]+$/)
    expect(headers["X-Cubid-Allocator-Nonce"]).toMatch(/^fl_nonce_[0-9a-f]+$/)
    expect(headers["Idempotency-Key"]).toMatch(/^fl_idem_[0-9a-f]+$/)
    expect(headers["X-Cubid-Allocator-Signature"]).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test("validateCubidAllocatorRequestBody validates and restricts request fields", () => {
    const valid = {
      contract_version: "2026-08-14",
      project_id: 42,
      items: [
        { project_scoped_uuid: "11111111-1111-4111-8111-111111111111" },
        { project_scoped_uuid: "22222222-2222-4222-8222-222222222222" },
      ],
    }
    const res = validateCubidAllocatorRequestBody(valid)
    expect(res.ok).toBe(true)

    // Rejects unexpected keys
    const withExtra = { ...valid, extraField: "forbidden" }
    expect(validateCubidAllocatorRequestBody(withExtra).ok).toBe(false)

    // Rejects invalid contract version
    const wrongVersion = { ...valid, contract_version: "2025-01-01" }
    expect(validateCubidAllocatorRequestBody(wrongVersion).ok).toBe(false)

    // Rejects duplicate UUIDs
    const withDup = {
      ...valid,
      items: [
        { project_scoped_uuid: "11111111-1111-4111-8111-111111111111" },
        { project_scoped_uuid: "11111111-1111-4111-8111-111111111111" },
      ],
    }
    expect(validateCubidAllocatorRequestBody(withDup).ok).toBe(false)

    // Rejects > 50 items
    const tooMany = {
      contract_version: "2026-08-14",
      project_id: 1,
      items: Array.from({ length: 51 }, (_, i) => ({
        project_scoped_uuid: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      })),
    }
    expect(validateCubidAllocatorRequestBody(tooMany).ok).toBe(false)
  })

  test("validateCubidAllocatorResponseBody validates status-discriminated items", () => {
    const validResponse = {
      contract_version: "2026-08-14",
      request_id: "req-sample-00001",
      items: [
        {
          project_scoped_uuid: "11111111-1111-4111-8111-111111111111",
          fundloop_scoped_uid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          score: 85,
          score_version: "cubid-allocator-score-v1",
          score_observed_at: "2026-08-18T00:00:00.000Z",
          evidence_hash: "1111111111111111111111111111111111111111111111111111111111111111",
          status: "resolved",
        },
        {
          project_scoped_uuid: "22222222-2222-4222-8222-222222222222",
          fundloop_scoped_uid: null,
          score: null,
          score_version: null,
          score_observed_at: null,
          evidence_hash: null,
          status: "not_found",
        },
      ],
    }
    const res = validateCubidAllocatorResponseBody(validResponse)
    expect(res.ok).toBe(true)

    // Rejects non-resolved item with non-null score
    const invalidNotFound = {
      contract_version: "2026-08-14",
      request_id: "req-sample-00001",
      items: [
        {
          project_scoped_uuid: "22222222-2222-4222-8222-222222222222",
          fundloop_scoped_uid: null,
          score: 50,
          score_version: null,
          score_observed_at: null,
          evidence_hash: null,
          status: "not_found",
        },
      ],
    }
    expect(validateCubidAllocatorResponseBody(invalidNotFound).ok).toBe(false)
  })

  test("PrivateCubidAllocatorClient signs, sends, and handles responses correctly", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        contract_version: "2026-08-14",
        request_id: "cubid_req_9999",
        items: [
          {
            project_scoped_uuid: "11111111-1111-4111-8111-111111111111",
            fundloop_scoped_uid: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            score: 92,
            score_version: "cubid-allocator-score-v1",
            score_observed_at: "2026-08-18T01:00:00.000Z",
            evidence_hash: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            status: "resolved",
          },
        ],
      }),
    })

    const client = new PrivateCubidAllocatorClient({
      baseUrl: "https://passport.test.cubid.me",
      environment: "preview",
      primaryKey: {
        keyId: "key-primary-1",
        privateKeyPem: primaryKeys.privateKeyPem,
      },
      secondaryKey: {
        keyId: "key-secondary-2",
        privateKeyPem: secondaryKeys.privateKeyPem,
      },
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    const result = await client.resolveBatch({
      contract_version: "2026-08-14",
      project_id: 10,
      items: [{ project_scoped_uuid: "11111111-1111-4111-8111-111111111111" }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0].fundloop_scoped_uid).toBe("ffffffff-ffff-4fff-8fff-ffffffffffff")
      expect(result.data.items[0].score).toBe(92)
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = mockFetch.mock.calls[0]
    expect(calledUrl).toBe("https://passport.test.cubid.me/api/internal/v1/allocator/resolve")
    expect(calledInit.headers["X-Cubid-Allocator-Key-Id"]).toBe("key-primary-1")
    expect(calledInit.headers["X-Cubid-Allocator-Environment"]).toBe("preview")
  })

  test("PrivateCubidAllocatorClient supports secondary key rotation", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        contract_version: "2026-08-14",
        request_id: "cubid_req_rotation",
        items: [],
      }),
    })

    const client = new PrivateCubidAllocatorClient({
      baseUrl: "https://passport.test.cubid.me",
      environment: "development",
      primaryKey: {
        keyId: "key-primary-1",
        privateKeyPem: primaryKeys.privateKeyPem,
      },
      secondaryKey: {
        keyId: "key-secondary-2",
        privateKeyPem: secondaryKeys.privateKeyPem,
      },
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    // Resolve with secondary key
    await client.resolveBatch(
      {
        contract_version: "2026-08-14",
        project_id: 10,
        items: [{ project_scoped_uuid: "11111111-1111-4111-8111-111111111111" }],
      },
      { useSecondaryKey: true }
    )

    const [, calledInit] = mockFetch.mock.calls[0]
    expect(calledInit.headers["X-Cubid-Allocator-Key-Id"]).toBe("key-secondary-2")
  })

  test("PrivateCubidAllocatorClient retries on transient upstream 503 and fails closed on 401", async () => {
    let callCount = 0
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return { ok: false, status: 503, json: async () => ({ error: "Temporary unavailable" }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contract_version: "2026-08-14",
          request_id: "cubid_req_retry_ok",
          items: [],
        }),
      }
    })

    const client = new PrivateCubidAllocatorClient({
      baseUrl: "https://passport.test.cubid.me",
      environment: "preview",
      primaryKey: {
        keyId: "key-primary-1",
        privateKeyPem: primaryKeys.privateKeyPem,
      },
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    const result = await client.resolveBatch({
      contract_version: "2026-08-14",
      project_id: 10,
      items: [{ project_scoped_uuid: "11111111-1111-4111-8111-111111111111" }],
    })

    expect(result.ok).toBe(true)
    expect(callCount).toBe(2)

    // Test non-retryable 401
    const mockAuthFail = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized signature", code: "unauthorized" }),
    })

    const clientAuthFail = new PrivateCubidAllocatorClient({
      baseUrl: "https://passport.test.cubid.me",
      environment: "preview",
      primaryKey: {
        keyId: "key-primary-1",
        privateKeyPem: primaryKeys.privateKeyPem,
      },
      fetchFn: mockAuthFail as unknown as typeof fetch,
    })

    const authFailResult = await clientAuthFail.resolveBatch({
      contract_version: "2026-08-14",
      project_id: 10,
      items: [{ project_scoped_uuid: "11111111-1111-4111-8111-111111111111" }],
    })

    expect(authFailResult.ok).toBe(false)
    if (!authFailResult.ok) {
      expect(authFailResult.retryable).toBe(false)
      expect(authFailResult.status).toBe(401)
    }
    expect(mockAuthFail).toHaveBeenCalledTimes(1)
  })
})
