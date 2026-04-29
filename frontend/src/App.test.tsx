import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Protected, AdminOnly } from './App'
import { useAuth } from '@/store/auth'
import { withProviders } from '@/test/utils'
import type { User } from '@/lib/types'

function tree(initial: string) {
  return withProviders(
    <Routes>
      <Route path="/login" element={<div>login-page</div>} />
      <Route path="/" element={<Protected><div>home</div></Protected>} />
      <Route path="/admin" element={<AdminOnly><div>admin-page</div></AdminOnly>} />
    </Routes>,
    { route: initial },
  )
}

const adminUser: User = {
  id: 1, username: 'admin', email: '', first_name: '', last_name: '',
  role: 'admin', phone: '', is_active: true, dark_mode: false,
}
const regularUser: User = { ...adminUser, id: 2, username: 'jane', role: 'user' }

describe('Route guards', () => {
  beforeEach(() => useAuth.getState().logout())

  it('redirects unauthenticated users to /login', () => {
    render(tree('/'))
    expect(screen.getByText('login-page')).toBeInTheDocument()
  })

  it('renders protected children when authenticated', () => {
    useAuth.getState().setSession({ access: 'A', refresh: 'R', user: regularUser })
    render(tree('/'))
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('redirects non-admin users away from admin-only routes', () => {
    useAuth.getState().setSession({ access: 'A', refresh: 'R', user: regularUser })
    render(tree('/admin'))
    expect(screen.queryByText('admin-page')).not.toBeInTheDocument()
  })

  it('lets admins through admin-only routes', () => {
    useAuth.getState().setSession({ access: 'A', refresh: 'R', user: adminUser })
    render(tree('/admin'))
    expect(screen.getByText('admin-page')).toBeInTheDocument()
  })
})
