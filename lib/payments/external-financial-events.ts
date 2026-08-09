export type ExternalFinancialEventInput={
 providerKey:string;providerEventId:string;custodyAccountId:number;assetId:number;eventType:string;
 providerSequence?:number;settledNativeAmount:string;occurredAt:string;evidenceHash:string;
 legacyTimestampEvidence?:Record<string,string>
}
export const legacyFinancialTimestampClassification="non_settlement_evidence" as const
