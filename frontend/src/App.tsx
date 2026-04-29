import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { selectIsAdmin, useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/Login'
import PasswordResetPage from '@/pages/PasswordReset'

const DashboardPage = lazy(() => import('@/pages/Dashboard'))
const ProductsPage = lazy(() => import('@/pages/Products'))
const PurchasesPage = lazy(() => import('@/pages/Purchases'))
const PurchaseFormPage = lazy(() => import('@/pages/PurchaseForm'))
const ProjectsPage = lazy(() => import('@/pages/Projects'))
const ProjectFormPage = lazy(() => import('@/pages/ProjectForm'))
const StockPage = lazy(() => import('@/pages/Stock'))
const UsersPage = lazy(() => import('@/pages/Users'))
const ProfilePage = lazy(() => import('@/pages/Profile'))

export function Protected({ children }: { children: React.ReactNode }) {
  const access = useAuth((s) => s.access)
  if (!access) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuth(selectIsAdmin)
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function PageFallback() {
  return <div className="p-6 text-slate-500 dark:text-slate-400">Cargando…</div>
}

export default function App() {
  const apply = useTheme((s) => s.apply)
  useEffect(() => { apply() }, [apply])

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="purchases/new" element={<PurchaseFormPage />} />
          <Route path="purchases/:id" element={<PurchaseFormPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<ProjectFormPage />} />
          <Route path="projects/:id" element={<ProjectFormPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="users" element={<AdminOnly><UsersPage /></AdminOnly>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
