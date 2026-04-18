"use client"

import { createCubidWeb2Client, type CubidWeb2Client } from "@cubid/web2"
import type {
  AddStampRequest,
  AddStampResponse,
  CubidApiClient,
  SearchLocationRequest,
  SearchLocationResponse,
  SendPhoneOtpRequest,
  SendPhoneOtpResponse,
  VerifyPhoneOtpRequest,
  VerifyPhoneOtpResponse,
} from "@cubid/api"

function unsupportedPromise<T>() {
  return Promise.reject<T>(
    new Error("This CUBID browser bridge only supports phone OTP and stamp persistence."),
  )
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: string }
    | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "CUBID browser bridge request failed.")
  }

  return payload.data as T
}

export function createBrowserCubidWeb2Client({
  passportOrigin,
}: {
  passportOrigin: string
}): CubidWeb2Client {
  const apiClient: CubidApiClient = {
    config: {
      apiKey: "browser-session",
      baseUrl:
        typeof window !== "undefined" ? `${window.location.origin}/api/internal/cubid` : "http://localhost/api/internal/cubid",
      dappId: "browser-session",
      fetch,
    },
    addStamp: (request: AddStampRequest) => postJson<AddStampResponse>("/api/internal/cubid/stamps/add", request),
    createUser: async () => unsupportedPromise(),
    fetchApproxLocation: async () => unsupportedPromise(),
    fetchExactLocation: async () => unsupportedPromise(),
    fetchIdentity: async () => unsupportedPromise(),
    fetchRoughLocation: async () => unsupportedPromise(),
    fetchScore: async () => unsupportedPromise(),
    fetchStamps: async () => unsupportedPromise(),
    fetchUserData: async () => unsupportedPromise(),
    searchLocation: async (_request: SearchLocationRequest) => unsupportedPromise<SearchLocationResponse>(),
    sendEmailOtp: async () => unsupportedPromise(),
    sendPhoneOtp: (request: SendPhoneOtpRequest) =>
      postJson<SendPhoneOtpResponse>("/api/internal/cubid/phone/start", request),
    verifyEmailOtp: async () => unsupportedPromise(),
    verifyPhoneOtp: (request: VerifyPhoneOtpRequest) =>
      postJson<VerifyPhoneOtpResponse>("/api/internal/cubid/phone/verify", request),
  }

  return createCubidWeb2Client(apiClient, {
    allowPath: "/widget-allow",
    passportOrigin,
  })
}
