import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KpiCard } from '@/components/dashboard/KpiCard'

describe('KpiCard', () => {
  it('MUST render title and formatted value when loaded', () => {
    const { getByText } = render(
      <KpiCard
        title="OPD Visits"
        value={1234}
        isLoading={false}
        isError={false}
      />
    )
    expect(getByText('OPD Visits')).toBeInTheDocument()
    expect(getByText('1,234')).toBeInTheDocument()
  })

  it('MUST render description when provided', () => {
    const { getByText } = render(
      <KpiCard
        title="OPD Visits"
        value={100}
        isLoading={false}
        isError={false}
        description="Today's outpatient visits"
      />
    )
    expect(getByText("Today's outpatient visits")).toBeInTheDocument()
  })

  it('MUST show skeleton placeholders when loading', () => {
    const { container } = render(
      <KpiCard
        title="Loading"
        value={null}
        isLoading={true}
        isError={false}
      />
    )
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('MUST show error message and retry button when error', async () => {
    const onRetry = vi.fn()
    const { getByText, getByRole } = render(
      <KpiCard
        title="OPD Visits"
        value={null}
        isLoading={false}
        isError={true}
        error="Connection failed"
        onRetry={onRetry}
      />
    )
    expect(getByText('Connection failed')).toBeInTheDocument()

    const retryButton = getByRole('button', { name: /ลองอีกครั้ง|retry/i })
    await userEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('MUST display zero correctly', () => {
    const { getByText } = render(
      <KpiCard
        title="ER Visits"
        value={0}
        isLoading={false}
        isError={false}
      />
    )
    expect(getByText('0')).toBeInTheDocument()
  })

  it('MUST format large numbers with locale separators', () => {
    const { getByText } = render(
      <KpiCard
        title="Patients"
        value={1000000}
        isLoading={false}
        isError={false}
      />
    )
    expect(getByText('1,000,000')).toBeInTheDocument()
  })
})
