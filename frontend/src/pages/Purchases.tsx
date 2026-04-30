import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { api, unwrap } from '@/lib/api'
import type { Purchase } from '@/lib/types'
import { selectIsAdmin, useAuth } from '@/store/auth'
import PageHeader from '@/components/PageHeader'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', received: 'Recibida', cancelled: 'Cancelada',
}
const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function PurchasesPage() {
  const qc = useQueryClient()
  const isAdmin = useAuth(selectIsAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')

  const { data: purchases, isLoading } = useQuery<Purchase[]>({
    queryKey: ['purchases', search, status],
    queryFn: async () => unwrap((await api.get('/purchases/', {
      params: { search, status: status || undefined, page_size: 200, ordering: '-purchase_date' },
    })).data),
  })

  const del = useMutation({
    mutationFn: async (id: number) => api.delete(`/purchases/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle="Órdenes de compra a proveedores"
        actions={<Link to="/purchases/new" className="btn-primary">+ Nueva compra</Link>}
      />
      <div className="card mb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="input" placeholder="Buscar factura, proveedor…"
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="received">Recibidas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>
      <div className="card overflow-x-auto hidden md:block">
        <table className="table">
          <thead>
            <tr>
              <th>#</th><th>Fecha</th><th>Proveedor</th><th>Factura</th>
              <th>Estado</th><th>Total</th>
              <th>USD</th><th />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="py-6 text-center text-slate-400">Cargando…</td></tr>}
            {purchases?.map((p) => (
              <tr key={p.id}>
                <td className="font-mono">#{p.id}</td>
                <td>{p.purchase_date}</td>
                <td>{p.supplier_name}</td>
                <td className="font-mono">{p.invoice_number || '—'}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </td>
                <td className="text-right tabular-nums">{p.currency} {Number(p.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right tabular-nums">US$ {Number(p.total_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right whitespace-nowrap">
                  <Link to={`/purchases/${p.id}`} className="btn-ghost"
                        aria-label={isAdmin ? 'Editar compra' : 'Ver compra'}
                        title={isAdmin ? 'Editar' : 'Ver'}>
                    {isAdmin ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Link>
                  {isAdmin && (
                    <button className="btn-ghost text-red-600"
                            onClick={() => confirm(`¿Eliminar la compra #${p.id}?`) && del.mutate(p.id)}
                            aria-label="Eliminar compra" title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && !purchases?.length && (
              <tr><td colSpan={8} className="py-6 text-center text-slate-400">Sin compras registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {isLoading && <div className="list-row text-center text-slate-400 py-6">Cargando…</div>}
        {purchases?.map((p) => (
          <div key={p.id} className="list-row space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold leading-tight">{p.supplier_name}</div>
                <div className="font-mono text-xs text-slate-500">#{p.id} · {p.purchase_date}</div>
              </div>
              <span className={`badge ${STATUS_BADGE[p.status]} shrink-0`}>{STATUS_LABEL[p.status]}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <span className="text-slate-500">Factura</span>
              <span className="text-right font-mono">{p.invoice_number || '—'}</span>
              <span className="text-slate-500">Total</span>
              <span className="text-right tabular-nums">{p.currency} {Number(p.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              <span className="text-slate-500">USD</span>
              <span className="text-right tabular-nums">US$ {Number(p.total_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-end gap-1 pt-1 border-t border-slate-100 dark:border-slate-700">
              <Link to={`/purchases/${p.id}`} className="btn-ghost"
                    aria-label={isAdmin ? 'Editar compra' : 'Ver compra'}
                    title={isAdmin ? 'Editar' : 'Ver'}>
                {isAdmin ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Link>
              {isAdmin && (
                <button className="btn-ghost text-red-600"
                        onClick={() => confirm(`¿Eliminar la compra #${p.id}?`) && del.mutate(p.id)}
                        aria-label="Eliminar compra" title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && !purchases?.length && (
          <div className="list-row text-center text-slate-400 py-6">Sin compras registradas.</div>
        )}
      </div>
    </div>
  )
}
