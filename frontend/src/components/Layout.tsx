import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tags, ShoppingCart, Sun, Moon, Users,
  Menu, X, UserCircle, PanelLeftClose, PanelLeftOpen,
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
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('rds-sidebar-collapsed') === '1',
  )
  useEffect(() => {
    localStorage.setItem('rds-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const touchStart = useRef<{ x: number; y: number; capturing: boolean } | null>(null)
  const [dragX, setDragX] = useState<number | null>(null)
  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (!open) return
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY, capturing: false }
  }
  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (!touchStart.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    if (!touchStart.current.capturing) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx) || dx > 0) { touchStart.current = null; return }
      touchStart.current.capturing = true
    }
    setDragX(Math.min(0, dx))
  }
  const onTouchEnd = () => {
    if (!touchStart.current?.capturing) {
      touchStart.current = null
      setDragX(null)
      return
    }
    const x = dragX ?? 0
    touchStart.current = null
    if (x < -60) setOpen(false)
    setDragX(null)
  }
  const drawerStyle: CSSProperties | undefined = dragX !== null
    ? { transform: `translateX(${dragX}px)`, transition: 'none' }
    : undefined

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
      <aside
        role="navigation"
        aria-label="Menú principal"
        aria-hidden={!open ? undefined : false}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={drawerStyle}
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-xl transform transition-transform duration-200 ease-out touch-pan-y md:static md:shadow-none md:translate-x-0 md:w-56 md:max-w-none',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'md:w-14' : 'md:w-44',
        )}>
        <div className={clsx(
          'h-16 flex items-center justify-between border-b border-slate-200 dark:border-slate-700',
          collapsed ? 'md:px-2 md:justify-center px-4' : 'px-4',
        )}>
          <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 font-semibold text-brand-600 dark:text-brand-400 min-w-0">
            <Sun className="h-5 w-5 shrink-0" />
            <span className={clsx('truncate', collapsed && 'md:hidden')}>RDS Solar</span>
          </Link>
          <button className="md:hidden text-slate-500 p-1" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-2 space-y-1">
          {NAV.filter(n => !n.adminOnly || isAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              title={item.label}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium',
                collapsed ? 'md:justify-center md:px-2 px-3' : 'px-3',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
              )}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              <span className={clsx('truncate', collapsed && 'md:hidden')}>{item.label}</span>
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
            <button className="hidden md:inline-flex btn-ghost px-2"
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                    aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
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
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
    </div>
  )
}
