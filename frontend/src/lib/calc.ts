import type { Project, ProjectItem, Purchase, PurchaseItem } from './types'

export interface ProjectTotals {
  subtotal: number
  total: number
  costTotal: number
  profit: number
  margin: number
}

export function computeProjectTotals(form: Partial<Project>): ProjectTotals {
  const items = (form.items ?? []) as ProjectItem[]
  let subtotal = 0
  let costTotal = 0
  for (const it of items) {
    const gross = Number(it.unit_price) * Number(it.quantity)
    const disc = (gross * Number(it.discount_pct || 0)) / 100
    subtotal += gross - disc
    costTotal += Number(it.unit_cost) * Number(it.quantity)
  }
  const docDisc = (subtotal * Number(form.discount_pct ?? 0)) / 100
  const total = subtotal - docDisc + Number(form.extra_charges ?? 0)
  const profit = total - costTotal
  const margin = total > 0 ? (profit / total) * 100 : 0
  return { subtotal, total, costTotal, profit, margin }
}

export interface PurchaseTotals {
  subtotal: number
  total: number
}

export function computePurchaseTotals(form: Partial<Purchase>): PurchaseTotals {
  const items = (form.items ?? []) as PurchaseItem[]
  const subtotal = items.reduce((acc, it) => {
    const gross = Number(it.unit_cost) * Number(it.quantity)
    const disc = (gross * Number(it.discount_pct || 0)) / 100
    return acc + (gross - disc)
  }, 0)
  const total = subtotal + Number(form.extra_costs ?? 0)
  return { subtotal, total }
}
