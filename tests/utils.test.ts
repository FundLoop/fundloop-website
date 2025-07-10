import { describe, it, expect } from 'vitest'
import { cn } from '../lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignores falsy values', () => {
    expect(cn('a', 0 && 'b', null, undefined, '', 'c')).toBe('a c')
  })
})
