export type Currency = 'USD' | 'ARS'

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'user'
  is_admin?: boolean
  phone: string
  is_active: boolean
  dark_mode: boolean
  permissions?: string[]
}

export interface ExchangeRate {
  id: number
  rate: string
  source: string
  note: string
  fetched_at: string
}

export interface Category { id: number; name: string; description?: string }
export interface Brand { id: number; name: string }

export interface Product {
  id: number
  sku: string
  name: string
  description: string
  category: number
  category_name: string
  brand: number | null
  brand_name?: string | null
  unit: string
  min_stock: number
  stock_qty: number
  low_stock: boolean
  cost_currency: Currency
  cost: string
  last_cost: string
  average_cost: string
  suggested_margin_pct: string
  suggested_price: string
  sale_price: string
  sale_currency: Currency
  average_cost_usd: string
  sale_price_usd: string
  margin_pct: string
  is_active: boolean
  image: string | null
}

export interface Supplier { id: number; name: string; tax_id?: string; email?: string; phone?: string }
export interface Client { id: number; name: string; tax_id?: string; email?: string; phone?: string; address?: string; notes?: string }

export interface PurchaseItem {
  id?: number
  product: number
  product_sku?: string
  product_name?: string
  quantity: number
  unit_cost: string
  discount_pct: string
  line_total?: string
}

export interface Purchase {
  id: number
  supplier: number
  supplier_name?: string
  invoice_number: string
  purchase_date: string
  currency: Currency
  rate_used: string | null
  status: 'draft' | 'received' | 'cancelled'
  extra_costs: string
  total: string
  total_usd: string
  notes: string
  items: PurchaseItem[]
}

export interface ProjectItem {
  id?: number
  product: number
  product_sku?: string
  product_name?: string
  description?: string
  quantity: number
  unit_price: string
  unit_cost: string
  discount_pct: string
  line_total?: string
  line_cost_total?: string
}

export type ProjectStatus =
  | 'quoted' | 'approved' | 'in_progress' | 'completed' | 'cancelled'

export interface Project {
  id: number
  name: string
  client: number
  client_name?: string
  status: ProjectStatus
  date: string | null
  currency: Currency
  rate_used: string | null
  discount_pct: string
  extra_charges: string
  subtotal: string
  total: string
  total_usd: string
  cost_total: string
  cost_total_usd: string
  profit_usd: string
  margin_pct: string
  stock_committed: boolean
  notes: string
  items: ProjectItem[]
}

export interface StockMovement {
  id: number
  product: number
  product_sku?: string
  product_name?: string
  kind: 'purchase'|'sale'|'return_in'|'return_out'|'adjustment'|'initial'
  quantity: number
  unit_cost: string
  currency: Currency
  rate_used: string | null
  note: string
  created_at: string
}

export interface DashboardData {
  totals: { sold_usd: number; cost_usd: number; profit_usd: number; margin_pct: number; purchases_usd: number }
  status_counts: { status: string; count: number }[]
  stock: { products: number; units: number; low_stock: number; out_of_stock: number }
  monthly_sales: { month: string; total: number; profit: number; count: number }[]
  monthly_purchases: { month: string; total: number; count: number }[]
  top_products: { sku: string; name: string; qty: number }[]
  top_clients: { name: string; total_usd: number }[]
}
