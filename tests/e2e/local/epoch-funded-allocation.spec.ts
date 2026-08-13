import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { loginThroughE2EEndpoint } from "../support/e2e-login"
import { collectUnexpectedLocalConsoleErrors } from "../support/local-console-errors"

const outputDir=path.resolve("output/playwright/issue-136")
const hashPattern=/^[0-9a-f]{64}$/
const allocationCycleKey="2026-04"

type AllocationArtifact={
  resultHash:string
  manifestHash:string
  selectedPreviewHash:string
  sourceDispositions:Array<{sourceLotKey:string;canonicalMinor:string;exactUsd:string}>
  invariantChecks:Array<{code:string;ok:boolean}>
}

async function postAllocationAction(page:Page,buttonName:string) {
  const responsePromise=page.waitForResponse(response=>response.url().includes("/functions/v1/epoch-funded-allocation")&&response.request().method()==="POST")
  await page.getByRole("button",{name:buttonName}).click()
  const response=await responsePromise
  expect(response.ok()).toBe(true)
  return response.json() as Promise<{ok:boolean;data?:Record<string,unknown>;error?:unknown}>
}

async function lockAndCalculate(page:Page) {
  const preview=await postAllocationAction(page,"Preview scenario")
  expect(preview.ok,JSON.stringify(preview.error)).toBe(true)
  expect(preview.data).toMatchObject({action:"preview"})
  const previewHash=String(preview.data?.previewHash ?? "")
  expect(previewHash).toMatch(hashPattern)
  const previewArtifact=preview.data?.artifact as AllocationArtifact
  expect(previewArtifact.selectedPreviewHash).toBe(previewHash)
  expect(previewArtifact.sourceDispositions.length).toBeGreaterThan(0)
  expect(previewArtifact.sourceDispositions.every(source=>source.sourceLotKey&&source.canonicalMinor&&source.exactUsd)).toBe(true)
  expect(previewArtifact.invariantChecks.every(check=>check.ok)).toBe(true)
  await expect(page.getByText(previewHash.slice(0,12),{exact:false})).toBeVisible()

  const locked=await postAllocationAction(page,"Lock selected scenario")
  expect(locked.ok,JSON.stringify(locked.error)).toBe(true)
  expect(locked.data).toMatchObject({action:"lock"})
  const manifestHash=String(locked.data?.manifestHash ?? "")
  expect(manifestHash).toMatch(hashPattern)
  const manifest=locked.data?.manifest as {selectedPreviewHash?:string;projectSources?:unknown[]}
  expect(manifest.selectedPreviewHash).toBe(previewHash)
  expect(manifest.projectSources?.length).toBeGreaterThan(0)
  await expect(page.getByText(manifestHash.slice(0,12),{exact:false})).toBeVisible()

  const first=await postAllocationAction(page,"Calculate provisional redistribution")
  expect(first.ok,JSON.stringify(first.error)).toBe(true)
  expect(first.data).toMatchObject({action:"calculate"})
  const firstArtifact=first.data?.artifact as AllocationArtifact
  expect(firstArtifact.manifestHash).toBe(manifestHash)
  expect(firstArtifact.selectedPreviewHash).toBe(previewHash)
  expect(firstArtifact.sourceDispositions).toEqual(previewArtifact.sourceDispositions)
  expect(firstArtifact.invariantChecks.every(check=>check.ok)).toBe(true)

  const replay=await postAllocationAction(page,"Calculate provisional redistribution")
  expect(replay.ok,JSON.stringify(replay.error)).toBe(true)
  const replayArtifact=replay.data?.artifact as AllocationArtifact
  expect(replayArtifact.resultHash).toBe(firstArtifact.resultHash)
  expect(replayArtifact.sourceDispositions).toEqual(firstArtifact.sourceDispositions)
  return firstArtifact
}

test("operator reviews and idempotently recalculates the settled redistribution", async ({page,context,baseURL}) => {
  if(!baseURL) throw new Error("allocation-browser-base-url-required")
  const consoleErrors:string[]=[]
  collectUnexpectedLocalConsoleErrors(page,consoleErrors)
  await loginThroughE2EEndpoint(context,{baseURL,email:"maya@fundloop.example.com",password:"FundLoopFounder123!",secret:process.env.FUNDLOOP_E2E_SECRET ?? ""})
  await page.setViewportSize({width:1440,height:900})
  await page.goto(`${baseURL}/en/admin/cycles/${allocationCycleKey}/prep`)
  await expect(page.getByRole("heading",{name:"Immutable allocation review"})).toBeVisible()
  await expect(page.getByText("Settled Cubid redistribution")).toBeVisible()
  await expect(page.getByText("Production disabled",{exact:true}).last()).toBeVisible()
  await expect(page.getByRole("button",{name:"Preview scenario"})).toBeVisible()
  await lockAndCalculate(page)
  await expect(page.getByRole("button",{name:"Calculate provisional redistribution"})).toBeEnabled()
  await mkdir(outputDir,{recursive:true})
  await page.screenshot({path:path.join(outputDir,"desktop-1440x900.png"),fullPage:false})
  await page.setViewportSize({width:390,height:844})
  const allocationHeading=page.getByRole("heading",{name:"Immutable allocation review"})
  await allocationHeading.scrollIntoViewIfNeeded()
  await expect(allocationHeading).toBeVisible()
  await page.screenshot({path:path.join(outputDir,"mobile-390x844.png"),fullPage:false})
  expect(consoleErrors).toEqual([])
})

test("operator approves the exact result and role surfaces preserve privacy", async ({page,context,browser,baseURL}) => {
  if(!baseURL) throw new Error("allocation-close-browser-base-url-required")
  const consoleErrors:string[]=[]
  collectUnexpectedLocalConsoleErrors(page,consoleErrors)
  await loginThroughE2EEndpoint(context,{baseURL,email:"maya@fundloop.example.com",password:"FundLoopFounder123!",secret:process.env.FUNDLOOP_E2E_SECRET ?? ""})
  await page.setViewportSize({width:1440,height:900})
  await page.goto(`${baseURL}/en/admin/cycles/${allocationCycleKey}/prep`)
  const persistedResult=page.getByText("Final allocation")
  await expect(persistedResult).toBeVisible()
  const replay=await postAllocationAction(page,"Calculate provisional redistribution")
  expect(replay.ok,JSON.stringify(replay.error)).toBe(true)
  expect((replay.data?.artifact as AllocationArtifact).resultHash).toMatch(hashPattern)
  const preparationResponse=page.waitForResponse(response=>response.url().includes("/functions/v1/epoch-allocation-close")&&response.request().method()==="POST")
  await page.getByRole("button",{name:"Reproduce result and prepare close root"}).click()
  const prepared=(await (await preparationResponse).json()) as {ok:boolean;data?:{rootHash:string};error?:unknown}
  expect(prepared.ok,JSON.stringify(prepared.error)).toBe(true)
  await expect(page.getByTestId("epoch-close-root-review")).toContainText(prepared.data?.rootHash ?? "missing-root")
  await page.reload()
  await expect(page.getByTestId("epoch-close-root-review")).toContainText(prepared.data?.rootHash ?? "missing-root")
  const approvalResponse=page.waitForResponse(response=>response.url().includes("/functions/v1/epoch-allocation-close")&&response.request().method()==="POST")
  await page.getByRole("button",{name:"Approve exact root and enter payout readying"}).click()
  expect((await (await approvalResponse).json()) as {ok:boolean}).toMatchObject({ok:true})
  await expect(page.getByText("Conditional users")).toBeVisible()
  await expect(page.getByText("payout_readying",{exact:true})).toBeVisible()
  await mkdir(path.resolve("output/playwright/issue-137"),{recursive:true})
  await page.screenshot({path:path.resolve("output/playwright/issue-137/operator-desktop-1440x900.png"),fullPage:false})
  await page.goto(`${baseURL}/en/workspace/earnings`)
  await expect(page.getByText("Your approved allocation is conditional and not payable")).toBeVisible()
  await page.screenshot({path:path.resolve("output/playwright/issue-137/user-desktop-1440x900.png"),fullPage:false})
  await page.goto(`${baseURL}/en/founder/projects/ecostream/reporting`)
  await expect(page.getByText("Approved funded project totals")).toBeVisible()
  await page.screenshot({path:path.resolve("output/playwright/issue-137/founder-desktop-1440x900.png"),fullPage:false})
  await page.setViewportSize({width:390,height:844})
  await page.goto(`${baseURL}/en/admin/cycles/${allocationCycleKey}/prep`)
  await page.getByRole("heading",{name:"Conditional awards and reproducible close package"}).scrollIntoViewIfNeeded()
  await page.screenshot({path:path.resolve("output/playwright/issue-137/operator-mobile-390x844.png"),fullPage:false})
  const publicContext=await browser.newContext({viewport:{width:390,height:844}})
  const publicPage=await publicContext.newPage()
  await publicPage.goto(`${baseURL}/en/projects/ecostream`)
  const publicSummary=publicPage.getByText("Approved project funding summary")
  await publicSummary.scrollIntoViewIfNeeded()
  await expect(publicSummary).toBeVisible()
  await expect(publicPage.getByText("Privacy threshold not met").first()).toBeVisible()
  await expect(publicPage.getByText("9652",{exact:true})).toHaveCount(0)
  await expect(publicPage.getByText("maya@fundloop.example.com")).toHaveCount(0)
  await publicPage.waitForTimeout(750)
  await publicPage.screenshot({path:path.resolve("output/playwright/issue-137/public-mobile-390x844.png"),fullPage:false})
  await publicContext.close()
  expect(consoleErrors).toEqual([])
})
