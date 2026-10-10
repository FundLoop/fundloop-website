"use client"

// One toast store, two import paths.
//
// This file and `hooks/use-toast.ts` were byte-identical copies of the same reducer, which meant
// two separate in-memory stores: 27 components dispatched into this one and 11 into the other, and
// `components/ui/toaster.tsx` — the only renderer — subscribes to the other. Anything dispatched
// here was therefore discarded, visibly to nobody.
//
// Re-exporting keeps every existing import working while there is only one store to render. The
// duplicate implementation is gone rather than kept in sync.
export { reducer, toast, useToast } from "@/hooks/use-toast"
