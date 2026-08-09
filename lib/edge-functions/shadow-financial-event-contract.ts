import { edgeCommandFailure,edgeCommandSuccess } from "./result.ts"
export function validateShadowFinancialEvent(value:unknown,environment:string){
 if(environment==="production") return edgeCommandFailure("production_disabled","Shadow ingestion is unavailable in production.")
 if(!value||typeof value!=="object"||Array.isArray(value)) return edgeCommandFailure("invalid_payload","Expected an object.")
 const v=value as Record<string,unknown>
 if(typeof v.providerKey!=="string"||typeof v.providerEventId!=="string"||typeof v.custodyAccountId!=="number"||typeof v.assetId!=="number"||typeof v.eventType!=="string"||typeof v.settledNativeAmount!=="string"||typeof v.occurredAt!=="string"||typeof v.evidenceHash!=="string") return edgeCommandFailure("invalid_payload","Required event fields are missing.")
 return edgeCommandSuccess(v)
}
