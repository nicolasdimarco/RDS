import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sun } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuth((s) => s.setSession)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const { data } = await api.post('/auth/login/', { username, password })
      setSession({ access: data.access, refresh: data.refresh, user: data.user })
      navigate('/')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Usuario o contraseña inválidos.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 via-white to-amber-50">
      <div className="w-full max-w-md card">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2"><Sun className="h-10 w-10 text-brand-500" /></div>
          <h1 className="text-2xl font-semibold text-slate-800">RDS Solar</h1>
          <p className="text-sm text-slate-500">Gestión de stock e instalaciones</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login-username">Usuario</label>
            <input id="login-username" className="input" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="login-password">Contraseña</label>
            <input id="login-password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
          <div className="text-center text-sm">
            <Link to="/password-reset" className="text-brand-600 hover:underline">¿Olvidaste tu contraseña?</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
