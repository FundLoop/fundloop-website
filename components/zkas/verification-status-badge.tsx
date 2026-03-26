import { Badge } from "@/components/ui/badge"
import type { ZkasVerificationStatus } from "@/types/zkas"

const STATUS_VARIANTS: Record<ZkasVerificationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  verified: "default",
  rejected: "destructive",
}

export function VerificationStatusBadge({ status }: { status: ZkasVerificationStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>
}
