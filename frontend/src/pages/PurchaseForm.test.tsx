import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PurchaseFormPage from './PurchaseForm'
import { api } from '@/lib/api'
import { withProviders } from '@/test/utils'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)

const suppliers = [{ id: 1, name: 'ACME' }, { id: 2, name: 'Globex' }]
const products = [
  { id: 10, sku: 'PNL-300', name: 'Panel 300W', last_cost: '150', average_cost: '140' },
  { id: 11, sku: 'INV-5K', name: 'Inversor 5kW', last_cost: '800', average_cost: '780' },
]

function setupGet() {
  mockedGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/suppliers')) return { data: suppliers } as never
    if (url.startsWith('/products')) return { data: products } as never
    if (url.startsWith('/currency')) return { data: { rate: '1000', source: 'test' } } as never
    return { data: [] } as never
  })
}

describe('PurchaseFormPage', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    setupGet()
  })

  async function selectSupplier(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => expect(screen.getByRole('option', { name: 'ACME' })).toBeInTheDocument())
    const supplierSelect = screen.getByRole('option', { name: 'ACME' }).closest('select') as HTMLSelectElement
    await user.selectOptions(supplierSelect, '1')
  }

  async function selectFirstProduct(user: ReturnType<typeof userEvent.setup>) {
    const productSelect = screen.getByRole('option', { name: /PNL-300/ }).closest('select') as HTMLSelectElement
    await user.selectOptions(productSelect, '10')
  }

  it('blocks submission and shows banner when there are no items', async () => {
    const user = userEvent.setup()
    render(withProviders(<PurchaseFormPage />, { route: '/purchases/new' }))

    await selectSupplier(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/agregá al menos un item/i)
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('posts the purchase with selected supplier and item', async () => {
    const user = userEvent.setup()
    mockedPost.mockResolvedValueOnce({ data: { id: 99 } } as never)
    render(withProviders(<PurchaseFormPage />, { route: '/purchases/new' }))

    await selectSupplier(user)
    await user.click(screen.getByRole('button', { name: /agregar item/i }))
    await selectFirstProduct(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    const [url, payload] = mockedPost.mock.calls[0]
    expect(url).toBe('/purchases/')
    expect(payload).toMatchObject({ supplier: 1, items: [expect.objectContaining({ product: 10, quantity: 1 })] })
  })

  it('renders the API error message when the backend rejects the payload', async () => {
    const user = userEvent.setup()
    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { items: [{ product: ['Producto requerido'] }] } },
      message: 'Request failed',
    })
    render(withProviders(<PurchaseFormPage />, { route: '/purchases/new' }))

    await selectSupplier(user)
    await user.click(screen.getByRole('button', { name: /agregar item/i }))
    await selectFirstProduct(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/producto requerido/i)
  })
})
