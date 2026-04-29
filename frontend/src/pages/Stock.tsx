import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api'
import type { Product, StockMovement } from '@/lib/types'
import { selectIsAdmin, useAuth } from '@/store/auth'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'

interface Summary { total_products: number; total_units: number; low_stock: number; out_of_stock: number }

const KIND_LABEL: Record<string, string> = {
  purchase: 'Compra', sale: 'Venta', return_in: 'Devolución entrada',
  return_out: 'Devolución salida', adjustment: 'Ajuste', initial: 'Inicial',
}

export default function StockPage() {
  const qc = useQueryClient()
  const isAdmin = useAuth(selectIsAdmin)
  const [adjusting, setAdjusting] = useState<{ product: number | ''; quantity: number; note: string } | null>(null)

  const { data: summary } = useQuery<Summary>({
    queryKey: ['stock-summary'],
    queryFn: async () => (await api.get('/stock/summary/')).data,
  })
  const { data: low } = useQuery<Product[]>({
    queryKey: ['stock-low'],
    queryFn: async () => (await api.get('/stock/low/')).data,
  })
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-light'],
    queryFn: async () => unwrap((await api.get('/products/', { params: { page_size: 500 } })).data),
  })
  const { data: movements } = useQuery<StockMovement[]>({
    queryKey: ['movements'],
    queryFn: async () => unwrap((await api.get('/stock-movements/', {
      params: { page_size: 50, ordering: '-created_at' },
    })).data),
  })

  const adjust = useMutation({
    mutationFn: async (data: { product: number; quantity: number; note: string }) =>
      api.post('/stock-movements/', {
        product: data.product, kind: 'adjustment',
        quantity: data.quantity, note: data.note, currency: 'USD', unit_cost: '0',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      qc.invalidateQueries({ queryKey: ['stock-low'] })
      qc.invalidateQueries({ queryKey: ['products-light'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setAdjusting(null)
    },
  })

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle="Niveles e historial de movimientos"
        actions={isAdmin && (
          <button className="btn-primary" onClick={() => setAdjusting({ product: '', quantity: 0, note: '' })}>
            + Ajuste manual
          </button>
        )}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Productos" value={summary?.total_products ?? '—'} />
        <Stat label="Unidades" value={summary?.total_units ?? '—'} />
        <Stat label="Stock bajo" value={summary?.low_stock ?? '—'} accent="text-amber-600" />
        <Stat label="Sin stock" value={summary?.out_of_stock ?? '—'} accent="text-red-600" />
      </div>

      <div className="space-y-4">
        <div className="card overflow-x-auto">
          <h3 className="font-semibold mb-3">Productos con stock bajo</h3>
          <table className="table">
            <thead><tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Mín.</th></tr></thead>
            <tbody>
              {low?.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono">{p.sku}</td>
                  <td>{p.name}</td>
                  <td className="text-right tabular-nums text-amber-600 font-semibold">{p.stock_qty}</td>
                  <td className="text-right tabular-nums">{p.min_stock}</td>
                </tr>
              ))}
              {!low?.length && <tr><td colSpan={4} className="text-center py-4 text-slate-400">Sin alertas.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto">
          <h3 className="font-semibold mb-3">Últimos movimientos</h3>
          <table className="table">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Nota</th></tr></thead>
            <tbody>
              {movements?.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{m.created_at.replace('T', ' ').slice(0, 16)}</td>
                  <td className="text-xs">{m.product_sku} · {m.product_name}</td>
                  <td className="text-xs">{KIND_LABEL[m.kind] ?? m.kind}</td>
                  <td className={`text-right tabular-nums ${m.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </td>
                  <td className="text-xs text-slate-500">{m.note}</td>
                </tr>
              ))}
              {!movements?.length && <tr><td colSpan={5} className="text-center py-4 text-slate-400">Sin movimientos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title="Ajuste manual de stock"
             footer={<>
               <button className="btn-secondary" onClick={() => setAdjusting(null)}>Cancelar</button>
               <button className="btn-primary" disabled={adjust.isPending}
                       onClick={() => adjusting && adjusting.product && adjusting.quantity !== 0 &&
                         adjust.mutate({ product: Number(adjusting.product), quantity: adjusting.quantity, note: adjusting.note })}>
                 {adjust.isPending ? 'Aplicando…' : 'Aplicar ajuste'}
               </button>
             </>}>
        {adjusting && (
          <div className="space-y-3">
            <div>
              <label className="label">Producto</label>
              <select className="input" value={adjusting.product}
                      onChange={(e) => setAdjusting({ ...adjusting, product: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">— Seleccionar —</option>
                {products?.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name} (actual: {p.stock_qty})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cantidad (+ ingresa, − egresa)</label>
              <input type="number" className="input" value={adjusting.quantity}
                     onChange={(e) => setAdjusting({ ...adjusting, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Motivo</label>
              <input className="input" value={adjusting.note}
                     onChange={(e) => setAdjusting({ ...adjusting, note: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Stat({ label, value, accent = 'text-slate-900' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent} dark:text-slate-100`}>{value}</div>
    </div>
  )
}
