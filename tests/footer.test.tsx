import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Footer from '@/components/footer'

describe('Footer', () => {
  it('links to ecosystem page', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: /ecosystem/i })
    expect(link.getAttribute('href')).toBe('/ecosystem')
  })
})
