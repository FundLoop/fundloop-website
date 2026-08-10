import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect,test } from "@playwright/test"
import { loginThroughE2EEndpoint } from "../support/e2e-login"

const outputDir=path.resolve("output/playwright/issue-140")
test("operator reviews Base Safe limits, exact command, and reconciliation state",async({page,context,baseURL})=>{
  if(!baseURL)throw new Error("base-payout-browser-base-url-required")
  const errors:string[]=[];page.on("console",(message)=>{if(message.type()==="error")errors.push(message.text())})
  await loginThroughE2EEndpoint(context,{baseURL,email:"maya@fundloop.example.com",password:"FundLoopFounder123!",secret:process.env.FUNDLOOP_E2E_SECRET ?? ""})
  await page.setViewportSize({width:1440,height:900});await page.goto(`${baseURL}/en/admin/cycles/2026-10/payouts`)
  const controls=page.getByTestId("base-payout-operator-controls");await controls.scrollIntoViewIfNeeded()
  await expect(controls.getByText("Base Safe payout checkpoints")).toBeVisible()
  await expect(controls.getByText("$20 transaction · $500 rolling · $5,000 epoch")).toBeVisible()
  await expect(controls.getByText("Platform Safe")).toBeVisible();await expect(controls.getByText(/platform fee 1000000 atomic/)).toBeVisible()
  await expect(controls.getByText(/Command #/)).toBeVisible();await expect(controls.getByText("reconciled")).toBeVisible()
  await mkdir(outputDir,{recursive:true});await controls.evaluate((element)=>element.scrollIntoView({block:"start"}));await page.evaluate(()=>scrollBy(0,-120))
  await page.screenshot({path:path.join(outputDir,"desktop-1440x900.png"),fullPage:false})
  await page.setViewportSize({width:390,height:844});await page.goto(`${baseURL}/en/admin/cycles/2026-10/payouts`)
  const mobileControls=page.getByTestId("base-payout-operator-controls");await mobileControls.scrollIntoViewIfNeeded()
  await mobileControls.evaluate((element)=>element.scrollIntoView({block:"start"}));await page.evaluate(()=>scrollBy(0,-160))
  await expect(mobileControls.getByText("Base Safe payout checkpoints")).toBeVisible()
  await page.screenshot({path:path.join(outputDir,"mobile-390x844.png"),fullPage:false})
  expect(errors).toEqual([])
})
