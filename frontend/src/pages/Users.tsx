import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Minus } from 'lucide-react'
import { api, unwrap } from '@/lib/api'
import type { User } from '@/lib/types'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'

const empty: Partial<User> & { password?: string } = {
  username: '', email: '', first_name: '', last_name: '',
  role: 'user', phone: '', is_active: true, password: '',
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<(Partial<User> & { password?: string }) | null>(null)

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => unwrap((await api.get('/users/', { params: { page_size: 200 } })).data),
  })

  const save = useMutation({
    mutationFn: async (u: Partial<User> & { password?: string }) => {
      const payload: Record<string, unknown> = { ...u }
      if (!payload.password) delete payload.password
      if (u.id) return (await api.patch(`/users/${u.id}/`, payload)).data
      return (await api.post('/users/', payload)).data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditing(null) },
  })
  const del = useMutation({
    mutationFn: async (id: number) => api.delete(`/users/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Administración de cuentas y roles"
        actions={<button className="btn-primary" onClick={() => setEditing({ ...empty })}>+ Nuevo usuario</button>}
      />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Usuario</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th /></tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="font-mono">{u.username}</td>
                <td>{u.first_name} {u.last_name}</td>
                <td>{u.email}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-700'}`}>
                  {u.role === 'admin' ? 'Administrador' : 'Usuario'}</span></td>
                <td>{u.is_active ? <Check className="h-4 w-4 text-emerald-600" /> : <Minus className="h-4 w-4 text-slate-400" />}</td>
                <td className="text-right">
                  <button className="btn-ghost" onClick={() => setEditing({ ...u, password: '' })}>Editar</button>
                  {u.is_active && (
                    <button className="btn-ghost text-red-600"
                            onClick={() => confirm(`¿Desactivar ${u.username}?`) && del.mutate(u.id)}>Desactivar</button>
                  )}
                </td>
              </tr>
            ))}
            {!users?.length && <tr><td colSpan={6} className="py-6 text-center text-slate-400">Sin usuarios.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)}
             title={editing?.id ? `Editar ${editing.username}` : 'Nuevo usuario'}
             footer={<>
               <button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
               <button className="btn-primary" disabled={save.isPending}
                       onClick={() => editing && save.mutate(editing)}>
                 {save.isPending ? 'Guardando…' : 'Guardar'}
               </button>
             </>}>
        {editing && (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={(e) => e.preventDefault()}>
            <div><label className="label">Usuario</label>
              <input className="input" required value={editing.username ?? ''}
                     onChange={(e) => setEditing({ ...editing, username: e.target.value })} disabled={!!editing.id} /></div>
            <div><label className="label">Email</label>
              <input className="input" type="email" value={editing.email ?? ''}
                     onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><label className="label">Nombre</label>
              <input className="input" value={editing.first_name ?? ''}
                     onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></div>
            <div><label className="label">Apellido</label>
              <input className="input" value={editing.last_name ?? ''}
                     onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></div>
            <div><label className="label">Teléfono</label>
              <input className="input" value={editing.phone ?? ''}
                     onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label className="label">Rol</label>
              <select className="input" value={editing.role ?? 'user'}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value as User['role'] })}>
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">{editing.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
              <input className="input" type="password" value={editing.password ?? ''}
                     onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
            </div>
            <label className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={editing.is_active ?? true}
                     onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Activo
            </label>
          </form>
        )}
      </Modal>
    </div>
  )
}
