'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { fetchFinanceCategories, fetchFinanceReports, generateFinanceReportDocument, type FinanceCategory, type FinanceReportPayload } from '../_lib/finance-api'
import { useStore } from '@/lib/store'
import { formatMoneyWithCurrencySuffix, normalizeCurrencyCode } from '@/lib/currency'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { DateTimeField } from '@/components/ui/date-time-field'
import { notify } from '@/lib/notify'
import { getApiBaseUrl } from '@/lib/api'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from 'recharts'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export default function FinanceReportsPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const [report, setReport] = useState<FinanceReportPayload | null>(null)
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [reportScope, setReportScope] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState('')
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false)
  const [sectionsDialogOpen, setSectionsDialogOpen] = useState(false)
  const [reportSections, setReportSections] = useState<string[]>([
    'summary',
    'category_breakdown',
    'monthly_trend',
    'annex_transactions',
    'annex_invoices',
    'annex_documents',
  ])
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const loadReport = async () => {
    setError(null)
    try {
      const payload = await fetchFinanceReports({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        category: category || undefined,
        document_type: documentType || undefined,
        report_scope: reportScope || undefined,
        invoice_status: invoiceStatus || undefined,
      })
      setReport(payload)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement'
      setError(msg)
      notify.error('Chargement rapport impossible', msg)
    }
  }

  useEffect(() => {
    fetchFinanceCategories().then(setCategories).catch(() => undefined)
    void loadReport()
  }, [])

  const monthlyGrouped = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; transfer: number }>()
    ;(report?.monthly || []).forEach((row) => {
      const key = row.month || 'inconnu'
      if (!map.has(key)) map.set(key, { income: 0, expense: 0, transfer: 0 })
      const current = map.get(key)!
      current[row.transaction_type] += Number(row.total || 0)
    })
    return Array.from(map.entries()).map(([month, values]) => ({ month, ...values }))
  }, [report])

  const categoryChartData = useMemo(
    () =>
      (report?.by_category || []).map((row, index) => ({
        name: row.category_name,
        total: Number(row.total || 0),
        color:
          normalizeColor(categories.find((cat) => cat.id === row.category_id)?.color) ||
          CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      })),
    [report, categories]
  )

  const monthlyChartData = useMemo(
    () =>
      monthlyGrouped.map((row) => ({
        month: row.month ? row.month.slice(0, 7) : 'N/A',
        income: row.income,
        expense: row.expense,
      })),
    [monthlyGrouped]
  )

  const exportCsv = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
    if (!token) {
      notify.error('Export impossible', 'Session expirée.')
      return
    }
    const q = new URLSearchParams()
    if (dateFrom) q.set('date_from', dateFrom)
    if (dateTo) q.set('date_to', dateTo)
    if (category) q.set('category', category)
    if (documentType) q.set('document_type', documentType)
    if (reportScope) q.set('report_scope', reportScope)
    if (invoiceStatus) q.set('invoice_status', invoiceStatus)
    const base = getApiBaseUrl()
    const url = `${base}/finance/transactions/export-csv/${q.toString() ? `?${q.toString()}` : ''}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Erreur export (${res.status})`)
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'finance-transactions.csv'
        a.click()
        URL.revokeObjectURL(a.href)
        notify.success('Export CSV lancé')
      })
      .catch((e: Error) => notify.error('Export impossible', e.message))
  }

  const applyPreset = (preset: '7d' | '30d' | 'quarter' | 'year') => {
    const now = new Date()
    const end = now.toISOString().slice(0, 10)
    const start = new Date(now)
    if (preset === '7d') start.setDate(now.getDate() - 6)
    if (preset === '30d') start.setDate(now.getDate() - 29)
    if (preset === 'quarter') start.setMonth(now.getMonth() - 2, 1)
    if (preset === 'year') start.setMonth(now.getMonth() - 11, 1)
    setDateFrom(start.toISOString().slice(0, 10))
    setDateTo(end)
  }

  const applyFilters = async () => {
    await loadReport()
    setFiltersDialogOpen(false)
  }

  const exportExcel = () => {
    if (!report) return
    const rows = [
      ['Categorie', 'Montant'],
      ...report.by_category.map((row) => [row.category_name, row.total]),
      [],
      ['Mois', 'Type', 'Montant'],
      ...report.monthly.map((row) => [row.month || '', row.transaction_type, row.total]),
    ]
    const content = rows.map((r) => r.join('\t')).join('\n')
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'finance-rapports.xls'
    a.click()
    URL.revokeObjectURL(a.href)
    notify.success('Export Excel lancé')
  }

  const exportPdf = () => {
    if (!report) return
    const w = window.open('', '_blank')
    if (!w) {
      notify.error('Export PDF impossible', 'Autorisez les popups pour continuer.')
      return
    }
    const html = `
      <html><head><title>Rapport Finance</title></head><body>
      <h2>Rapport Finance</h2>
      <p>Revenus: ${formatMoneyWithCurrencySuffix(report.summary.income_amount, tenantCurrency)}</p>
      <p>Dépenses: ${formatMoneyWithCurrencySuffix(report.summary.expense_amount, tenantCurrency)}</p>
      <p>Transferts: ${formatMoneyWithCurrencySuffix(report.summary.transfer_amount, tenantCurrency)}</p>
      <p>Cashflow net: ${formatMoneyWithCurrencySuffix(report.summary.net_cashflow, tenantCurrency)}</p>
      <hr />
      <h3>Répartition par catégorie</h3>
      <ul>${report.by_category
        .map((row) => `<li>${row.category_name}: ${formatMoneyWithCurrencySuffix(row.total, tenantCurrency)}</li>`)
        .join('')}</ul>
      </body></html>`
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  const printFinancialReport = () => {
    if (!report) return
    const popup = window.open('', '_blank')
    if (!popup) {
      notify.error('Impression impossible', 'Autorisez les popups pour continuer.')
      return
    }

    const periodLabel = `${dateFrom || 'Début'} -> ${dateTo || 'Aujourd’hui'}`
    const categoryLabel = category ? categories.find((c) => c.id === category)?.name || category : 'Toutes'
    const scopeLabel = reportScope || 'Tous'
    const docTypeLabel = documentType || 'Tous'
    const invoiceStatusLabel = invoiceStatus || 'Tous'

    const categoryRows =
      report.by_category.length === 0
        ? '<tr><td colspan="2" style="padding:8px;color:#64748b;">Aucune donnée</td></tr>'
        : report.by_category
            .map(
              (row) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(row.category_name)}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatMoneyWithCurrencySuffix(row.total, tenantCurrency))}</td>
            </tr>
          `
            )
            .join('')

    const monthlyRows =
      monthlyGrouped.length === 0
        ? '<tr><td colspan="3" style="padding:8px;color:#64748b;">Aucune donnée</td></tr>'
        : monthlyGrouped
            .map(
              (row) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(row.month || '')}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatMoneyWithCurrencySuffix(row.income, tenantCurrency))}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatMoneyWithCurrencySuffix(row.expense, tenantCurrency))}</td>
            </tr>
          `
            )
            .join('')

    const categoryPieSvg = (() => {
      const entries = (report.by_category || []).map((row) => ({
        value: Number(row.total || 0),
        color:
          normalizeColor(categories.find((cat) => cat.id === row.category_id)?.color) ||
          CATEGORY_COLORS[0],
      }))
      const total = entries.reduce((acc, it) => acc + it.value, 0)
      const w = 420
      const h = 240
      const cx = 110
      const cy = 120
      const r = 85

      const polarToCartesian = (centerX: number, centerY: number, radius: number, angleDeg: number) => {
        const rad = ((angleDeg - 90) * Math.PI) / 180.0
        return {
          x: centerX + radius * Math.cos(rad),
          y: centerY + radius * Math.sin(rad),
        }
      }

      let angle = 0
      const paths = entries
        .filter((e) => e.value > 0)
        .map((e) => {
          const slice = total > 0 ? (e.value / total) * 360 : 0
          const startAngle = angle
          const endAngle = angle + slice
          angle = endAngle

          const p1 = polarToCartesian(cx, cy, r, startAngle)
          const p2 = polarToCartesian(cx, cy, r, endAngle)
          const largeArcFlag = slice > 180 ? 1 : 0

          const d = [
            `M ${cx} ${cy}`,
            `L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
            `A ${r} ${r} 0 ${largeArcFlag} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
            'Z',
          ].join(' ')

          return `<path d="${d}" fill="${e.color}" stroke="#ffffff" stroke-width="2" />`
        })
        .join('')

      return `
        <div style="margin-top:10px;">
          <div style="font-size:12px;color:#475569;font-weight:700;margin-bottom:6px;">Graphique - Répartition par catégorie</div>
          <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
            <rect x="0" y="0" width="${w}" height="${h}" rx="12" ry="12" fill="#ffffff" stroke="#e2e8f0"/>
            ${paths}
          </svg>
        </div>
      `
    })()

    const monthlyBarSvg = (() => {
      const rows = monthlyGrouped || []
      const n = rows.length
      const w = 520
      const h = 240
      const padL = 48
      const padR = 18
      const padT = 18
      const padB = 42
      const innerW = w - padL - padR
      const innerH = h - padT - padB

      const incomes = rows.map((r) => r.income || 0)
      const expenses = rows.map((r) => r.expense || 0)
      const maxVal = Math.max(1, ...incomes, ...expenses)

      const groupW = n > 0 ? innerW / n : innerW
      const barW = Math.max(8, groupW / 3)
      const scale = innerH / maxVal

      const incomeColor = '#0F6E56'
      const expenseColor = '#B91C1C'

      const bars = rows
        .map((row, i) => {
          const x0 = padL + i * groupW + (groupW - barW * 2 - 8) / 2
          const incH = (Number(row.income || 0) || 0) * scale
          const expH = (Number(row.expense || 0) || 0) * scale

          const incX = x0
          const expX = x0 + barW + 8

          const yBase = padT + innerH
          const incY = yBase - incH
          const expY = yBase - expH

          const label = row.month ? String(row.month).slice(0, 7) : ''

          return `
            <g>
              <rect x="${incX}" y="${incY}" width="${barW}" height="${incH}" rx="4" fill="${incomeColor}" opacity="0.95" />
              <rect x="${expX}" y="${expY}" width="${barW}" height="${expH}" rx="4" fill="${expenseColor}" opacity="0.95" />
              <text x="${padL + i * groupW + groupW / 2}" y="${h - 18}" text-anchor="middle" font-size="10" fill="#475569">${label}</text>
            </g>
          `
        })
        .join('')

      const yGridLines = [0, 0.25, 0.5, 0.75, 1]
        .map((t) => {
          const y = padT + innerH - innerH * t
          return `<line x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`
        })
        .join('')

      return `
        <div style="margin-top:10px;">
          <div style="font-size:12px;color:#475569;font-weight:700;margin-bottom:6px;">Graphique - Tendance mensuelle</div>
          <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
            <rect x="0" y="0" width="${w}" height="${h}" rx="12" ry="12" fill="#ffffff" stroke="#e2e8f0"/>
            ${yGridLines}
            ${bars}
            <text x="${padL}" y="${padT + 10}" font-size="10" fill="${incomeColor}">● Revenus</text>
            <text x="${padL + 90}" y="${padT + 10}" font-size="10" fill="${expenseColor}">● Dépenses</text>
          </svg>
        </div>
      `
    })()

    popup.document.write(`
      <html>
        <head>
          <title>Rapport financier ${escapeHtml(periodLabel)}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Inter, Arial, sans-serif; margin: 0; color: #0f172a; }
            .sheet { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
            h1 { margin: 0; font-size: 22px; }
            .muted { color: #64748b; font-size: 12px; }
            .filters { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
            .cards { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .cards4 { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
            .label { color: #64748b; font-size: 11px; text-transform: uppercase; }
            .value { font-size: 14px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
            th { text-align: left; font-size: 11px; color: #475569; padding: 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
            .section { margin-top: 14px; }
            .section h2 { font-size: 15px; margin: 0 0 6px 0; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h1>Rapport financier complet</h1>
            <div class="muted">Période: ${escapeHtml(periodLabel)}</div>

            <div class="filters">
              <div class="card"><span class="label">Catégorie</span><div class="value">${escapeHtml(categoryLabel)}</div></div>
              <div class="card"><span class="label">Type de pièce</span><div class="value">${escapeHtml(docTypeLabel)}</div></div>
              <div class="card"><span class="label">Rapport cible</span><div class="value">${escapeHtml(scopeLabel)}</div></div>
              <div class="card"><span class="label">Statut facture</span><div class="value">${escapeHtml(invoiceStatusLabel)}</div></div>
            </div>

            <div class="cards4">
              <div class="card"><span class="label">Revenus</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(report.summary.income_amount, tenantCurrency))}</div></div>
              <div class="card"><span class="label">Dépenses</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(report.summary.expense_amount, tenantCurrency))}</div></div>
              <div class="card"><span class="label">Transferts</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(report.summary.transfer_amount, tenantCurrency))}</div></div>
              <div class="card"><span class="label">Cashflow net</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(report.summary.net_cashflow, tenantCurrency))}</div></div>
            </div>

            <div class="cards4">
              <div class="card"><span class="label">Facturé</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(report.invoice_summary?.billed_total || 0, tenantCurrency))}</div></div>
              <div class="card"><span class="label">Encaissements</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(report.invoice_summary?.paid_total || 0, tenantCurrency))}</div></div>
              <div class="card"><span class="label">Reste à encaisser</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(report.invoice_summary?.outstanding_total || 0, tenantCurrency))}</div></div>
              <div class="card"><span class="label">Pièces</span><div class="value">${escapeHtml(String(report.document_summary?.count || 0))}</div></div>
            </div>

            ${
              enterpriseSummary
                ? `
              <div class="cards">
                <div class="card"><span class="label">Actifs estimés</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(enterpriseSummary.estimatedAssets, tenantCurrency))}</div></div>
                <div class="card"><span class="label">Passifs estimés</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(enterpriseSummary.estimatedLiabilities, tenantCurrency))}</div></div>
                <div class="card"><span class="label">Capitaux nets estimés</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(enterpriseSummary.netEquity, tenantCurrency))}</div></div>
                <div class="card"><span class="label">Trésorerie estimée</span><div class="value">${escapeHtml(formatMoneyWithCurrencySuffix(enterpriseSummary.cashPosition, tenantCurrency))}</div></div>
              </div>
            `
                : ''
            }

            <div class="section">
              <h2>Répartition par catégorie</h2>
              ${categoryPieSvg}
              <table>
                <thead><tr><th>Catégorie</th><th style="text-align:right;">Montant</th></tr></thead>
                <tbody>${categoryRows}</tbody>
              </table>
            </div>

            <div class="section">
              <h2>Tendance mensuelle</h2>
              ${monthlyBarSvg}
              <table>
                <thead><tr><th>Mois</th><th style="text-align:right;">Revenus</th><th style="text-align:right;">Dépenses</th></tr></thead>
                <tbody>${monthlyRows}</tbody>
              </table>
            </div>
          </div>
        </body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  const toggleReportSection = (section: string, checked: boolean) => {
    setReportSections((prev) => {
      if (checked) {
        if (prev.includes(section)) return prev
        return [...prev, section]
      }
      return prev.filter((item) => item !== section)
    })
  }

  const generateGedReport = async () => {
    if (reportSections.length === 0) {
      notify.error('Sélection incomplète', 'Choisissez au moins une partie du rapport.')
      return
    }
    try {
      const result = await generateFinanceReportDocument({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        category: category || undefined,
        document_type: documentType || undefined,
        report_scope: reportScope || undefined,
        invoice_status: invoiceStatus || undefined,
        sections: reportSections,
      })
      setSectionsDialogOpen(false)
      notify.success('Rapport Word généré', `${result.document_title} enregistré dans Finance/Rapport financier`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de génération'
      notify.error('Génération du rapport impossible', msg)
    }
  }

  const enterpriseSummary = useMemo(() => {
    if (!report) {
      return null
    }
    const income = Number(report.summary.income_amount || 0)
    const expense = Number(report.summary.expense_amount || 0)
    const opening = 0
    const netResult = income - expense
    const billed = Number(report.invoice_summary?.billed_total || 0)
    const paid = Number(report.invoice_summary?.paid_total || 0)
    const receivables = Number(report.invoice_summary?.outstanding_total || 0)
    const docs = Number(report.document_summary?.total_amount || 0)
    const cashPosition = netResult + paid
    const estimatedAssets = opening + Math.max(netResult, 0) + receivables
    const estimatedLiabilities = Math.max(expense - income, 0)
    return {
      estimatedAssets,
      estimatedLiabilities,
      netEquity: estimatedAssets - estimatedLiabilities,
      turnover: billed,
      cashCollected: paid,
      receivables,
      netResult,
      cashPosition,
      documentedAmount: docs,
    }
  }, [report])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Rapports financiers</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFiltersDialogOpen(true)} className="rounded border px-3 py-1.5 text-sm sm:hidden">
            Filtres
          </button>
          <button type="button" onClick={exportCsv} className="rounded border px-3 py-1.5 text-sm">
            Export CSV
          </button>
          <button type="button" onClick={exportExcel} className="rounded border px-3 py-1.5 text-sm">
            Export Excel
          </button>
          <button type="button" onClick={exportPdf} className="rounded border px-3 py-1.5 text-sm">
            Export PDF
          </button>
          <button type="button" onClick={printFinancialReport} className="rounded border px-3 py-1.5 text-sm">
            Imprimer rapport
          </button>
          <button type="button" onClick={() => setSectionsDialogOpen(true)} className="rounded border px-3 py-1.5 text-sm">
            Générer Word (GED)
          </button>
          <Link href="/dashboard/finance" className="text-sm text-muted-foreground hover:text-foreground">
            Retour finance
          </Link>
        </div>
      </div>

      <div className="hidden gap-3 rounded-md border p-3 sm:grid md:grid-cols-3 lg:grid-cols-6">
        <DateTimeField label="Période début" value={dateFrom} onChange={setDateFrom} mode="date" />
        <DateTimeField label="Période fin" value={dateTo} onChange={setDateTo} mode="date" />
        <div className="space-y-1">
          <Label>Catégorie</Label>
          <Select value={category || 'none'} onValueChange={(v) => setCategory(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Type de pièce</Label>
          <Select value={documentType || 'none'} onValueChange={(v) => setDocumentType(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tous les types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tous</SelectItem>
              <SelectItem value="invoice">Facture</SelectItem>
              <SelectItem value="receipt">Reçu</SelectItem>
              <SelectItem value="purchase">Achat</SelectItem>
              <SelectItem value="bank_statement">Relevé bancaire</SelectItem>
              <SelectItem value="payroll">Paie</SelectItem>
              <SelectItem value="tax">Fiscal</SelectItem>
              <SelectItem value="misc">Divers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Rapport cible</Label>
          <Select value={reportScope || 'none'} onValueChange={(v) => setReportScope(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tous les scopes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tous</SelectItem>
              <SelectItem value="balance_sheet">Bilan</SelectItem>
              <SelectItem value="income_statement">Compte de résultat</SelectItem>
              <SelectItem value="cashflow">Trésorerie</SelectItem>
              <SelectItem value="tax">Fiscal</SelectItem>
              <SelectItem value="audit">Audit</SelectItem>
              <SelectItem value="misc">Divers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Statut facture</Label>
          <Select value={invoiceStatus || 'none'} onValueChange={(v) => setInvoiceStatus(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tous</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="issued">Émise</SelectItem>
              <SelectItem value="partial">Partielle</SelectItem>
              <SelectItem value="paid">Payée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={() => void applyFilters()} className="w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Appliquer filtres
          </button>
        </div>
      </div>
      <div className="hidden flex-wrap gap-2 sm:flex">
        <button type="button" onClick={() => applyPreset('7d')} className="rounded-full border px-3 py-1 text-xs">7 jours</button>
        <button type="button" onClick={() => applyPreset('30d')} className="rounded-full border px-3 py-1 text-xs">30 jours</button>
        <button type="button" onClick={() => applyPreset('quarter')} className="rounded-full border px-3 py-1 text-xs">Trimestre</button>
        <button type="button" onClick={() => applyPreset('year')} className="rounded-full border px-3 py-1 text-xs">12 mois</button>
      </div>
      <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:hidden">
          <DialogHeader>
            <DialogTitle>Filtres des rapports</DialogTitle>
            <DialogDescription>Définis la période et les dimensions à analyser.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <DateTimeField label="Période début" value={dateFrom} onChange={setDateFrom} mode="date" />
            <DateTimeField label="Période fin" value={dateTo} onChange={setDateTo} mode="date" />
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select value={category || 'none'} onValueChange={(v) => setCategory(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Toutes les catégories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type de pièce</Label>
              <Select value={documentType || 'none'} onValueChange={(v) => setDocumentType(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous</SelectItem>
                  <SelectItem value="invoice">Facture</SelectItem>
                  <SelectItem value="receipt">Reçu</SelectItem>
                  <SelectItem value="purchase">Achat</SelectItem>
                  <SelectItem value="bank_statement">Relevé bancaire</SelectItem>
                  <SelectItem value="payroll">Paie</SelectItem>
                  <SelectItem value="tax">Fiscal</SelectItem>
                  <SelectItem value="misc">Divers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rapport cible</Label>
              <Select value={reportScope || 'none'} onValueChange={(v) => setReportScope(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tous les scopes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous</SelectItem>
                  <SelectItem value="balance_sheet">Bilan</SelectItem>
                  <SelectItem value="income_statement">Compte de résultat</SelectItem>
                  <SelectItem value="cashflow">Trésorerie</SelectItem>
                  <SelectItem value="tax">Fiscal</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                  <SelectItem value="misc">Divers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Statut facture</Label>
              <Select value={invoiceStatus || 'none'} onValueChange={(v) => setInvoiceStatus(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="issued">Émise</SelectItem>
                  <SelectItem value="partial">Partielle</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => applyPreset('7d')} className="rounded-full border px-3 py-1 text-xs">7 jours</button>
              <button type="button" onClick={() => applyPreset('30d')} className="rounded-full border px-3 py-1 text-xs">30 jours</button>
              <button type="button" onClick={() => applyPreset('quarter')} className="rounded-full border px-3 py-1 text-xs">Trimestre</button>
              <button type="button" onClick={() => applyPreset('year')} className="rounded-full border px-3 py-1 text-xs">12 mois</button>
            </div>
            <button type="button" onClick={() => void applyFilters()} className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              Appliquer filtres
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={sectionsDialogOpen} onOpenChange={setSectionsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contenu du rapport détaillé</DialogTitle>
            <DialogDescription>Sélectionne les parties à inclure dans le document Word.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {REPORT_SECTION_OPTIONS.map((option) => {
              const checked = reportSections.includes(option.key)
              return (
                <label key={option.key} className="flex items-start gap-3 rounded border p-3">
                  <Checkbox checked={checked} onCheckedChange={(value) => toggleReportSection(option.key, value === true)} />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() =>
                setReportSections(REPORT_SECTION_OPTIONS.map((item) => item.key))
              }
            >
              Tout sélectionner
            </button>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setSectionsDialogOpen(false)}>
              Annuler
            </button>
            <button type="button" className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground" onClick={() => void generateGedReport()}>
              Générer
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1">
        {report ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CardStat label="Revenus" value={formatMoneyWithCurrencySuffix(report.summary.income_amount, tenantCurrency)} />
              <CardStat label="Dépenses" value={formatMoneyWithCurrencySuffix(report.summary.expense_amount, tenantCurrency)} />
              <CardStat label="Transferts" value={formatMoneyWithCurrencySuffix(report.summary.transfer_amount, tenantCurrency)} />
              <CardStat label="Cashflow net" value={formatMoneyWithCurrencySuffix(report.summary.net_cashflow, tenantCurrency)} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CardStat label="Facturé" value={formatMoneyWithCurrencySuffix(report.invoice_summary?.billed_total || 0, tenantCurrency)} />
              <CardStat label="Encaissements" value={formatMoneyWithCurrencySuffix(report.invoice_summary?.paid_total || 0, tenantCurrency)} />
              <CardStat label="Restant à encaisser" value={formatMoneyWithCurrencySuffix(report.invoice_summary?.outstanding_total || 0, tenantCurrency)} />
              <CardStat label="Pièces enregistrées" value={String(report.document_summary?.count || 0)} />
            </div>

            {enterpriseSummary ? (
              <div className="mt-3 grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
                <CardStat label="Bilan estimé (Actifs)" value={formatMoneyWithCurrencySuffix(enterpriseSummary.estimatedAssets, tenantCurrency)} />
                <CardStat label="Bilan estimé (Passifs)" value={formatMoneyWithCurrencySuffix(enterpriseSummary.estimatedLiabilities, tenantCurrency)} />
                <CardStat label="Capitaux nets estimés" value={formatMoneyWithCurrencySuffix(enterpriseSummary.netEquity, tenantCurrency)} />
                <CardStat label="Résultat net estimé" value={formatMoneyWithCurrencySuffix(enterpriseSummary.netResult, tenantCurrency)} />
                <CardStat label="Position trésorerie estimée" value={formatMoneyWithCurrencySuffix(enterpriseSummary.cashPosition, tenantCurrency)} />
                <CardStat label="Montant documenté" value={formatMoneyWithCurrencySuffix(enterpriseSummary.documentedAmount, tenantCurrency)} />
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 rounded-md border p-3">
                <p className="text-sm font-semibold">Répartition par catégorie</p>
                <ChartContainer
                  config={{
                    total: { label: 'Total', color: '#185FA5' },
                  }}
                  className="mt-3 h-52 w-full min-w-0 overflow-hidden"
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={categoryChartData}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={isMobile ? 30 : 45}
                      outerRadius={isMobile ? 56 : 75}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {categoryChartData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune catégorie à afficher.</p>
                  ) : (
                    categoryChartData.map((entry) => (
                      <div key={`legend-${entry.name}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="max-w-[140px] truncate">{entry.name}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {report.by_category.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune donnée.</p>
                  ) : (
                    report.by_category.map((row) => (
                      <div key={`${row.category_id}-${row.category_name}`} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-muted-foreground">{row.category_name}</span>
                        <span className="tabular-nums">{formatMoneyWithCurrencySuffix(row.total, tenantCurrency)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="min-w-0 rounded-md border p-3">
                <p className="text-sm font-semibold">Tendance mensuelle</p>
                <ChartContainer
                  config={{
                    income: { label: 'Revenus', color: '#0F6E56' },
                    expense: { label: 'Dépenses', color: '#B91C1C' },
                  }}
                  className="mt-3 h-56 w-full min-w-0 overflow-hidden"
                >
                  <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: isMobile ? 0 : 8, bottom: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={20} tick={{ fontSize: isMobile ? 10 : 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="income" fill="var(--color-income)" radius={4} maxBarSize={isMobile ? 18 : 28} />
                    <Bar dataKey="expense" fill="var(--color-expense)" radius={4} maxBarSize={isMobile ? 18 : 28} />
                  </BarChart>
                </ChartContainer>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0F6E56]" />
                    Revenus
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#B91C1C]" />
                    Dépenses
                  </span>
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {monthlyGrouped.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune donnée.</p>
                  ) : (
                    monthlyGrouped.map((row) => (
                      <div key={row.month} className="rounded border p-2 text-sm">
                        <p className="font-medium">{row.month}</p>
                        <p className="text-muted-foreground">In: {formatMoneyWithCurrencySuffix(row.income, tenantCurrency)}</p>
                        <p className="text-muted-foreground">Out: {formatMoneyWithCurrencySuffix(row.expense, tenantCurrency)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        )}
      </div>
    </div>
  )
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

const CATEGORY_COLORS = ['#185FA5', '#0F6E56', '#B91C1C', '#7C3AED', '#D97706', '#0E7490', '#9333EA', '#475569']

const REPORT_SECTION_OPTIONS = [
  { key: 'summary', label: 'Synthèse financière', description: 'Totaux, cashflow, indicateurs factures et pièces.' },
  { key: 'category_breakdown', label: 'Répartition par catégorie', description: 'Tableau des montants par catégorie.' },
  { key: 'monthly_trend', label: 'Tendance mensuelle', description: 'Évolution mensuelle des flux financiers.' },
  { key: 'annex_transactions', label: 'Annexe A - Transactions', description: 'Liste détaillée des opérations comptables.' },
  { key: 'annex_invoices', label: 'Annexe B - Factures et lignes', description: 'Factures et toutes leurs lignes.' },
  { key: 'annex_documents', label: 'Annexe C - Pièces comptables', description: 'Détail des pièces justificatives.' },
]

function normalizeColor(value?: string) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

