import { describe, expect, it } from 'vitest'
import { computeProjectTotals, computePurchaseTotals } from './calc'
import type { Project, Purchase } from './types'

describe('computeProjectTotals', () => {
  it('handles empty items', () => {
    const r = computeProjectTotals({ items: [], discount_pct: '0', extra_charges: '0' } as Partial<Project>)
    expect(r).toEqual({ subtotal: 0, total: 0, costTotal: 0, profit: 0, margin: 0 })
  })

  it('computes subtotal, cost, profit and margin without discounts', () => {
    const r = computeProjectTotals({
      discount_pct: '0', extra_charges: '0',
      items: [
        { product: 1, quantity: 3, unit_price: '200', unit_cost: '100', discount_pct: '0' },
      ],
    } as Partial<Project>)
    expect(r.subtotal).toBe(600)
    expect(r.total).toBe(600)
    expect(r.costTotal).toBe(300)
    expect(r.profit).toBe(300)
    expect(r.margin).toBeCloseTo(50, 4)
  })

  it('applies line discounts before document discount and extra charges', () => {
    const r = computeProjectTotals({
      discount_pct: '10', extra_charges: '50',
      items: [
        { product: 1, quantity: 2, unit_price: '100', unit_cost: '40', discount_pct: '10' },
        { product: 2, quantity: 1, unit_price: '50', unit_cost: '20', discount_pct: '0' },
      ],
    } as Partial<Project>)
    // line1 gross 200 - 10% = 180; line2 = 50; subtotal = 230
    expect(r.subtotal).toBe(230)
    // doc discount 10% of 230 = 23; total = 230 - 23 + 50 = 257
    expect(r.total).toBe(257)
    // cost = 80 + 20 = 100
    expect(r.costTotal).toBe(100)
    expect(r.profit).toBe(157)
    expect(r.margin).toBeCloseTo((157 / 257) * 100, 4)
  })

  it('returns zero margin when total is zero', () => {
    const r = computeProjectTotals({
      discount_pct: '0', extra_charges: '0',
      items: [{ product: 1, quantity: 1, unit_price: '0', unit_cost: '10', discount_pct: '0' }],
    } as Partial<Project>)
    expect(r.total).toBe(0)
    expect(r.margin).toBe(0)
  })
})

describe('computePurchaseTotals', () => {
  it('sums items with line discounts and adds extra costs', () => {
    const r = computePurchaseTotals({
      extra_costs: '25',
      items: [
        { product: 1, quantity: 5, unit_cost: '10', discount_pct: '0' },
        { product: 2, quantity: 2, unit_cost: '20', discount_pct: '50' },
      ],
    } as Partial<Purchase>)
    // 50 + (40 - 20) = 70
    expect(r.subtotal).toBe(70)
    expect(r.total).toBe(95)
  })

  it('handles empty items', () => {
    const r = computePurchaseTotals({ items: [], extra_costs: '0' } as Partial<Purchase>)
    expect(r).toEqual({ subtotal: 0, total: 0 })
  })
})
