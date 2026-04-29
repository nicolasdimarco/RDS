import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CurrencyPicker from './CurrencyPicker'
import { api } from '@/lib/api'
import { withProviders } from '@/test/utils'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  unwrap: <T,>(x: unknown): T[] => (Array.isArray(x) ? x : [x as T]),
}))

const mockedGet = vi.mocked(api.get)

describe('CurrencyPicker', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockResolvedValue({
      data: { id: 1, rate: '1234.5', source: 'dolarapi', note: '', fetched_at: '' },
    } as never)
  })

  it('shows DolarAPI live rate as a hint', async () => {
    render(withProviders(<CurrencyPicker currency="USD" rate={null} onChange={() => {}} />))
    expect(await screen.findByText(/DolarAPI:\s*1234\.50/i)).toBeInTheDocument()
  })

  it('disables rate input when currency is USD', () => {
    render(withProviders(<CurrencyPicker currency="USD" rate={null} onChange={() => {}} />))
    const rateInput = screen.getByPlaceholderText(/auto/i) as HTMLInputElement
    expect(rateInput).toBeDisabled()
  })

  it('auto-fills rate from live rate when switched to ARS without rate', async () => {
    const onChange = vi.fn()
    render(withProviders(<CurrencyPicker currency="ARS" rate={null} onChange={onChange} />))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ currency: 'ARS', rate: '1234.5' }))
  })

  it('emits new currency when select changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(withProviders(<CurrencyPicker currency="USD" rate={null} onChange={onChange} />))
    await user.selectOptions(screen.getByLabelText(/moneda/i), 'ARS')
    expect(onChange).toHaveBeenCalledWith({ currency: 'ARS', rate: null })
  })
})
