import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api, extractApiError, unwrap } from '@/lib/api'
import type { Product, Purchase, PurchaseItem, Supplier } from '@/lib/types'
import { computePurchaseTotals } from '@/lib/calc'
import { selectIsAdmin, useAuth } from '@/store/auth'
import PageHeader from '@/components/PageHeader'
import CurrencyPicker from '@/components/CurrencyPicker'

const empty: Partial<Purchase> = {
  supplier: undefined, invoice_number: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  currency: 'USD', rate_used: null, status: 'draft',
  extra_costs: '0', notes: '', items: [],
}

function emptyItem(): PurchaseItem {
  return { product: 0, quantity: 1, unit_cost: '0', discount_pct: '0' }
}

export default function PurchaseFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = useAuth(selectIsAdmin)
  const [form, setForm] = useState<Partial<Purchase>>({ ...empty })
  const formRef = useRef<HTMLFormElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const { data: existing } = useQuery<Purchase>({
    queryKey: ['purchase', id],
    queryFn: async () => (await api.get(`/purchases/${id}/`)).data,
    enabled: !!id,
  })
  useEffect(() => { if (existing) setForm(existing) }, [existing])

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => unwrap((await api.get('/suppliers/', { params: { page_size: 200 } })).data),
  })
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-light'],
    queryFn: async () => unwrap((await api.get('/products/', { params: { page_size: 500 } })).data),
  })

  const productMap = useMemo(() =>
    Object.fromEntries((products ?? []).map(p => [p.id, p] as const)), [products])

  const computed = useMemo(() => computePurchaseTotals(form), [form])

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form }
      if (id) return (await api.patch(`/purchases/${id}/`, payload)).data
      return (await api.post('/purchases/', payload)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      navigate('/purchases')
    },
  })

  const del = useMutation({
    mutationFn: async () => api.delete(`/purchases/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      navigate('/purchases')
    },
  })

  const upd = (patch: Partial<Purchase>) => setForm({ ...form, ...patch })
  const updItem = (idx: number, patch: Partial<PurchaseItem>) => {
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
      if (Number(it.unit_cost) < 0) { setLocalError(`Item #${i + 1}: el costo no puede ser negativo.`); return }
      const disc = Number(it.discount_pct ?? 0)
      if (disc < 0 || disc > 100) { setLocalError(`Item #${i + 1}: el descuento debe estar entre 0 y 100.`); return }
    }
    setLocalError(null)
    save.mutate()
  }

  const errorMsg = localError ?? (save.isError ? extractApiError(save.error) : null)

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate={false}>
      <PageHeader
        title={id ? `Compra #${id}` : 'Nueva compra'}
        subtitle="Al marcar como recibida se actualizará el stock automáticamente."
        actions={<>
          <button type="button" className="btn-secondary" onClick={() => navigate('/purchases')}>Volver</button>
          {isAdmin && id && (
            <button type="button" className="btn-secondary text-red-600" disabled={del.isPending}
                    onClick={() => confirm(`¿Eliminar la compra #${id}?`) && del.mutate()}>
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
            <div>
              <label className="label">Proveedor</label>
              <select className="input" value={form.supplier ?? ''} required
                      onChange={(e) => upd({ supplier: Number(e.target.value) })}>
                <option value="">— Seleccionar —</option>
                {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">N° Factura</label>
              <input className="input" value={form.invoice_number ?? ''}
                     onChange={(e) => upd({ invoice_number: e.target.value })} /></div>
            <div><label className="label">Fecha</label>
              <input type="date" className="input" value={form.purchase_date ?? ''}
                     onChange={(e) => upd({ purchase_date: e.target.value })} /></div>
            <div><label className="label">Estado</label>
              <select className="input" value={form.status} onChange={(e) => upd({ status: e.target.value as Purchase['status'] })}>
                <option value="draft">Borrador</option>
                <option value="received">Recibida</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>
          <CurrencyPicker
            currency={form.currency ?? 'USD'}
            rate={form.rate_used ?? null}
            onChange={({ currency, rate }) => upd({ currency, rate_used: rate })}
          />
          <div><label className="label">Costos extra ({form.currency})</label>
            <input className="input" value={form.extra_costs ?? '0'}
                   onChange={(e) => upd({ extra_costs: e.target.value })} /></div>
          <div><label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes ?? ''}
                      onChange={(e) => upd({ notes: e.target.value })} /></div>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Resumen</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span>
              <span className="tabular-nums">{form.currency} {computed.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Extra:</span>
              <span className="tabular-nums">{form.currency} {Number(form.extra_costs ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Total:</span>
              <span className="tabular-nums">{form.currency} {computed.total.toFixed(2)}</span></div>
            {form.currency === 'ARS' && form.rate_used && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>≈ USD:</span>
                <span className="tabular-nums">US$ {(computed.total / Number(form.rate_used)).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Items</h3>
          <button type="button" className="btn-secondary" onClick={addItem}>+ Agregar item</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo unit.</th>
                <th>Desc. %</th>
                <th>Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(form.items ?? []).map((it, idx) => {
                const gross = Number(it.unit_cost) * Number(it.quantity)
                const disc = (gross * Number(it.discount_pct || 0)) / 100
                const sub = gross - disc
                return (
                  <tr key={idx}>
                    <td>
                      <select className="input" value={it.product || ''} required
                              onChange={(e) => {
                                const pid = Number(e.target.value)
                                const p = productMap[pid]
                                updItem(idx, { product: pid, unit_cost: p ? String(p.cost ?? '0') : it.unit_cost })
                              }}>
                        <option value="">— Producto —</option>
                        {products?.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                      </select>
                    </td>
                    <td className="w-24"><input type="number" min={1} className="input text-right" value={it.quantity}
                           onChange={(e) => updItem(idx, { quantity: Number(e.target.value) })} /></td>
                    <td className="w-32"><input className="input text-right" value={it.unit_cost}
                           onChange={(e) => updItem(idx, { unit_cost: e.target.value })} /></td>
                    <td className="w-24"><input className="input text-right" value={it.discount_pct}
                           onChange={(e) => updItem(idx, { discount_pct: e.target.value })} /></td>
                    <td className="text-right tabular-nums">{sub.toFixed(2)}</td>
                    <td className="text-right"><button type="button" className="btn-ghost text-red-600" onClick={() => rmItem(idx)} aria-label="Quitar item"><X className="h-4 w-4" /></button></td>
                  </tr>
                )
              })}
              {!(form.items ?? []).length && (
                <tr><td colSpan={6} className="text-center py-4 text-slate-400">Agregá al menos un item.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  )
}
