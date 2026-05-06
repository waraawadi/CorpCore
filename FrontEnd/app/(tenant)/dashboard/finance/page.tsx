'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AnimatedCreditCardIcon } from '@/components/crm-animate-icons'
import { useStore } from '@/lib/store'
import { formatMoneyWithCurrencySuffix, normalizeCurrencyCode } from '@/lib/currency'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import {
  fetchFinanceCategories,
  fetchFinanceDashboard,
  fetchFinanceReports,
  type FinanceCategory,
  type FinanceDashboardStats,
  type FinanceReportPayload,
} from './_lib/finance-api'

export default function FinanceDashboardPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const [stats, setStats] = useState<FinanceDashboardStats | null>(null)
  const [report, setReport] = useState<FinanceReportPayload | null>(null)
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [rangeLabel, setRangeLabel] = useState('30 derniers jours')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const loadDashboard = async () => {
    setError(null)
    try {
      const now = new Date()
      const end = now.toISOString().slice(0, 10)
      const start = new Date(now)
      start.setDate(now.getDate() - 29)
      const [dashboard, reportData, categoryData] = await Promise.all([
        fetchFinanceDashboard(),
        fetchFinanceReports({
          date_from: start.toISOString().slice(0, 10),
          date_to: end,
        }),
        fetchFinanceCategories(),
      ])
      setStats(dashboard)
      setReport(reportData)
      setCategories(categoryData)
      setRangeLabel('30 derniers jours')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    }
  }

  const applyRange = async (preset: '30d' | 'quarter' | 'year') => {
    setError(null)
    try {
      const now = new Date()
      const end = now.toISOString().slice(0, 10)
      const start = new Date(now)
      if (preset === '30d') {
        start.setDate(now.getDate() - 29)
        setRangeLabel('30 derniers jours')
      }
      if (preset === 'quarter') {
        start.setMonth(now.getMonth() - 2, 1)
        setRangeLabel('Trimestre glissant')
      }
      if (preset === 'year') {
        start.setMonth(now.getMonth() - 11, 1)
        setRangeLabel('12 derniers mois')
      }
      const reportData = await fetchFinanceReports({
        date_from: start.toISOString().slice(0, 10),
        date_to: end,
      })
      setReport(reportData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const categoryChartData = useMemo(
    () =>
      (report?.by_category || []).map((row, index) => ({
        name: row.category_name,
        total: Number(row.total || 0),
        categoryId: row.category_id,
        color:
          normalizeColor(categories.find((cat) => cat.id === row.category_id)?.color) ||
          CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      })),
    [report, categories]
  )

  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; transfer: number }>()
    ;(report?.monthly || []).forEach((row) => {
      const key = row.month ? row.month.slice(0, 7) : 'N/A'
      if (!map.has(key)) map.set(key, { income: 0, expense: 0, transfer: 0 })
      const current = map.get(key)!
      current[row.transaction_type] += Number(row.total || 0)
    })
    return Array.from(map.entries()).map(([month, values]) => ({
      month,
      income: values.income,
      expense: values.expense,
      transfer: values.transfer,
      net: values.income - values.expense,
    }))
  }, [report])

  const totals = useMemo(() => {
    const data = monthlyChartData.reduce(
      (acc, row) => {
        acc.income += row.income
        acc.expense += row.expense
        acc.transfer += row.transfer
        return acc
      },
      { income: 0, expense: 0, transfer: 0 }
    )
    return [
      { label: 'Revenus', value: data.income, color: '#0F6E56' },
      { label: 'Dépenses', value: data.expense, color: '#B91C1C' },
      { label: 'Transferts', value: data.transfer, color: '#185FA5' },
    ]
  }, [monthlyChartData])

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-4 md:gap-6 md:p-6">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-card to-card/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-2">
              <AnimatedCreditCardIcon className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
              <p className="text-sm text-muted-foreground">Pilotage financier, trésorerie et écritures</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/dashboard/finance/transactions" label="Nouvelle transaction" />
            <QuickLink href="/dashboard/finance/accounts" label="Nouveau compte" />
            <QuickLink href="/dashboard/finance/categories" label="Nouvelle catégorie" />
            <QuickLink href="/dashboard/finance/invoices" label="Facturation" />
            <QuickLink href="/dashboard/finance/documents" label="Pièces comptables" />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1">
        {!stats && !error ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}

        {stats ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Comptes" value={String(stats.accounts_count)} subLabel="Banques, caisses, mobiles" href="/dashboard/finance/accounts" />
            <StatCard label="Catégories" value={String(stats.categories_count)} subLabel="Revenus / dépenses" href="/dashboard/finance/categories" />
            <StatCard
              label="Cashflow net"
              value={formatMoneyWithCurrencySuffix(stats.net_cashflow, tenantCurrency)}
              subLabel={`Ouverture: ${formatMoneyWithCurrencySuffix(stats.opening_balance_total, tenantCurrency)}`}
              href="/dashboard/finance/transactions"
            />
            <StatCard
              label="Transactions"
              value={String(stats.transactions_count)}
              subLabel={`${formatMoneyWithCurrencySuffix(stats.income_amount, tenantCurrency)} in / ${formatMoneyWithCurrencySuffix(stats.expense_amount, tenantCurrency)} out`}
              href="/dashboard/finance/transactions"
            />
            </section>

            <section className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Analyse graphique</h2>
                <p className="text-xs text-muted-foreground">{rangeLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <RangeButton onClick={() => void applyRange('30d')} label="30 jours" />
                <RangeButton onClick={() => void applyRange('quarter')} label="Trimestre" />
                <RangeButton onClick={() => void applyRange('year')} label="12 mois" />
                <Link href="/dashboard/finance/reports" className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  Rapport détaillé
                </Link>
              </div>
            </div>

            {!report ? (
              <p className="mt-4 text-sm text-muted-foreground">Chargement des graphiques...</p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="min-w-0 rounded-xl border border-border/70 p-3 lg:col-span-2">
                    <p className="text-sm font-semibold">Evolution mensuelle (revenus vs dépenses)</p>
                    <ChartContainer
                      config={{
                        income: { label: 'Revenus', color: '#0F6E56' },
                        expense: { label: 'Dépenses', color: '#B91C1C' },
                      }}
                      className="mt-3 h-64 w-full min-w-0 overflow-hidden"
                    >
                      <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: isMobile ? 0 : 8, bottom: 4 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={20} tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <YAxis tickLine={false} axisLine={false} width={isMobile ? 36 : 70} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="income" fill="var(--color-income)" radius={4} maxBarSize={isMobile ? 18 : 28} />
                        <Bar dataKey="expense" fill="var(--color-expense)" radius={4} maxBarSize={isMobile ? 18 : 28} />
                      </BarChart>
                    </ChartContainer>
                  </div>

                  <div className="min-w-0 rounded-xl border border-border/70 p-3">
                    <p className="text-sm font-semibold">Répartition catégories</p>
                    <ChartContainer
                      config={{
                        total: { label: 'Total', color: '#185FA5' },
                      }}
                      className="mt-3 h-64 w-full min-w-0 overflow-hidden"
                    >
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={categoryChartData}
                          dataKey="total"
                          nameKey="name"
                          innerRadius={isMobile ? 30 : 48}
                          outerRadius={isMobile ? 56 : 82}
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 p-3">
                  <p className="text-sm font-semibold">Comparatif cumulé (période)</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {totals.map((row) => (
                      <div key={row.label} className="rounded-lg border border-border/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                        <p className="mt-2 text-lg font-semibold tabular-nums">{formatMoneyWithCurrencySuffix(row.value, tenantCurrency)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
      {label}
    </Link>
  )
}

function StatCard({ label, value, subLabel, href }: { label: string; value: string; subLabel: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>
    </Link>
  )
}

function RangeButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
      {label}
    </button>
  )
}

const CATEGORY_COLORS = ['#185FA5', '#0F6E56', '#B91C1C', '#7C3AED', '#D97706', '#0E7490', '#9333EA', '#475569']

function normalizeColor(value?: string) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

