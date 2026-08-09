import { fireEvent,render,screen,waitFor } from "@testing-library/react"
import { beforeEach,describe,expect,it,vi } from "vitest"
import { StripeBankTransferPanel } from "@/components/stripe-bank-transfer-panel"
import { invokeStripeBankTransferIntentCreateBrowser } from "@/lib/edge-functions/stripe-bank-transfer-intent-create"
import { invokeStripeBankTransferStatusBrowser } from "@/lib/edge-functions/stripe-bank-transfer-status"

vi.mock("@/lib/edge-functions/stripe-bank-transfer-intent-create",()=>({invokeStripeBankTransferIntentCreateBrowser:vi.fn()}))
vi.mock("@/lib/edge-functions/stripe-bank-transfer-status",()=>({invokeStripeBankTransferStatusBrowser:vi.fn()}))

const payment={id:7,paymentAmount:25,statusCode:"draft",periodStart:"2026-08-01",periodEnd:"2026-08-31"}

describe("StripeBankTransferPanel",()=>{
  beforeEach(()=>{
    vi.mocked(invokeStripeBankTransferStatusBrowser).mockResolvedValue({ok:true,data:[]})
    vi.mocked(invokeStripeBankTransferIntentCreateBrowser).mockResolvedValue({ok:true,data:{intentId:9,paymentId:7,currencyCode:"USD",expectedAmountMinor:"2500",providerPaymentIntentId:"pi_fixture",status:"requires_action",hostedInstructionsUrl:"https://payments.stripe.com/test",sandboxOnly:true}})
  })
  it("labels the review-only boundary and keeps CAD visibly unavailable",async()=>{
    render(<StripeBankTransferPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged={false}/>)
    await waitFor(()=>expect(invokeStripeBankTransferStatusBrowser).toHaveBeenCalledWith("ecostream"))
    expect(screen.getByText("Stripe bank transfer sandbox")).toBeTruthy()
    expect(screen.getByText(/CAD remains unavailable/)).toBeTruthy()
    expect((screen.getByRole("button",{name:/Create USD sandbox instructions/}) as HTMLButtonElement).disabled).toBe(true)
  })
  it("creates USD instructions only after acknowledgement and shows the hosted handoff",async()=>{
    render(<StripeBankTransferPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged/>)
    fireEvent.click(screen.getByRole("button",{name:/Create USD sandbox instructions/}))
    await waitFor(()=>expect(invokeStripeBankTransferIntentCreateBrowser).toHaveBeenCalledWith({projectSlug:"ecostream",paymentId:7,currencyCode:"USD",expectedAmountMinor:"2500"}))
    expect(await screen.findByText(/Sandbox instructions created for payment #7/)).toBeTruthy()
    expect((screen.getByRole("link",{name:/Open Stripe-hosted instructions/}) as HTMLAnchorElement).href).toBe("https://payments.stripe.com/test")
  })
  it("shows provider failures without exposing provider payloads",async()=>{
    vi.mocked(invokeStripeBankTransferIntentCreateBrowser).mockResolvedValue({ok:false,error:{code:"stripe_sandbox_not_configured",message:"Bank Transfer capability is disabled."}})
    render(<StripeBankTransferPanel projectSlug="ecostream" payments={[payment]} termsAcknowledged/>)
    fireEvent.click(screen.getByRole("button",{name:/Create USD sandbox instructions/}))
    expect((await screen.findByRole("alert")).textContent).toContain("Bank Transfer capability is disabled.")
    expect(document.body.textContent).not.toContain("routing_number")
  })
})
