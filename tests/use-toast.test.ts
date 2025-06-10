import { describe, it, expect } from 'vitest'
import { reducer } from '../hooks/use-toast'

const baseToast = {
  id: '1',
  title: 'Hello',
  description: 'Test',
  open: true,
}

describe('toast reducer', () => {
  it('adds a toast respecting limit', () => {
    const s1 = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: baseToast })
    expect(s1.toasts).toHaveLength(1)
    const s2 = reducer(s1, { type: 'ADD_TOAST', toast: { ...baseToast, id: '2' } })
    expect(s2.toasts).toHaveLength(1)
    expect(s2.toasts[0].id).toBe('2')
  })

  it('updates an existing toast', () => {
    const state = { toasts: [baseToast] }
    const updated = reducer(state, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'Updated' } })
    expect(updated.toasts[0].title).toBe('Updated')
  })

  it('dismisses a specific toast', () => {
    const state = { toasts: [baseToast, { ...baseToast, id: '2' }] }
    const dismissed = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' })
    const t1 = dismissed.toasts.find(t => t.id === '1')
    const t2 = dismissed.toasts.find(t => t.id === '2')
    expect(t1?.open).toBe(false)
    expect(t2?.open).toBe(true)
  })

  it('dismisses all toasts when no id', () => {
    const state = { toasts: [baseToast, { ...baseToast, id: '2' }] }
    const dismissed = reducer(state, { type: 'DISMISS_TOAST' })
    expect(dismissed.toasts.every(t => !t.open)).toBe(true)
  })

  it('removes a toast', () => {
    const state = { toasts: [baseToast, { ...baseToast, id: '2' }] }
    const removed = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' })
    expect(removed.toasts).toHaveLength(1)
    expect(removed.toasts[0].id).toBe('2')
  })
})
