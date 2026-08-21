import { readFileSync } from "node:fs"
import { describe,expect,it,vi } from "vitest"
import { createStripeBankTransferIntent } from "@/lib/execution/adapters/stripe-bank-transfer"
import { normalizeStripeBankTransferWebhook,validateStripeBankTransferIntentCreateInput } from "@/lib/stripe/stripe-bank-transfer-contract"

describe("Stripe bank-transfer intake",()=>{
  it("allows only sandbox USD and keeps CAD and production fail closed",()=>{
    const input={projectSlug:"ecostream",paymentId:1,currencyCode:"USD",expectedAmountMinor:"128000"}
    expect(validateStripeBankTransferIntentCreateInput(input,"local")).toMatchObject({ok:true})
    expect(validateStripeBankTransferIntentCreateInput(input,"development")).toMatchObject({ok:true})
    expect(validateStripeBankTransferIntentCreateInput(input,"preview")).toMatchObject({ok:true})
    expect(validateStripeBankTransferIntentCreateInput({...input,currencyCode:"CAD"},"local")).toMatchObject({ok:false,error:{code:"cad_bank_transfer_unavailable"}})
    expect(validateStripeBankTransferIntentCreateInput(input,"production")).toMatchObject({ok:false,error:{code:"production_disabled"}})
    expect(validateStripeBankTransferIntentCreateInput({...input,cardNumber:"4242"},"local")).toMatchObject({ok:false,error:{code:"invalid_payload"}})
  })
  it("builds only customer-balance push-transfer objects with deterministic idempotency",async()=>{
    const provider={createCustomer:vi.fn(async()=>({id:"cus_fixture",livemode:false})),createPaymentIntent:vi.fn(async()=>({id:"pi_fixture",livemode:false,status:"requires_action",hostedInstructionsUrl:"https://payments.stripe.com/bank_transfers/test"}))}
    const result=await createStripeBankTransferIntent(provider,{environment:"local",projectId:1,projectSlug:"ecostream",paymentId:1,amountMinor:"128000",currencyCode:"USD",actorUserId:"actor"})
    expect(result).toMatchObject({ok:true,data:{providerCustomerId:"cus_fixture",providerPaymentIntentId:"pi_fixture"}})
    expect(provider.createCustomer).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey:"fundloop:stripe-intake:1:1:customer"}))
    expect(provider.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey:"fundloop:stripe-intake:1:1:intent",currency:"usd",amountMinor:128000}))
  })
  it.each(["development","preview"])("allows the %s review runtime without enabling production",async(environment)=>{
    const provider={createCustomer:vi.fn(async()=>({id:"cus_fixture",livemode:false})),createPaymentIntent:vi.fn(async()=>({id:"pi_fixture",livemode:false,status:"requires_action",hostedInstructionsUrl:null}))}
    expect(await createStripeBankTransferIntent(provider,{environment,projectId:1,projectSlug:"ecostream",paymentId:1,amountMinor:"128000",currencyCode:"USD",actorUserId:"actor"})).toMatchObject({ok:true})
  })
  it("rejects live objects even when the runtime claims local",async()=>{
    const result=await createStripeBankTransferIntent({createCustomer:async()=>({id:"cus_live",livemode:true}),createPaymentIntent:async()=>({id:"pi_unused",livemode:true,status:"x",hostedInstructionsUrl:null})},
      {environment:"local",projectId:1,projectSlug:"ecostream",paymentId:1,amountMinor:"1",currencyCode:"USD",actorUserId:"actor"})
    expect(result).toMatchObject({ok:false,error:{code:"live_mode_denied"}})
  })
  it("normalizes availability, funding, refunds and disputes without accepting unrelated events",()=>{
    expect(normalizeStripeBankTransferWebhook("payment_intent.succeeded",{id:"pi_1",customer:"cus_1",currency:"usd",amount_received:1000,latest_charge:{balance_transaction:{id:"txn_1",currency:"usd",amount:1000,fee:25,net:975}}})).toMatchObject({evidenceType:"available",grossAmountMinor:"1000",feeAmountMinor:"25",netAmountMinor:"975",providerBalanceCurrencyCode:"USD"})
    expect(normalizeStripeBankTransferWebhook("payment_intent.succeeded",{id:"pi_2",customer:"cus_1",currency:"usd",amount_received:1000,latest_charge:{balance_transaction:{id:"txn_2",currency:"cad",amount:1400,fee:50,net:1350}}})).toMatchObject({evidenceType:"available",grossAmountMinor:"1000",feeAmountMinor:null,netAmountMinor:null,providerBalanceCurrencyCode:"CAD",providerBalanceGrossAmountMinor:"1400",providerBalanceFeeAmountMinor:"50",providerBalanceNetAmountMinor:"1350"})
    expect(normalizeStripeBankTransferWebhook("customer_cash_balance_transaction.created",{id:"ccsbtxn_1",customer:"cus_1",currency:"usd",net_amount:1000})).toMatchObject({evidenceType:"funded"})
    expect(normalizeStripeBankTransferWebhook("charge.refunded",{id:"ch_1",customer:"cus_1",payment_intent:"pi_1",currency:"usd",amount_refunded:1000})).toMatchObject({evidenceType:"refunded"})
    expect(normalizeStripeBankTransferWebhook("charge.dispute.closed",{id:"dp_1",currency:"usd",amount:1000,status:"lost",payment_intent:"pi_1"})).toMatchObject({evidenceType:"dispute_lost"})
    expect(normalizeStripeBankTransferWebhook("checkout.session.completed",{id:"cs_1"})).toBeNull()
  })
  it("keeps webhooks raw-body signed, SDK-observed, and tables command-only",()=>{
    const webhook=readFileSync("supabase/functions/stripe-bank-transfer-webhook/index.ts","utf8")
    const intent=readFileSync("supabase/functions/stripe-bank-transfer-intent-create/index.ts","utf8")
    const sql=readFileSync("supabase/migrations/20260809130000_stripe_bank_transfer_intake.sql","utf8")
    expect(webhook).toContain("constructEventAsync(payload,signature,webhookSecret")
    expect(webhook).toContain("stripe.paymentIntents.retrieve")
    expect(webhook).toContain("stripe.balance.retrieve")
    expect(webhook).not.toContain("console.log")
    expect(intent).toContain('payment_method_types:["customer_balance"]')
    expect(intent).toContain('type:"us_bank_transfer"')
    expect(intent).toContain("stripe_bank_transfers_not_enabled")
    expect(intent).not.toMatch(/card|acss_debit/)
    expect(sql).toContain("stripe_webhook_dedupe_conflict")
    expect(sql).toContain("stripe_available_evidence_mismatch")
    expect(sql).toContain("stripe_intake_records_are_append_only")
    expect(sql).toContain("stripe_cad_bank_transfer_unavailable")
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE,TRUNCATE")
  })
})
