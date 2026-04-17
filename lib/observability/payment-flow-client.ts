"use client"

import { parsePaymentFlowEventBatch, type PaymentFlowEventInput } from "@/lib/observability/payment-flow"

async function postPaymentFlowEvents(events: PaymentFlowEventInput[]) {
  try {
    await fetch("/api/internal/observability/payment-events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(events.length === 1 ? events[0] : { events }),
    })
  } catch {
    // Observability must never break the primary flow.
  }
}

export async function capturePaymentFlowEvent(event: PaymentFlowEventInput) {
  await postPaymentFlowEvents(parsePaymentFlowEventBatch(event))
}

export async function capturePaymentFlowEvents(events: PaymentFlowEventInput[]) {
  await postPaymentFlowEvents(parsePaymentFlowEventBatch({ events }))
}
