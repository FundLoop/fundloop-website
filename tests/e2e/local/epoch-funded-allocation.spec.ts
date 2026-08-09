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
  await expect(page.getByText("9652",{exact:true}).last()).toBeVisible()
  await expect(page.getByRole("button",{name:"Calculate provisional redistribution"})).toBeVisible()
  const calculationResponse=page.waitForResponse(response=>response.url().includes("/functions/v1/epoch-funded-allocation")&&response.request().method()==="POST")
  await page.getByRole("button",{name:"Calculate provisional redistribution"}).click()
  const response=await calculationResponse
  expect(response.ok()).toBe(true)
  expect((await response.json()) as {ok:boolean}).toMatchObject({ok:true})
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
