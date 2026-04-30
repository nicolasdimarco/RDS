import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { api, extractApiError, unwrap } from '@/lib/api'
import type { Client, Product, Project, ProjectItem, ProjectStatus } from '@/lib/types'
import { computeProjectTotals } from '@/lib/calc'
import { selectIsAdmin, useAuth } from '@/store/auth'
import { useIsMobile } from '@/lib/useMediaQuery'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import CurrencyPicker from '@/components/CurrencyPicker'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  quoted: 'Cotizado', approved: 'Aprobado', in_progress: 'En curso',
  completed: 'Completado', cancelled: 'Cancelado',
}

const empty: Partial<Project> = {
  name: '', client: undefined, status: 'quoted',
  date: null,
  currency: 'USD', rate_used: null,
  discount_pct: '0', extra_charges: '0', notes: '', items: [],
}

const emptyItem = (): ProjectItem => ({
  product: 0, quantity: 1, unit_price: '0', unit_cost: '0', discount_pct: '0', iva_pct: '0',
})

export default function ProjectFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = useAuth(selectIsAdmin)
  const isMobile = useIsMobile()
  const [form, setForm] = useState<Partial<Project>>({ ...empty })
  const formRef = useRef<HTMLFormElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [newClient, setNewClient] = useState<Partial<Client>>({})
  const [clientLocalError, setClientLocalError] = useState<string | null>(null)
  const clientFormRef = useRef<HTMLFormElement>(null)

  const { data: existing } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: async () => (await api.get(`/projects/${id}/`)).data,
    enabled: !!id,
  })
  useEffect(() => { if (existing) setForm(existing) }, [existing])

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => unwrap((await api.get('/clients/', { params: { page_size: 200 } })).data),
  })
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-light'],
    queryFn: async () => unwrap((await api.get('/products/', { params: { page_size: 500 } })).data),
  })
  const productMap = useMemo(() =>
    Object.fromEntries((products ?? []).map(p => [p.id, p] as const)), [products])

  const computed = useMemo(() => computeProjectTotals(form), [form])

  const save = useMutation({
    mutationFn: async () => {
      if (id) return (await api.patch(`/projects/${id}/`, form)).data
      return (await api.post('/projects/', form)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      navigate('/projects')
    },
  })

  const del = useMutation({
    mutationFn: async () => api.delete(`/projects/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      navigate('/projects')
    },
  })

  const createClient = useMutation({
    mutationFn: async (payload: Partial<Client>) =>
      (await api.post('/clients/', payload)).data as Client,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setForm(prev => ({ ...prev, client: created.id }))
      closeClientModal()
    },
  })

  const openClientModal = () => {
    setNewClient({ name: '', tax_id: '', email: '', phone: '', address: '', notes: '' })
    setClientLocalError(null)
    createClient.reset()
    setClientModalOpen(true)
  }
  const closeClientModal = () => {
    setClientModalOpen(false)
    setClientLocalError(null)
    createClient.reset()
  }

  const onSubmitClient = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!clientFormRef.current?.reportValidity()) return
    const name = (newClient.name ?? '').trim()
    if (!name) { setClientLocalError('El nombre del cliente es obligatorio.'); return }
    const email = (newClient.email ?? '').trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientLocalError('Ingresá un email válido.'); return
    }
    setClientLocalError(null)
    createClient.mutate({
      name,
      tax_id: (newClient.tax_id ?? '').trim(),
      email,
      phone: (newClient.phone ?? '').trim(),
      address: (newClient.address ?? '').trim(),
      notes: (newClient.notes ?? '').trim(),
    })
  }

  const clientErrorMsg = clientLocalError ?? (createClient.isError ? extractApiError(createClient.error) : null)

  const upd = (patch: Partial<Project>) => setForm({ ...form, ...patch })
  const updItem = (idx: number, patch: Partial<ProjectItem>) => {
    const items = [...(form.items ?? [])]
    items[idx] = { ...items[idx], ...patch }
    setForm({ ...form, items })
  }
  const addItem = () => setForm({ ...form, items: [...(form.items ?? []), emptyItem()] })
  const rmItem = (idx: number) => {
    const items = [...(form.items ?? [])]
    items.splice(idx, 1)
    setForm({ ...form, items })
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formRef.current?.reportValidity()) return
    const items = form.items ?? []
    if (!items.length) { setLocalError('Agregá al menos un item.'); return }
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.product) { setLocalError(`Item #${i + 1}: seleccioná un producto.`); return }
      if (Number(it.quantity) < 1) { setLocalError(`Item #${i + 1}: la cantidad debe ser ≥ 1.`); return }
      if (Number(it.unit_price) < 0) { setLocalError(`Item #${i + 1}: el precio no puede ser negativo.`); return }
      if (Number(it.unit_cost) < 0) { setLocalError(`Item #${i + 1}: el costo no puede ser negativo.`); return }
      const disc = Number(it.discount_pct ?? 0)
      if (disc < 0 || disc > 100) { setLocalError(`Item #${i + 1}: el descuento debe estar entre 0 y 100.`); return }
    }
    const gDisc = Number(form.discount_pct ?? 0)
    if (gDisc < 0 || gDisc > 100) { setLocalError('El descuento global debe estar entre 0 y 100.'); return }
    setLocalError(null)
    save.mutate()
  }

  const errorMsg = localError ?? (save.isError ? extractApiError(save.error) : null)

  return (
    <>
    <form ref={formRef} onSubmit={onSubmit} noValidate={false}>
      <PageHeader
        title={id ? (form.name || `Proyecto #${id}`) : 'Nuevo proyecto'}
        subtitle="Al marcar como completado se descontará el stock automáticamente."
        actions={<>
          <button type="button" className="btn-secondary" onClick={() => navigate('/projects')}>Volver</button>
          {isAdmin && id && (
            <button type="button" className="btn-secondary text-red-600" disabled={del.isPending}
                    onClick={() => confirm(`¿Eliminar el proyecto ${form.name || `#${id}`}?`) && del.mutate()}>
              {del.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </>}
      />
      {errorMsg && (
        <div role="alert" className="mb-3 border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-200">
          {errorMsg}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {id && (
              <div><label className="label">Nombre</label>
                <input className="input" value={form.name ?? ''} readOnly /></div>
            )}
            <div>
              <label className="label">Cliente</label>
              <div className="flex gap-2">
                <select className="input flex-1" required value={form.client ?? ''} onChange={(e) => upd({ client: Number(e.target.value) })}>
                  <option value="">— Seleccionar —</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {isAdmin && (
                  <button type="button" className="btn-secondary px-3" onClick={openClientModal}
                          title="Crear cliente" aria-label="Crear cliente">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div><label className="label">Estado</label>
              <select className="input" value={form.status} onChange={(e) => upd({ status: e.target.value as ProjectStatus })}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="label">Fecha</label>
              <input type="date" className="input" value={form.date ?? ''}
                     onChange={(e) => upd({ date: e.target.value || null })} /></div>
          </div>
          <CurrencyPicker
            currency={form.currency ?? 'USD'} rate={form.rate_used ?? null}
            alwaysEditable
            onChange={({ currency, rate }) => upd({ currency, rate_used: rate })} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Descuento global %</label>
              <input className="input" value={form.discount_pct ?? '0'} onChange={(e) => upd({ discount_pct: e.target.value })} /></div>
            <div><label className="label">Cargos extra ({form.currency})</label>
              <input className="input" value={form.extra_charges ?? '0'} onChange={(e) => upd({ extra_charges: e.target.value })} /></div>
          </div>
          <div><label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => upd({ notes: e.target.value })} /></div>
        </div>
        <div className="card space-y-1 text-sm h-fit">
          <h3 className="font-semibold mb-2">Resumen</h3>
          <Row label="Subtotal" value={`${form.currency} ${computed.subtotal.toFixed(2)}`} />
          <Row label="Descuento" value={`${form.currency} ${(computed.subtotal * Number(form.discount_pct ?? 0) / 100).toFixed(2)}`} />
          <Row label="Cargos extra" value={`${form.currency} ${Number(form.extra_charges ?? 0).toFixed(2)}`} />
          <Row label="Total" value={`${form.currency} ${computed.total.toFixed(2)}`} bold divider />
          <Row label="Margen" value={`${computed.margin.toFixed(1)}%`} />
          <Row label="Ganancia" value={`${form.currency} ${computed.profit.toFixed(2)}`} bold
               accent={computed.profit > 0 ? 'text-emerald-600' : ''} />
          {form.currency === 'ARS' && form.rate_used && (
            <Row label="≈ USD" value={`US$ ${(computed.total / Number(form.rate_used)).toFixed(2)}`} muted />
          )}
        </div>
      </div>

      <div className="card mt-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Items</h3>
          <button type="button" className="btn-secondary" onClick={addItem}>+ Agregar item</button>
        </div>
        {isMobile ? (
          <div className="space-y-3">
            {(form.items ?? []).map((it, idx) => {
              const gross = Number(it.unit_price) * Number(it.quantity)
              const disc = (gross * Number(it.discount_pct || 0)) / 100
              const iva = (gross * Number(it.iva_pct || 0)) / 100
              const sub = gross - disc + iva
              return (
                <div key={idx} className="list-row space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500">Item #{idx + 1}</span>
                    <button type="button" className="btn-ghost text-red-600 -my-1 -mr-1" onClick={() => rmItem(idx)} aria-label="Quitar item">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="label">Producto</label>
                    <select className="input" value={it.product || ''} required
                            onChange={(e) => {
                              const pid = Number(e.target.value)
                              const p = productMap[pid]
                              updItem(idx, {
                                product: pid,
                                unit_price: p ? String(p.sale_price || p.suggested_price || '0') : it.unit_price,
                                unit_cost: p ? String(p.cost ?? '0') : it.unit_cost,
                                iva_pct: p ? String(p.iva_pct ?? '0') : it.iva_pct,
                              })
                            }}>
                      <option value="">— Producto —</option>
                      {products?.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.brand_name ? `${p.brand_name} · ` : ''}{p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">Cant.</label>
                      <input type="number" min={1} inputMode="numeric" className="input text-right" value={it.quantity}
                             onChange={(e) => updItem(idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label">Precio</label>
                      <input inputMode="decimal" className="input text-right" value={it.unit_price}
                             onChange={(e) => updItem(idx, { unit_price: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Costo</label>
                      <input inputMode="decimal" className="input text-right" value={it.unit_cost}
                             onChange={(e) => updItem(idx, { unit_cost: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">Desc. %</label>
                      <input inputMode="decimal" className="input text-right" value={it.discount_pct}
                             onChange={(e) => updItem(idx, { discount_pct: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">IVA %</label>
                      <div className="input text-right tabular-nums bg-slate-50 dark:bg-slate-900">{Number(it.iva_pct ?? 0).toFixed(2)}%</div>
                    </div>
                    <div>
                      <label className="label">IVA</label>
                      <div className="input text-right tabular-nums bg-slate-50 dark:bg-slate-900">{iva.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500 text-sm">Subtotal</span>
                    <span className="font-semibold tabular-nums">{form.currency} {sub.toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
            {!(form.items ?? []).length && (
              <div className="text-center py-4 text-slate-400 text-sm">Agregá al menos un item.</div>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {(form.items ?? []).map((it, idx) => {
                  const gross = Number(it.unit_price) * Number(it.quantity)
                  const disc = (gross * Number(it.discount_pct || 0)) / 100
                  const iva = (gross * Number(it.iva_pct || 0)) / 100
                  const sub = gross - disc + iva
                  return (
                    <tr key={idx}>
                      <td>
                        <select className="input" value={it.product || ''} required
                                onChange={(e) => {
                                  const pid = Number(e.target.value)
                                  const p = productMap[pid]
                                  updItem(idx, {
                                    product: pid,
                                    unit_price: p ? String(p.sale_price || p.suggested_price || '0') : it.unit_price,
                                    unit_cost: p ? String(p.cost ?? '0') : it.unit_cost,
                                    iva_pct: p ? String(p.iva_pct ?? '0') : it.iva_pct,
                                  })
                                }}>
                          <option value="">— Producto —</option>
                          {products?.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.sku} · {p.brand_name ? `${p.brand_name} · ` : ''}{p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="w-20"><input type="number" min={1}
                             className="input text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             value={it.quantity}
                             onChange={(e) => updItem(idx, { quantity: Number(e.target.value) })} /></td>
                      <td className="w-28"><input className="input text-right" value={it.unit_price}
                             onChange={(e) => updItem(idx, { unit_price: e.target.value })} /></td>
                      <td className="w-28"><input className="input text-right" value={it.unit_cost}
                             onChange={(e) => updItem(idx, { unit_cost: e.target.value })} /></td>
                      <td className="w-20"><input className="input text-right" value={it.discount_pct}
                             onChange={(e) => updItem(idx, { discount_pct: e.target.value })} /></td>
                      <td className="w-20 text-right tabular-nums">{Number(it.iva_pct ?? 0).toFixed(2)}%</td>
                      <td className="w-24 text-right tabular-nums">{iva.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{sub.toFixed(2)}</td>
                      <td className="text-right"><button type="button" className="btn-ghost text-red-600" onClick={() => rmItem(idx)} aria-label="Quitar item"><X className="h-4 w-4" /></button></td>
                    </tr>
                  )
                })}
                {!(form.items ?? []).length && (
                  <tr><td colSpan={9} className="text-center py-4 text-slate-400">Agregá al menos un item.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </form>

    <Modal
      open={clientModalOpen}
      title="Nuevo cliente"
      onClose={closeClientModal}
      footer={<>
        <button type="button" className="btn-secondary" onClick={closeClientModal}>Cancelar</button>
        <button type="submit" form="client-form" className="btn-primary" disabled={createClient.isPending}>
          {createClient.isPending ? 'Guardando…' : 'Crear cliente'}
        </button>
      </>}
    >
      {clientErrorMsg && (
        <div role="alert" className="mb-3 border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-200">
          {clientErrorMsg}
        </div>
      )}
      <form id="client-form" ref={clientFormRef} className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={onSubmitClient}>
        <div className="md:col-span-2">
          <label className="label">Nombre *</label>
          <input className="input" required maxLength={200} value={newClient.name ?? ''}
                 onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Identificador fiscal</label>
          <input className="input" maxLength={64} value={newClient.tax_id ?? ''}
                 onChange={(e) => setNewClient({ ...newClient, tax_id: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={newClient.email ?? ''}
                 onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input className="input" maxLength={64} value={newClient.phone ?? ''}
                 onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Dirección</label>
          <input className="input" maxLength={255} value={newClient.address ?? ''}
                 onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notas</label>
          <textarea className="input" rows={2} value={newClient.notes ?? ''}
                    onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })} />
        </div>
      </form>
    </Modal>
    </>
  )
}

function Row({ label, value, bold, muted, accent, divider }: {
  label: string; value: string; bold?: boolean; muted?: boolean; accent?: string; divider?: boolean
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''} ${divider ? 'pt-1 border-t border-slate-200 dark:border-slate-700' : ''} ${muted ? 'text-xs text-slate-500' : ''}`}>
      <span>{label}:</span>
      <span className={`tabular-nums ${accent ?? ''}`}>{value}</span>
    </div>
  )
}
