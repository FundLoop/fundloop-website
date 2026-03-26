import { Badge } from "@/components/ui/badge"
import type { ZkasDatasetStatus } from "@/types/zkas"

const STATUS_VARIANTS: Record<ZkasDatasetStatus, "default" | "secondary" | "destructive" | "outline"> = {
  uploaded: "outline",
  validated: "secondary",
  failed: "destructive",
  approved: "default",
  included: "default",
  replaced: "outline",
  archived: "outline",
}

export function DatasetStatusBadge({ status }: { status: ZkasDatasetStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>
}
