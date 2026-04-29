import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tags, ShoppingCart, Sun, Moon, Users,
  Menu, X, UserCircle,
} from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import { api } from '@/lib/api'
import clsx from 'clsx'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/projects', label: 'Proyectos', Icon: Sun },
  { to: '/products', label: 'Productos', Icon: Package },
  { to: '/stock', label: 'Stock', Icon: Tags },
  { to: '/purchases', label: 'Compras', Icon: ShoppingCart },
  { to: '/users', label: 'Usuarios', Icon: Users, adminOnly: true },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const isAdmin = user?.is_admin === true || user?.role === 'admin'

  const onLogout = async () => {
    try { await api.post('/auth/logout/') } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform md:static md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-700">
          <Link to="/" className="flex items-center gap-2 font-semibold text-brand-600 dark:text-brand-400">
            <Sun className="h-5 w-5" /> RDS Solar
          </Link>
          <button className="md:hidden text-slate-500" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.filter(n => !n.adminOnly || isAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
              )}
            >
              <item.Icon className="h-4 w-4" /> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="md:hidden btn-ghost px-2" onClick={() => setOpen(true)} aria-label="Abrir menú">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="hidden md:block text-sm text-slate-500 dark:text-slate-400">
              Gestión de instalaciones solares
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={toggle} title="Tema" aria-label="Cambiar tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/profile" className="btn-ghost text-sm">
              <UserCircle className="h-4 w-4" /> {user?.username}
            </Link>
            <button className="btn-secondary text-sm" onClick={onLogout}>Salir</button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}
