import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Eye, Pencil, Trash2 } from 'lucide-react'
import { api, extractApiError, unwrap } from '@/lib/api'
import type { Currency, ExchangeRate, PaymentMethod, Project, ProjectPayment } from '@/lib/types'
import { selectIsAdmin, useAuth } from '@/store/auth'
import { useIsMobile } from '@/lib/useMediaQuery'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'

const today = () => new Date().toISOString().slice(0, 10)
const emptyPayment = (projectId: number): ProjectPayment => ({
  project: projectId, date: today(), amount: '0',
  currency: 'USD', method: 'cash', notes: '',
})

const fmt = (currency: string, value: string | number) =>
  `${currency} ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

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
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [viewing, setViewing] = useState<Project | null>(null)
  const [paying, setPaying] = useState<{ project: Project; payment: ProjectPayment } | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [payTotal, setPayTotal] = useState(false)

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects', search, status],
    queryFn: async () => unwrap((await api.get('/projects/', {
      params: { search, status: status || undefined, page_size: 200, ordering: '-created_at' },
    })).data),
  })

  const { data: liveRate } = useQuery<ExchangeRate>({
    queryKey: ['currency'],
    queryFn: async () => (await api.get('/currency/current/')).data,
    staleTime: 60_000,
  })

  const balanceFor = (project: Project, currency: Currency): string => {
    const balUsd = Math.max(0, Number(project.balance_usd ?? 0))
    if (currency === 'USD') return balUsd.toFixed(2)
    const rate = Number(liveRate?.rate ?? 0)
    return (rate > 0 ? balUsd * rate : balUsd).toFixed(2)
  }

  const openPayment = (project: Project) => {
    setPaymentError(null)
    setPayTotal(false)
    setPaying({ project, payment: emptyPayment(project.id) })
  }

  const closePayment = () => { setPaying(null); setPaymentError(null); setPayTotal(false) }

  const del = useMutation({
    mutationFn: async (id: number) => api.delete(`/projects/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const createPayment = useMutation({
    mutationFn: async (payload: ProjectPayment) =>
      (await api.post('/project-payments/', payload)).data as ProjectPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      closePayment()
    },
    onError: (err) => setPaymentError(extractApiError(err)),
  })

  const onSubmitPayment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!paying) return
    const amount = Number(paying.payment.amount)
    if (!amount || amount <= 0) { setPaymentError('Ingresá un monto mayor a 0.'); return }
    setPaymentError(null)
    createPayment.mutate(paying.payment)
  }

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
      <div className="card overflow-x-auto hidden md:block">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th><th>Cliente</th><th>Estado</th>
              <th>Total</th>
              <th>USD</th>
              <th>Margen</th>
              <th>Pago</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="py-6 text-center text-slate-400">Cargando…</td></tr>}
            {projects?.map((p) => {
              const pct = Math.min(100, Math.max(0, Number(p.paid_pct ?? 0)))
              return (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.client_name}</td>
                <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                <td className="text-right tabular-nums">{p.currency} {Number(p.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right tabular-nums">US$ {Number(p.total_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-right tabular-nums">{Number(p.margin_pct).toFixed(1)}%</td>
                <td className="w-40">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn-ghost" onClick={() => setViewing(p)}
                          aria-label="Ver proyecto" title="Ver">
                    <Eye className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button className="btn-ghost" onClick={() => openPayment(p)}
                            aria-label="Registrar pago" title="Registrar pago">
                      <DollarSign className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <Link to={`/projects/${p.id}`} className="btn-ghost"
                          aria-label="Editar proyecto" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  )}
                  {isAdmin && (
                    <button className="btn-ghost text-red-600"
                            onClick={() => confirm(`¿Eliminar el proyecto ${p.name}?`) && del.mutate(p.id)}
                            aria-label="Eliminar proyecto" title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            )})}
            {!isLoading && !projects?.length && (
              <tr><td colSpan={8} className="py-6 text-center text-slate-400">Sin proyectos cargados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {isLoading && <div className="list-row text-center text-slate-400 py-6">Cargando…</div>}
        {projects?.map((p) => {
          const pct = Math.min(100, Math.max(0, Number(p.paid_pct ?? 0)))
          return (
            <div key={p.id} className="list-row space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold leading-tight">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.client_name}</div>
                </div>
                <span className={`badge ${STATUS_BADGE[p.status]} shrink-0`}>{STATUS_LABEL[p.status]}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span className="text-slate-500">Total</span>
                <span className="text-right tabular-nums">{p.currency} {Number(p.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                <span className="text-slate-500">USD</span>
                <span className="text-right tabular-nums">US$ {Number(p.total_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                <span className="text-slate-500">Margen</span>
                <span className="text-right tabular-nums">{Number(p.margin_pct).toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300 w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
              <div className="flex justify-end gap-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                <button className="btn-ghost" onClick={() => setViewing(p)}
                        aria-label="Ver proyecto" title="Ver">
                  <Eye className="h-4 w-4" />
                </button>
                {isAdmin && (
                  <button className="btn-ghost" onClick={() => openPayment(p)}
                          aria-label="Registrar pago" title="Registrar pago">
                    <DollarSign className="h-4 w-4" />
                  </button>
                )}
                {isAdmin && (
                  <Link to={`/projects/${p.id}`} className="btn-ghost"
                        aria-label="Editar proyecto" title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
                {isAdmin && (
                  <button className="btn-ghost text-red-600"
                          onClick={() => confirm(`¿Eliminar el proyecto ${p.name}?`) && del.mutate(p.id)}
                          aria-label="Eliminar proyecto" title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {!isLoading && !projects?.length && (
          <div className="list-row text-center text-slate-400 py-6">Sin proyectos cargados.</div>
        )}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} wide
             title={viewing ? `Proyecto · ${viewing.name}` : 'Proyecto'}
             footer={<button className="btn-secondary" onClick={() => setViewing(null)}>Cerrar</button>}>
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><div className="label">Cliente</div><div>{viewing.client_name ?? '—'}</div></div>
              <div><div className="label">Estado</div>
                <div><span className={`badge ${STATUS_BADGE[viewing.status]}`}>{STATUS_LABEL[viewing.status]}</span></div></div>
              <div><div className="label">Fecha</div><div>{viewing.date ?? '—'}</div></div>
              <div><div className="label">Moneda</div><div>{viewing.currency}</div></div>
              <div><div className="label">Tipo de cambio</div><div>{viewing.rate_used ?? '—'}</div></div>
              <div><div className="label">Stock comprometido</div><div>{viewing.stock_committed ? 'Sí' : 'No'}</div></div>
            </div>

            {viewing.notes && (
              <div><div className="label">Notas</div>
                <div className="whitespace-pre-wrap">{viewing.notes}</div></div>
            )}

            {isMobile ? (
              <div className="space-y-2">
                {viewing.items.map((it, idx) => {
                  const ivaVal = Number(it.unit_price) * Number(it.quantity) * Number(it.iva_pct || 0) / 100
                  return (
                    <div key={it.id ?? idx} className="list-row space-y-1.5">
                      <div className="font-medium leading-tight">
                        {it.product_sku ? `${it.product_sku} · ${it.product_name}` : it.product_name ?? '—'}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-slate-500">Cantidad</span>
                        <span className="text-right tabular-nums">{it.quantity}</span>
                        <span className="text-slate-500">Precio</span>
                        <span className="text-right tabular-nums">{fmt(viewing.currency, it.unit_price)}</span>
                        <span className="text-slate-500">Costo</span>
                        <span className="text-right tabular-nums">{fmt(viewing.currency, it.unit_cost)}</span>
                        <span className="text-slate-500">Desc.</span>
                        <span className="text-right tabular-nums">{Number(it.discount_pct).toFixed(2)}%</span>
                        <span className="text-slate-500">IVA</span>
                        <span className="text-right tabular-nums">{Number(it.iva_pct ?? 0).toFixed(2)}% · {fmt(viewing.currency, ivaVal)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-semibold tabular-nums">{fmt(viewing.currency, it.line_total ?? '0')}</span>
                      </div>
                    </div>
                  )
                })}
                {!viewing.items.length && (
                  <div className="text-center py-3 text-slate-400">Sin items.</div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Precio unitario</th>
                      <th>Costo</th>
                      <th>Desc. %</th>
                      <th>IVA %</th>
                      <th>IVA</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.items.map((it, idx) => {
                      const ivaVal = Number(it.unit_price) * Number(it.quantity) * Number(it.iva_pct || 0) / 100
                      return (
                      <tr key={it.id ?? idx}>
                        <td>{it.product_sku ? `${it.product_sku} · ${it.product_name}` : it.product_name ?? '—'}</td>
                        <td className="text-right tabular-nums">{it.quantity}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{fmt(viewing.currency, it.unit_price)}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{fmt(viewing.currency, it.unit_cost)}</td>
                        <td className="text-right tabular-nums">{Number(it.discount_pct).toFixed(2)}%</td>
                        <td className="text-right tabular-nums">{Number(it.iva_pct ?? 0).toFixed(2)}%</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{fmt(viewing.currency, ivaVal)}</td>
                        <td className="text-right tabular-nums whitespace-nowrap">{fmt(viewing.currency, it.line_total ?? '0')}</td>
                      </tr>
                      )
                    })}
                    {!viewing.items.length && (
                      <tr><td colSpan={8} className="text-center py-3 text-slate-400">Sin items.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{fmt(viewing.currency, viewing.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Descuento</span><span className="tabular-nums">{Number(viewing.discount_pct).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Cargos extra</span><span className="tabular-nums">{fmt(viewing.currency, viewing.extra_charges)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{fmt(viewing.currency, viewing.total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total USD</span><span className="tabular-nums">{fmt('US$', viewing.total_usd)}</span></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Costo</span><span className="tabular-nums">{fmt(viewing.currency, viewing.cost_total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Costo USD</span><span className="tabular-nums">{fmt('US$', viewing.cost_total_usd)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Ganancia USD</span><span className="tabular-nums">{fmt('US$', viewing.profit_usd)}</span></div>
                <div className="flex justify-between font-semibold"><span>Margen</span><span className="tabular-nums">{Number(viewing.margin_pct).toFixed(1)}%</span></div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700"><span className="text-slate-500">Cobrado</span><span className="tabular-nums">{fmt('US$', viewing.paid_usd ?? '0')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Saldo</span><span className="tabular-nums">{fmt('US$', viewing.balance_usd ?? '0')}</span></div>
                <div className="flex justify-between font-semibold"><span>Pagado</span><span className="tabular-nums">{Number(viewing.paid_pct ?? 0).toFixed(1)}%</span></div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!paying} onClose={closePayment}
             title={paying ? `Registrar pago · ${paying.project.name}` : 'Registrar pago'}
             footer={<>
               <button className="btn-secondary" onClick={closePayment}>Cancelar</button>
               <button form="payment-form" type="submit" className="btn-primary" disabled={createPayment.isPending}>
                 {createPayment.isPending ? 'Guardando…' : 'Guardar'}
               </button>
             </>}>
        {paying && (
          <>
            {paymentError && (
              <div role="alert" className="mb-3 border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-200">
                {paymentError}
              </div>
            )}
            <form id="payment-form" className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={onSubmitPayment}>
              <div><label className="label">Fecha</label>
                <input type="date" className="input" required value={paying.payment.date}
                       onChange={(e) => setPaying({ ...paying, payment: { ...paying.payment, date: e.target.value } })} /></div>
              {(() => {
                const balance = balanceFor(paying.project, paying.payment.currency)
                const noBalance = Number(balance) <= 0
                return (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label" htmlFor="payment-amount">Monto</label>
                    <label className={`flex items-center gap-1 text-xs ${noBalance ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                      <input type="checkbox" checked={payTotal} disabled={noBalance}
                             onChange={(e) => {
                               const checked = e.target.checked
                               setPayTotal(checked)
                               if (checked) {
                                 setPaying({ ...paying, payment: { ...paying.payment, amount: balance } })
                               }
                             }} />
                      Pago total <span className="tabular-nums">({fmt(paying.payment.currency, balance)})</span>
                    </label>
                  </div>
                  <input id="payment-amount" className="input text-right" required value={paying.payment.amount}
                         readOnly={payTotal}
                         onChange={(e) => { setPayTotal(false); setPaying({ ...paying, payment: { ...paying.payment, amount: e.target.value } }) }} />
                </div>
                )
              })()}
              <div><label className="label">Moneda</label>
                <select className="input" value={paying.payment.currency}
                        onChange={(e) => {
                          const currency = e.target.value as Currency
                          const next = { ...paying.payment, currency }
                          if (payTotal) next.amount = balanceFor(paying.project, currency)
                          setPaying({ ...paying, payment: next })
                        }}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select></div>
              <div>
                <div className="label">Modalidad</div>
                <div className="flex items-center gap-4 pt-1">
                  {(['cash', 'transfer'] as PaymentMethod[]).map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="payment-method" value={m}
                             checked={paying.payment.method === m}
                             onChange={() => setPaying({ ...paying, payment: { ...paying.payment, method: m } })} />
                      {m === 'cash' ? 'Efectivo' : 'Transferencia'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2"><label className="label">Notas</label>
                <textarea className="input" rows={2} value={paying.payment.notes ?? ''}
                          onChange={(e) => setPaying({ ...paying, payment: { ...paying.payment, notes: e.target.value } })} /></div>
            </form>
          </>
        )}
      </Modal>
    </div>
  )
}
