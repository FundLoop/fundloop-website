import { describe, it, expect } from 'vitest'
import { isValidEmail, isValidWalletAddress } from '../lib/account-utils'

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
  })
})

describe('isValidWalletAddress', () => {
  it('accepts valid ethereum address', () => {
    const addr = '0x' + 'a'.repeat(40)
    expect(isValidWalletAddress(addr)).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidWalletAddress('0x123')).toBe(false)
    expect(isValidWalletAddress('')).toBe(false)
  })
})
