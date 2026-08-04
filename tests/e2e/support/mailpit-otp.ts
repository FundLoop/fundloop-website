import { setTimeout as delay } from "node:timers/promises"

type MailpitMessageSummary = {
  ID?: string
  Created?: string
  To?: Array<{ Address?: string }>
}
type MailpitSearchResponse = {
  messages?: MailpitMessageSummary[]
  Messages?: MailpitMessageSummary[]
}

export async function consumeLocalOtp(input: {
  mailpitUrl: string
  recipient: string
  requestedAfter: Date
  fill: (otp: string) => Promise<void>
  fetcher?: typeof fetch
  attempts?: number
  intervalMs?: number
}) {
  const fetcher = input.fetcher ?? fetch
  const attempts = input.attempts ?? 30
  const query = new URLSearchParams({ query: `to:${input.recipient}` })

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const search = await fetcher(`${input.mailpitUrl}/api/v1/search?${query.toString()}`, {
        signal: AbortSignal.timeout(5_000),
      })
      if (!search.ok) throw new Error("search")
      const result = (await search.json()) as MailpitSearchResponse
      const messages = result.messages ?? result.Messages ?? []
      const candidate = messages.find((message) => {
        const created = message.Created ? new Date(message.Created).getTime() : 0
        const addressed = message.To?.some((to) => to.Address?.toLowerCase() === input.recipient.toLowerCase()) ?? true
        return Boolean(message.ID) && created >= input.requestedAfter.getTime() && addressed
      })
      if (!candidate?.ID) {
        await delay(input.intervalMs ?? 500)
        continue
      }

      const detail = await fetcher(`${input.mailpitUrl}/api/v1/message/${encodeURIComponent(candidate.ID)}`, {
        signal: AbortSignal.timeout(5_000),
      })
      if (!detail.ok) throw new Error("detail")
      let body = await detail.text()
      const tokens = [...new Set(body.match(/(?<!\d)\d{6}(?!\d)/g) ?? [])]
      if (tokens.length !== 1) {
        body = ""
        throw new Error("token-count")
      }
      const otp = tokens[0]
      body = ""
      await input.fill(otp)
      return
    } catch (error) {
      if (error instanceof Error && error.message === "token-count") throw new Error("mailpit-otp-token-invalid")
      if (attempt === attempts - 1) throw new Error("mailpit-otp-unavailable")
      await delay(input.intervalMs ?? 500)
    }
  }

  throw new Error("mailpit-otp-unavailable")
}
