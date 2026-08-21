import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("Marketing Bottom Images", () => {
  const imagesDir = path.resolve(process.cwd(), "public/images/marketing")
  const pagesDir = path.resolve(process.cwd(), "app/[locale]/(public)")

  it("ensures fundloop-for-all.png exists and is wired in the homepage", () => {
    const file = path.join(imagesDir, "fundloop-for-all.png")
    expect(fs.existsSync(file)).toBe(true)

    const homePageContent = fs.readFileSync(path.join(pagesDir, "page.tsx"), "utf8")
    expect(homePageContent).toContain("/images/marketing/fundloop-for-all.png")
  })

  it("ensures fundloop-for-projects.png exists and is wired in the /founders page", () => {
    const file = path.join(imagesDir, "fundloop-for-projects.png")
    expect(fs.existsSync(file)).toBe(true)

    const foundersPageContent = fs.readFileSync(path.join(pagesDir, "founders/page.tsx"), "utf8")
    expect(foundersPageContent).toContain("/images/marketing/fundloop-for-projects.png")
  })

  it("ensures fundloop-for-users.png exists and is wired in the /participation page", () => {
    const file = path.join(imagesDir, "fundloop-for-users.png")
    expect(fs.existsSync(file)).toBe(true)

    const participationPageContent = fs.readFileSync(path.join(pagesDir, "participation/page.tsx"), "utf8")
    expect(participationPageContent).toContain("/images/marketing/fundloop-for-users.png")
  })
})
