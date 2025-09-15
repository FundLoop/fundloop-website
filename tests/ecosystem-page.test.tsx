import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import EcosystemPage, { metadata } from '../app/ecosystem/page'

describe('EcosystemPage', () => {
  it('renders ecosystem heading and sites', () => {
    render(<EcosystemPage />)
    expect(screen.getByRole('heading', { name: /Our Ecosystem/i })).toBeDefined()
    expect(screen.getByText('ChainCrew')).toBeDefined()
  })

  it('exports correct metadata', () => {
    expect(metadata).toMatchObject({
      title: 'Our Ecosystem',
      description: 'Explore our interconnected projects across identity, payments, coordination, and regenerative economies.',
      openGraph: {
        title: 'Our Ecosystem',
        description: 'Explore our interconnected projects across identity, payments, coordination, and regenerative economies.',
        type: 'website',
        url: 'https://fundloop.org/ecosystem',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Our Ecosystem',
        description: 'Explore our interconnected projects across identity, payments, coordination, and regenerative economies.',
      },
      alternates: {
        canonical: 'https://fundloop.org/ecosystem',
      },
    })
  })
})
