import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Currency, ExchangeRate } from '@/lib/types'

export default function CurrencyPicker({
  currency, rate, onChange, alwaysEditable = false,
}: {
  currency: Currency
  rate: string | null
  onChange: (next: { currency: Currency; rate: string | null }) => void
  alwaysEditable?: boolean
}) {
  const { data: liveRate } = useQuery<ExchangeRate>({
    queryKey: ['currency'],
    queryFn: async () => (await api.get('/currency/current/')).data,
    staleTime: 60_000,
  })

  // Initialize rate field from live rate when missing
  useEffect(() => {
    if (!rate && liveRate?.rate && (alwaysEditable || currency === 'ARS')) {
      onChange({ currency, rate: liveRate.rate })
    }
  }, [currency, rate, liveRate, alwaysEditable, onChange])

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="label" htmlFor="currency-picker-currency">Moneda</label>
        <select
          id="currency-picker-currency"
          className="input"
          value={currency}
          onChange={(e) => onChange({ currency: e.target.value as Currency, rate })}
        >
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="currency-picker-rate">
          Cotización USD/ARS
          {liveRate && <span className="ml-2 text-xs text-slate-400">DolarAPI: {Number(liveRate.rate).toFixed(2)}</span>}
        </label>
        <input
          id="currency-picker-rate"
          type="number"
          step="0.0001"
          className="input"
          placeholder="Auto"
          value={rate ?? ''}
          onChange={(e) => onChange({ currency, rate: e.target.value || null })}
          disabled={!alwaysEditable && currency === 'USD'}
        />
      </div>
    </div>
  )
}
