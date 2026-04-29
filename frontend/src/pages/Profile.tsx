import { FormEvent, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import PageHeader from '@/components/PageHeader'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const { dark, toggle } = useTheme()
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    password: '',
  })
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const payload: Record<string, unknown> = { ...form }
      if (!payload.password) delete payload.password
      const { data } = await api.patch('/auth/me/', payload)
      setUser(data)
      setMsg({ kind: 'ok', text: 'Perfil actualizado.' })
      setForm({ ...form, password: '' })
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.response?.data?.detail || 'No se pudo actualizar.' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Mi perfil" subtitle={user?.username} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form className="card space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombre</label>
              <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><label className="label">Apellido</label>
              <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div><label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Teléfono</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Nueva contraseña</label>
            <input className="input" type="password" placeholder="Dejá en blanco para no cambiarla"
                   value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          {msg && <div className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</div>}
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </form>

        <div className="card space-y-3">
          <h3 className="font-semibold">Preferencias</h3>
          <div className="flex items-center justify-between">
            <span>Modo oscuro</span>
            <button className="btn-secondary" onClick={toggle}>{dark ? 'Activado' : 'Desactivado'}</button>
          </div>
          <div className="text-xs text-slate-500">
            Rol: <strong>{user?.role}</strong>
            {user?.permissions?.length ? <> · Permisos: {user.permissions.join(', ')}</> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
