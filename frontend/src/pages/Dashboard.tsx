import { useQuery } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell,
} from 'recharts'
import { api } from '@/lib/api'
import type { DashboardData } from '@/lib/types'
import PageHeader from '@/components/PageHeader'

const STATUS_COLORS: Record<string, string> = {
  quoted: '#94a3b8', approved: '#3b82f6', in_progress: '#f59e0b',
  completed: '#22c55e', cancelled: '#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  quoted: 'Cotizado', approved: 'Aprobado', in_progress: 'En curso',
  completed: 'Completado', cancelled: 'Cancelado',
}

function Stat({ label, value, hint, accent = 'text-slate-900' }: {
  label: string; value: string | number; hint?: string; accent?: string
}) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent} dark:text-slate-100`}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  )
}

const fmtUSD = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard/')).data,
  })

  if (isLoading || !data) return <div className="text-slate-500">Cargando…</div>

  const t = data.totals
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Métricas en USD" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="Vendido" value={fmtUSD(t.sold_usd)} accent="text-brand-600" />
        <Stat label="Costo" value={fmtUSD(t.cost_usd)} />
        <Stat label="Ganancia" value={fmtUSD(t.profit_usd)} accent="text-emerald-600" />
        <Stat label="Margen" value={`${t.margin_pct.toFixed(1)}%`} accent="text-emerald-600" />
        <Stat label="Compras" value={fmtUSD(t.purchases_usd)} accent="text-amber-600" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-5">
        <Stat label="Cobrado" value={fmtUSD(t.collected_usd)} accent="text-emerald-600" />
        <Stat label="Por cobrar" value={fmtUSD(t.receivable_usd)} accent="text-amber-600" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Productos" value={data.stock.products} />
        <Stat label="Unidades en stock" value={data.stock.units} />
        <Stat label="Stock bajo" value={data.stock.low_stock} accent="text-amber-600" />
        <Stat label="Sin stock" value={data.stock.out_of_stock} accent="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold mb-3">Ventas mensuales (USD)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.monthly_sales}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Ventas" stroke="#3f8a2f" strokeWidth={2} />
              <Line type="monotone" dataKey="profit" name="Ganancia" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Estado de proyectos</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.status_counts.map(s => ({ name: STATUS_LABEL[s.status] ?? s.status, value: s.count, key: s.status }))}
                   dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                {data.status_counts.map((s, i) => (
                  <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#a3a3a3'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold mb-3">Compras mensuales (USD)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly_purchases}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" fill="#f59e0b" name="Compras" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Top clientes (USD)</h3>
          <ul className="space-y-2 text-sm">
            {data.top_clients.length === 0 && <li className="text-slate-400">Sin datos.</li>}
            {data.top_clients.map((c) => (
              <li key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span className="font-mono">{fmtUSD(c.total_usd)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
