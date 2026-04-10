import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EmptyState } from '@/components/dashboard/EmptyState'

describe('EmptyState', () => {
  it('MUST render title', () => {
    const { getByText } = render(<EmptyState title="No data found" />)
    expect(getByText('No data found')).toBeInTheDocument()
  })

  it('MUST render description when provided', () => {
    const { getByText } = render(
      <EmptyState
        title="No data"
        description="Try expanding the date range."
      />
    )
    expect(getByText('Try expanding the date range.')).toBeInTheDocument()
  })

  it('MUST NOT render description when not provided', () => {
    const { container } = render(<EmptyState title="No data" />)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs.length).toBe(0)
  })

  it('MUST render action button when provided', () => {
    const { getByRole } = render(
      <EmptyState
        title="Error"
        action={<button>Retry</button>}
      />
    )
    expect(getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('MUST render custom icon when provided', () => {
    const { getByTestId } = render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="custom-icon">icon</span>}
      />
    )
    expect(getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('MUST apply custom className', () => {
    const { container } = render(
      <EmptyState title="Test" className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
