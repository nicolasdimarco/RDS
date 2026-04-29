import { FormEvent, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, extractApiError, unwrap } from '@/lib/api'
import type { Brand, Category, Product } from '@/lib/types'
import { selectIsAdmin, useAuth } from '@/store/auth'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'

const empty: Partial<Product> = {
  sku: '', name: '', description: '',
  category: undefined, brand: null,
  unit: 'unidad', min_stock: 0,
  cost_currency: 'USD', cost: '0', last_cost: '0', average_cost: '0',
  suggested_margin_pct: '30', sale_price: '0', sale_currency: 'USD',
  is_active: true,
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const isAdmin = useAuth(selectIsAdmin)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const closeModal = () => { setEditing(null); setLocalError(null); save.reset() }

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products', search],
    queryFn: async () => unwrap((await api.get('/products/', { params: { search, page_size: 200 } })).data),
  })
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => unwrap((await api.get('/categories/', { params: { page_size: 200 } })).data),
  })
  const { data: brands } = useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: async () => unwrap((await api.get('/brands/', { params: { page_size: 200 } })).data),
  })

  const save = useMutation({
    mutationFn: async (p: Partial<Product>) => {
      if (p.id) return (await api.patch(`/products/${p.id}/`, p)).data
      return (await api.post('/products/', p)).data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); closeModal() },
  })
  const del = useMutation({
    mutationFn: async (id: number) => api.delete(`/products/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editing) return
    if (!formRef.current?.reportValidity()) return
    const sku = (editing.sku ?? '').trim()
    const name = (editing.name ?? '').trim()
    if (!sku) { setLocalError('El SKU es obligatorio.'); return }
    if (!name) { setLocalError('El nombre es obligatorio.'); return }
    if (!editing.category) { setLocalError('Seleccioná una categoría.'); return }
    if (Number(editing.min_stock ?? 0) < 0) { setLocalError('El stock mínimo no puede ser negativo.'); return }
    if (editing.cost === undefined || editing.cost === null || editing.cost === '') {
      setLocalError('El costo es obligatorio.'); return
    }
    if (Number(editing.cost) < 0) { setLocalError('El costo no puede ser negativo.'); return }
    if (Number(editing.sale_price ?? 0) < 0) { setLocalError('El precio de venta no puede ser negativo.'); return }
    const margin = Number(editing.suggested_margin_pct ?? 0)
    if (margin < 0 || margin > 1000) { setLocalError('El margen debe estar entre 0 y 1000.'); return }
    setLocalError(null)
    save.mutate({ ...editing, sku, name })
  }

  const errorMsg = localError ?? (save.isError ? extractApiError(save.error) : null)

  const filtered = useMemo(() => products ?? [], [products])

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo y precios"
        actions={isAdmin && (
          <button className="btn-primary" onClick={() => setEditing({ ...empty })}>+ Nuevo producto</button>
        )}
      />
      <div className="card mb-3 flex gap-2">
        <input className="input md:max-w-sm" placeholder="Buscar SKU, nombre, categoría…"
               value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th><th>Nombre</th><th>Categoría</th><th>Marca</th>
              <th className="text-right">Stock</th><th className="text-right">Costo</th>
              <th className="text-right">Precio sug.</th><th className="text-right">Precio</th>
              <th className="text-right">Margen</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="font-mono">{p.sku}</td>
                <td>{p.name} {!p.is_active && <span className="badge bg-slate-200 text-slate-600 ml-1">inactivo</span>}</td>
                <td>{p.category_name}</td>
                <td>{p.brand_name ?? '—'}</td>
                <td className={`text-right tabular-nums ${p.low_stock ? 'text-amber-600 font-semibold' : ''}`}>{p.stock_qty}</td>
                <td className="text-right tabular-nums">{p.cost_currency} {p.cost}</td>
                <td className="text-right tabular-nums">{p.cost_currency} {p.suggested_price}</td>
                <td className="text-right tabular-nums">{p.sale_currency} {p.sale_price}</td>
                <td className={`text-right tabular-nums ${Number(p.margin_pct) < 0 ? 'text-red-600 font-semibold' : ''}`}>{p.margin_pct}%</td>
                {isAdmin && (
                  <td className="text-right">
                    <button className="btn-ghost" onClick={() => setEditing(p)}>Editar</button>
                    <button className="btn-ghost text-red-600"
                            onClick={() => confirm('¿Eliminar producto?') && del.mutate(p.id)}>Eliminar</button>
                  </td>
                )}
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-6 text-slate-400">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={closeModal}
             title={editing?.id ? `Editar ${editing.sku}` : 'Nuevo producto'} wide
             footer={<>
               <button className="btn-secondary" onClick={closeModal}>Cancelar</button>
               <button form="product-form" type="submit" className="btn-primary" disabled={save.isPending}>
                 {save.isPending ? 'Guardando…' : 'Guardar'}
               </button>
             </>}>
        {editing && (
          <>
            {errorMsg && (
              <div role="alert" className="mb-3 border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-200">
                {errorMsg}
              </div>
            )}
            <ProductForm formId="product-form" formRef={formRef} onSubmit={onSubmit}
                         value={editing} onChange={setEditing} categories={categories ?? []} brands={brands ?? []} />
          </>
        )}
      </Modal>
    </div>
  )
}

function ProductForm({ formId, formRef, onSubmit, value, onChange, categories, brands }: {
  formId: string
  formRef: React.RefObject<HTMLFormElement>
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  value: Partial<Product>
  onChange: (v: Partial<Product>) => void
  categories: Category[]
  brands: Brand[]
}) {
  const upd = (patch: Partial<Product>) => onChange({ ...value, ...patch })
  const costNum = Number(value.cost ?? 0)
  const saleNum = Number(value.sale_price ?? 0)
  const liveMargin = costNum > 0 ? ((saleNum - costNum) / costNum * 100) : null
  return (
    <form id={formId} ref={formRef} className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
      <div><label className="label">SKU</label><input className="input" required value={value.sku ?? ''} onChange={(e) => upd({ sku: e.target.value })} /></div>
      <div><label className="label">Nombre</label><input className="input" required value={value.name ?? ''} onChange={(e) => upd({ name: e.target.value })} /></div>
      <div className="md:col-span-2"><label className="label">Descripción</label><textarea className="input" rows={2} value={value.description ?? ''} onChange={(e) => upd({ description: e.target.value })} /></div>
      <div><label className="label">Categoría</label>
        <select className="input" value={value.category ?? ''} onChange={(e) => upd({ category: Number(e.target.value) })} required>
          <option value="">— Seleccionar —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div><label className="label">Marca</label>
        <select className="input" value={value.brand ?? ''} onChange={(e) => upd({ brand: e.target.value ? Number(e.target.value) : null })}>
          <option value="">—</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div><label className="label">Unidad</label><input className="input" value={value.unit ?? ''} onChange={(e) => upd({ unit: e.target.value })} /></div>
      <div><label className="label">Stock mínimo</label><input className="input" type="number" min={0} value={value.min_stock ?? 0} onChange={(e) => upd({ min_stock: Number(e.target.value) })} /></div>
      <div><label className="label">Moneda costo</label>
        <select className="input" value={value.cost_currency} onChange={(e) => upd({ cost_currency: e.target.value as any })}>
          <option value="USD">USD</option><option value="ARS">ARS</option>
        </select>
      </div>
      <div><label className="label">Costo</label><input className="input" type="number" min={0} step="0.01" required value={value.cost ?? ''} onChange={(e) => upd({ cost: e.target.value })} /></div>
      <div><label className="label">Margen sugerido %</label><input className="input" type="number" min={0} max={1000} step="0.01" required value={value.suggested_margin_pct ?? '0'} onChange={(e) => upd({ suggested_margin_pct: e.target.value })} /></div>
      <div><label className="label">Precio venta</label><input className="input" type="number" min={0} step="0.01" required value={value.sale_price ?? '0'} onChange={(e) => upd({ sale_price: e.target.value })} /></div>
      <div><label className="label">Moneda venta</label>
        <select className="input" value={value.sale_currency} onChange={(e) => upd({ sale_currency: e.target.value as any })}>
          <option value="USD">USD</option><option value="ARS">ARS</option>
        </select>
      </div>
      <div className="md:col-span-2 text-sm text-slate-600 dark:text-slate-300">
        Margen de rentabilidad: <span className="font-semibold tabular-nums">{liveMargin === null ? '—' : `${liveMargin.toFixed(2)}%`}</span>
        {value.cost_currency !== value.sale_currency && (
          <span className="ml-2 text-amber-600">(monedas distintas — el cálculo definitivo se hace en USD al guardar)</span>
        )}
      </div>
      <label className="flex items-center gap-2 mt-7"><input type="checkbox" checked={value.is_active ?? true} onChange={(e) => upd({ is_active: e.target.checked })} /> Activo</label>
    </form>
  )
}
