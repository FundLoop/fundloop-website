import { expect, type BrowserContext } from "@playwright/test"

type LoginInput = {
  baseURL: string
  email: string
  password: string
  secret: string
}

export async function loginThroughE2EEndpoint(context: BrowserContext, input: LoginInput) {
  const response = await context.request.post(`${input.baseURL}/api/internal/e2e/login`, {
    headers: {
      "x-fundloop-e2e-secret": input.secret,
    },
    data: {
      email: input.email,
      password: input.password,
    },
  })

  expect(response.ok()).toBeTruthy()
  const body = (await response.json()) as { ok: boolean; error?: string }
  expect(body.ok, body.error ?? "Expected test login to succeed").toBeTruthy()
}
