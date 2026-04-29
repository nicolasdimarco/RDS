import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api'
import type { Project } from '@/lib/types'
import { selectIsAdmin, useAuth } from '@/store/auth'
import PageHeader from '@/components/PageHeader'

const STATUS_LABEL: Record<string, string> = {
  quoted: 'Cotizado', approved: 'Aprobado', in_progress: 'En curso',
  completed: 'Completado', cancelled: 'Cancelado',
}
const STATUS_BADGE: Record<string, string> = {
  quoted: 'bg-slate-200 text-slate-700',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function ProjectsPage() {
  const qc = useQueryClient()
  const isAdmin = useAuth(selectIsAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects', search, status],
    queryFn: async () => unwrap((await api.get('/projects/', {
      params: { search, status: status || undefined, page_size: 200, ordering: '-created_at' },
    })).data),
  })

  const del = useMutation({
    mutationFn: async (id: number) => api.delete(`/projects/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Cotizaciones, ventas e instalaciones"
        actions={<Link to="/projects/new" className="btn-primary">+ Nuevo proyecto</Link>}
      />
      <div className="card mb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="input" placeholder="Buscar nombre, cliente…"
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th><th>Cliente</th><th>Estado</th>
              <th className="text-right">Total</th>
              <th className="text-right">USD</th>
              <th className="text-right">Margen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="py-6 text-center text-slate-400">Cargando…</td></tr>}
            {projects?.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.client_name}</td>
                <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                <td className="text-right tabular-nums">{p.currency} {Number(p.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right tabular-nums">US$ {Number(p.total_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right tabular-nums">{Number(p.margin_pct).toFixed(1)}%</td>
                <td className="text-right whitespace-nowrap">
                  <Link to={`/projects/${p.id}`} className="btn-ghost">{isAdmin ? 'Editar' : 'Ver'}</Link>
                  {isAdmin && (
                    <button className="btn-ghost text-red-600"
                            onClick={() => confirm(`¿Eliminar el proyecto ${p.name}?`) && del.mutate(p.id)}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && !projects?.length && (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">Sin proyectos cargados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
