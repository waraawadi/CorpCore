export function normalizeCurrencyCode(code?: string | null): string {
  const normalized = (code || '').trim().toUpperCase()
  if (normalized.length === 3 && /^[A-Z]{3}$/.test(normalized)) return normalized
  return 'XOF'
}

export function formatCurrencyAmount(
  value: number | string,
  currencyCode?: string | null,
  locale = 'fr-FR',
  maximumFractionDigits = 0
): string {
  const num = typeof value === 'string' ? Number(value) : value
  const code = normalizeCurrencyCode(currencyCode)
  if (!Number.isFinite(num)) return `${value} ${code}`
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits,
    }).format(num)
  } catch {
    return `${new Intl.NumberFormat(locale).format(num)} ${code}`
  }
}

/** Montant formaté (séparateurs locaux) suffixé par le code ISO devise (ex. "150 000 XOF"). */
export function formatMoneyWithCurrencySuffix(
  value: number | string,
  currencyCode?: string | null,
  locale = 'fr-FR',
  maximumFractionDigits = 0
): string {
  const code = normalizeCurrencyCode(currencyCode)
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return `${value} ${code}`
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(num)
  return `${formatted} ${code}`
}

