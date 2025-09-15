import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

describe('sitemap', () => {
  it('includes ecosystem page', () => {
    const sitemap = fs.readFileSync(path.join(process.cwd(), 'public', 'sitemap.xml'), 'utf-8')
    expect(sitemap).toMatch('/ecosystem')
  })
})
