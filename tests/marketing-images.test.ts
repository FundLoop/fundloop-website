import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("Marketing Bottom Images", () => {
  const imagesDir = path.resolve(process.cwd(), "public/images/marketing")

  it("ensures fundloop-for-all.png exists for the homepage", () => {
    const file = path.join(imagesDir, "fundloop-for-all.png")
    expect(fs.existsSync(file)).toBe(true)
  })

  it("ensures fundloop-for-projects.png exists for the /founders page", () => {
    const file = path.join(imagesDir, "fundloop-for-projects.png")
    expect(fs.existsSync(file)).toBe(true)
  })

  it("ensures fundloop-for-users.png exists for the /participation page", () => {
    const file = path.join(imagesDir, "fundloop-for-users.png")
    expect(fs.existsSync(file)).toBe(true)
  })
})
