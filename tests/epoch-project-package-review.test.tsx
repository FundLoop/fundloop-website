import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EpochProjectPackageReview } from "@/components/founder/epoch-project-package-review"
import { EpochProjectPackageValidator } from "@/components/admin/epoch-project-package-controls"
import { invokeEpochProjectPackageWorkflowBrowser } from "@/lib/edge-functions/epoch-project-package-workflow"
import type { EpochProjectPackageSummary } from "@/lib/edge-functions/epoch-project-package-contract"

vi.mock("@/lib/edge-functions/epoch-project-package-workflow",()=>({invokeEpochProjectPackageWorkflowBrowser:vi.fn()}))
const refresh=vi.fn()
vi.mock("@/i18n/navigation",()=>({useRouter:()=>({refresh})}))

const packageRow:EpochProjectPackageSummary={id:8,projectId:101,projectName:"Civic Mesh",projectSlug:"civic-mesh",
  intendedCycleKey:"2026-08",canonicalCycleKey:"2026-08",version:2,status:"frozen",listStatus:"valid",fundingStatus:"settled",
  complianceStatus:"passed",cubidStatus:"eligible",cutoffAt:"2026-09-01T07:00:00Z",reconciliationEmailDeliveredAt:"2026-09-01T09:00:00Z",
  reconciliationDeadlineAt:"2026-09-03T07:00:00Z",paymentCount:1,fundingSourceCount:1,cohortCount:5,eligibleUserCount:3,
  heldUserCount:2,preliminaryUsd:"990",manifestHash:"f".repeat(64),projectFeeAssessedOnce:true,baseFeeDeferred:true}

describe("founder epoch package review",()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.mocked(invokeEpochProjectPackageWorkflowBrowser).mockResolvedValue({ok:true,data:{action:"approve",packageId:8,decisionEventId:3}})})
  it("shows exact paired totals without user identifiers",()=>{render(<EpochProjectPackageReview packages={[packageRow]}/>)
    expect(screen.getByText("$990")).toBeTruthy();expect(screen.getByText("3")).toBeTruthy();expect(screen.getByText("2")).toBeTruthy()
    expect(document.body.textContent).not.toContain("00000000-")
  })
  it("approves a delivered frozen package",async()=>{render(<EpochProjectPackageReview packages={[packageRow]}/>)
    fireEvent.click(screen.getByRole("button",{name:"Approve frozen package"}))
    await waitFor(()=>expect(invokeEpochProjectPackageWorkflowBrowser).toHaveBeenCalledWith(expect.objectContaining({action:"approve",packageId:8})))
    expect(refresh).toHaveBeenCalled()
  })
  it("requires a reason before opt out",()=>{render(<EpochProjectPackageReview packages={[packageRow]}/>)
    const button=screen.getByRole("button",{name:"Opt out and roll forward"}) as HTMLButtonElement;expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Opt-out reason"),{target:{value:"Carry forward"}});expect(button.disabled).toBe(false)
  })
  it("keeps compliance pending until an operator supplies reviewed evidence",()=>{
    render(<EpochProjectPackageValidator />)
    const validationButton=screen.getByRole("button",{name:"Validate or freeze package"}) as HTMLButtonElement
    expect(validationButton.disabled).toBe(true)
    expect(screen.getAllByRole("combobox").map(control=>(control as HTMLSelectElement).value)).toEqual(["pending","pending","pending"])
    fireEvent.change(screen.getByLabelText("Project slug"),{target:{value:"civic-mesh"}})
    fireEvent.change(screen.getByLabelText("Cycle"),{target:{value:"2026-08"}})
    fireEvent.change(screen.getByLabelText("Compliance valid until"),{target:{value:"2026-12-01T00:00"}})
    for(const label of ["KYB","KYC","Sanctions"]) fireEvent.change(screen.getByLabelText(label),{target:{value:"passed"}})
    fireEvent.change(screen.getByLabelText("Compliance evidence SHA-256"),{target:{value:"a".repeat(64)}})
    expect(validationButton.disabled).toBe(false)
  })
})
