import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectFormPage from './ProjectForm'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
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

const clients = [{ id: 1, name: 'Cliente Uno' }, { id: 2, name: 'Cliente Dos' }]
const products = [
  { id: 10, sku: 'PNL-300', name: 'Panel 300W', sale_price: '200', suggested_price: '180', average_cost: '140' },
]

function setupGet() {
  mockedGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/clients')) return { data: clients } as never
    if (url.startsWith('/products')) return { data: products } as never
    if (url.startsWith('/currency')) return { data: { rate: '1000', source: 'test' } } as never
    return { data: [] } as never
  })
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('option', { name: 'Cliente Uno' })).toBeInTheDocument())
  const clientSelect = screen.getByRole('option', { name: 'Cliente Uno' }).closest('select') as HTMLSelectElement
  await user.selectOptions(clientSelect, '1')
}

async function selectFirstProduct(user: ReturnType<typeof userEvent.setup>) {
  const productSelect = screen.getByRole('option', { name: /PNL-300/ }).closest('select') as HTMLSelectElement
  await user.selectOptions(productSelect, '10')
}

describe('ProjectFormPage', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    setupGet()
  })
  afterEach(() => {
    useAuth.setState({ access: null, refresh: null, user: null })
  })

  function loginAsAdmin() {
    useAuth.setState({
      access: 't', refresh: 'r',
      user: {
        id: 1, username: 'admin', email: 'a@a.com', first_name: '', last_name: '',
        role: 'admin', is_admin: true, phone: '', is_active: true, dark_mode: false,
      },
    })
  }

  it('blocks submission and shows banner when there are no items', async () => {
    const user = userEvent.setup()
    render(withProviders(<ProjectFormPage />, { route: '/projects/new' }))

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/agregá al menos un item/i)
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('posts the project with the expected payload', async () => {
    const user = userEvent.setup()
    mockedPost.mockResolvedValueOnce({ data: { id: 7 } } as never)
    render(withProviders(<ProjectFormPage />, { route: '/projects/new' }))

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /agregar item/i }))
    await selectFirstProduct(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    const [url, payload] = mockedPost.mock.calls[0]
    expect(url).toBe('/projects/')
    expect(payload).toMatchObject({
      client: 1,
      items: [expect.objectContaining({ product: 10, quantity: 1 })],
    })
  })

  it('renders the API error message when the backend rejects the payload', async () => {
    const user = userEvent.setup()
    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { client: ['client is required.'] } },
      message: 'Request failed',
    })
    render(withProviders(<ProjectFormPage />, { route: '/projects/new' }))

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /agregar item/i }))
    await selectFirstProduct(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/client is required/i)
  })

  function clientFormInputs() {
    const form = document.getElementById('client-form') as HTMLFormElement
    const inputs = form.querySelectorAll<HTMLInputElement>('input')
    return { form, name: inputs[0], taxId: inputs[1], email: inputs[2], phone: inputs[3], address: inputs[4] }
  }
  const submitClientBtn = () =>
    document.querySelector('button[type="submit"][form="client-form"]') as HTMLButtonElement

  it('opens the client modal when the admin clicks the "+" button', async () => {
    const user = userEvent.setup()
    loginAsAdmin()
    render(withProviders(<ProjectFormPage />, { route: '/projects/new' }))

    await waitFor(() => expect(screen.getByRole('option', { name: 'Cliente Uno' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /crear cliente/i }))

    expect(await screen.findByRole('heading', { name: /nuevo cliente/i })).toBeInTheDocument()
    expect(document.getElementById('client-form')).not.toBeNull()
  })

  it('blocks client creation and shows banner when the name is empty', async () => {
    const user = userEvent.setup()
    loginAsAdmin()
    render(withProviders(<ProjectFormPage />, { route: '/projects/new' }))

    await waitFor(() => expect(screen.getByRole('option', { name: 'Cliente Uno' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /crear cliente/i }))
    await screen.findByRole('heading', { name: /nuevo cliente/i })

    const { name } = clientFormInputs()
    name.removeAttribute('required')
    await user.type(name, '   ')
    await user.click(submitClientBtn())

    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre del cliente es obligatorio/i)
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('creates the client, auto-selects it and closes the modal', async () => {
    const user = userEvent.setup()
    loginAsAdmin()
    mockedPost.mockResolvedValueOnce({ data: { id: 99, name: 'Cliente Nuevo' } } as never)
    render(withProviders(<ProjectFormPage />, { route: '/projects/new' }))

    await waitFor(() => expect(screen.getByRole('option', { name: 'Cliente Uno' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /crear cliente/i }))
    await screen.findByRole('heading', { name: /nuevo cliente/i })

    const { name, taxId, email } = clientFormInputs()
    await user.type(name, 'Cliente Nuevo')
    await user.type(taxId, '20-12345678-9')
    await user.type(email, 'nuevo@cliente.com')
    mockedGet.mockImplementation(async (url: string) => {
      if (url.startsWith('/clients')) return { data: [...clients, { id: 99, name: 'Cliente Nuevo' }] } as never
      if (url.startsWith('/products')) return { data: products } as never
      if (url.startsWith('/currency')) return { data: { rate: '1000', source: 'test' } } as never
      return { data: [] } as never
    })
    await user.click(submitClientBtn())

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    const [url, payload] = mockedPost.mock.calls[0]
    expect(url).toBe('/clients/')
    expect(payload).toMatchObject({
      name: 'Cliente Nuevo',
      tax_id: '20-12345678-9',
      email: 'nuevo@cliente.com',
    })

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /nuevo cliente/i })).not.toBeInTheDocument()
    )
    await waitFor(() => {
      const select = screen.getByRole('option', { name: 'Cliente Uno' }).closest('select') as HTMLSelectElement
      expect(select.value).toBe('99')
    })
  })
})
