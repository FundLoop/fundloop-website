import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { loginThroughE2EEndpoint } from "../support/e2e-login"

const outputDir=path.resolve("output/playwright/issue-136")

test("operator reviews and idempotently recalculates the settled redistribution", async ({page,context,baseURL}) => {
  if(!baseURL) throw new Error("allocation-browser-base-url-required")
  const consoleErrors:string[]=[]
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text())})
  await loginThroughE2EEndpoint(context,{baseURL,email:"maya@fundloop.example.com",password:"FundLoopFounder123!",secret:"allocation-local-secret"})
  await page.setViewportSize({width:1440,height:900})
  await page.goto(`${baseURL}/en/admin/cycles/2026-08/prep`)
  await expect(page.getByRole("heading",{name:"Immutable allocation review"})).toBeVisible()
  await expect(page.getByText("Settled Cubid redistribution")).toBeVisible()
  await expect(page.getByText("Production disabled",{exact:true}).last()).toBeVisible()
  await expect(page.getByRole("button",{name:"Calculate provisional redistribution"})).toBeVisible()
  const calculationResponse=page.waitForResponse(response=>response.url().includes("/functions/v1/epoch-funded-allocation")&&response.request().method()==="POST")
  await page.getByRole("button",{name:"Calculate provisional redistribution"}).click()
  const response=await calculationResponse
  expect(response.ok()).toBe(true)
  const calculationBody=(await response.json()) as {ok:boolean;error?:unknown}
  expect(calculationBody.ok,JSON.stringify(calculationBody.error)).toBe(true)
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
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text())})
  await loginThroughE2EEndpoint(context,{baseURL,email:"maya@fundloop.example.com",password:"FundLoopFounder123!",secret:"allocation-local-secret"})
  await page.setViewportSize({width:1440,height:900})
  await page.goto(`${baseURL}/en/admin/cycles/2026-08/prep`)
  if(await page.getByRole("button",{name:"Calculate provisional redistribution"}).isVisible()) {
    const calculationResponse=page.waitForResponse(response=>response.url().includes("/functions/v1/epoch-funded-allocation")&&response.request().method()==="POST")
    await page.getByRole("button",{name:"Calculate provisional redistribution"}).click()
    const calculationBody=(await (await calculationResponse).json()) as {ok:boolean;error?:unknown}
    expect(calculationBody.ok,JSON.stringify(calculationBody.error)).toBe(true)
    await expect(page.getByText("Final allocation")).toBeVisible()
  }
  const preparationResponse=page.waitForResponse(response=>response.url().includes("/functions/v1/epoch-allocation-close")&&response.request().method()==="POST")
  await page.getByRole("button",{name:"Reproduce result and prepare close root"}).click()
  const prepared=(await (await preparationResponse).json()) as {ok:boolean;data?:{rootHash:string}}
  expect(prepared).toMatchObject({ok:true})
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
  await page.goto(`${baseURL}/en/admin/cycles/2026-08/prep`)
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
