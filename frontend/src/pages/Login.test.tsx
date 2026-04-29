import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './Login'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { withProviders } from '@/test/utils'

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
  unwrap: <T,>(x: unknown): T[] => (Array.isArray(x) ? x : [x as T]),
}))

const mockedPost = vi.mocked(api.post)

describe('LoginPage', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    useAuth.getState().logout()
  })

  it('submits credentials and stores session on success', async () => {
    const user = userEvent.setup()
    mockedPost.mockResolvedValueOnce({
      data: {
        access: 'A', refresh: 'R',
        user: { id: 1, username: 'admin', role: 'admin', email: '', first_name: '', last_name: '', phone: '', is_active: true, dark_mode: false },
      },
    } as never)

    render(withProviders(<LoginPage />))
    await user.type(screen.getByLabelText(/usuario/i), 'admin')
    await user.type(screen.getByLabelText(/contraseña/i), 'admin1234')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/auth/login/', { username: 'admin', password: 'admin1234' }))
    await waitFor(() => expect(useAuth.getState().access).toBe('A'))
    expect(useAuth.getState().user?.username).toBe('admin')
  })

  it('shows the API error message when login fails', async () => {
    const user = userEvent.setup()
    mockedPost.mockRejectedValueOnce({ response: { data: { detail: 'Credenciales inválidas' } } })

    render(withProviders(<LoginPage />))
    await user.type(screen.getByLabelText(/usuario/i), 'x')
    await user.type(screen.getByLabelText(/contraseña/i), 'y')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText(/credenciales inválidas/i)).toBeInTheDocument()
    expect(useAuth.getState().access).toBeNull()
  })
})
