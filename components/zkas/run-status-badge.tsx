import { Badge } from "@/components/ui/badge"
import type { ZkasRunStatus } from "@/types/zkas"

const STATUS_VARIANTS: Record<ZkasRunStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  locked: "secondary",
  running: "secondary",
  completed: "default",
  failed: "destructive",
  finalized: "default",
}

export function RunStatusBadge({ status }: { status: ZkasRunStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>
}
