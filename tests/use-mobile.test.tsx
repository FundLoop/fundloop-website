import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { useIsMobile } from '../hooks/use-mobile'

const setupMatchMedia = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  const mql = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matches: width < 768,
  }
  vi.spyOn(window, 'matchMedia').mockReturnValue(mql as any)
  return mql
}

describe('useIsMobile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when width is less than 768', () => {
    setupMatchMedia(500)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false when width is at least 768', () => {
    setupMatchMedia(800)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('cleans up listener on unmount', () => {
    const mql = setupMatchMedia(500)
    const { unmount } = renderHook(() => useIsMobile())
    expect(mql.addEventListener).toHaveBeenCalled()
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalled()
  })
})
