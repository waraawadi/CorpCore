'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LayoutGridIcon } from '@animateicons/react/lucide'
import { fetchCrmDashboard, type CrmDashboardStats } from './_lib/crm-api'
import { useStore } from '@/lib/store'
import { formatMoneyWithCurrencySuffix } from '@/lib/currency'

export default function CrmDashboardPage() {
  const { tenant } = useStore()
  const [stats, setStats] = useState<CrmDashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = () =>
      fetchCrmDashboard()
        .then(setStats)
        .catch((e: Error) => setError(e.message))
    load()
    const id = window.setInterval(load, 15000)
    return () => window.clearInterval(id)
  }, [])

  const leadsBreakdown = stats ? buildOrderedBreakdown(stats.leads_by_status, LEAD_STATUS_LABELS) : []
  const opportunitiesBreakdown = stats
    ? buildOrderedBreakdown(stats.opportunities_by_stage, OPPORTUNITY_STAGE_LABELS)
    : []

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-card to-card/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-2">
              <LayoutGridIcon size={30} className="text-primary shrink-0" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard CRM</h1>
              <p className="text-sm text-muted-foreground">Vue d&apos;ensemble du pipeline commercial</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <QuickLink href="/dashboard/crm/contacts" label="Nouveau contact" />
            <QuickLink href="/dashboard/crm/leads" label="Nouvelle piste" />
            <QuickLink href="/dashboard/crm/opportunities" label="Nouvelle opportunité" />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {!stats && !error && <p className="text-sm text-muted-foreground">Chargement...</p>}

      {stats && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Contacts"
              value={String(stats.contacts_count)}
              subLabel="Base relationnelle"
              href="/dashboard/crm/contacts"
            />
            <StatCard
              label="Pistes"
              value={String(stats.leads_count)}
              subLabel="Qualification en cours"
              href="/dashboard/crm/leads"
            />
            <StatCard
              label="Opportunités"
              value={String(stats.opportunities_count)}
              subLabel="Deals actifs"
              href="/dashboard/crm/opportunities"
            />
            <StatCard
              label="Pipeline"
              value={formatMoneyWithCurrencySuffix(stats.pipeline_amount, tenant.currencyCode)}
              subLabel={`Pondéré: ${formatMoneyWithCurrencySuffix(stats.weighted_pipeline_amount, tenant.currencyCode)}`}
              href="/dashboard/crm/opportunities"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard
              title="Répartition des pistes"
              items={leadsBreakdown}
              emptyLabel="Aucune piste pour le moment."
            />
            <BreakdownCard
              title="Répartition des opportunités"
              items={opportunitiesBreakdown}
              emptyLabel="Aucune opportunité pour le moment."
            />
          </section>
        </>
      )}

      <section className="rounded-xl border border-border/70 bg-card/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigation rapide</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <QuickLink href="/dashboard/crm/contacts" label="Contacts" />
          <QuickLink href="/dashboard/crm/leads" label="Pistes" />
          <QuickLink href="/dashboard/crm/opportunities" label="Opportunités" />
          <QuickLink href="/dashboard/crm/activities" label="Activités" />
        </div>
      </section>
    </div>
  )
}

function BreakdownCard({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: { label: string; value: number; ratio: number }[]
  emptyLabel: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(item.ratio, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
    >
      {label}
    </Link>
  )
}

function StatCard({
  label,
  value,
  subLabel,
  href,
}: {
  label: string
  value: string
  subLabel: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>
    </Link>
  )
}

function buildOrderedBreakdown(
  source: Record<string, number>,
  labels: Record<string, string>
): { label: string; value: number; ratio: number }[] {
  const entries = Object.entries(source)
  if (entries.length === 0) return []
  const total = entries.reduce((acc, [, value]) => acc + value, 0) || 1
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      label: labels[key] || key,
      value,
      ratio: (value / total) * 100,
    }))
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelles',
  contacted: 'Contactées',
  qualified: 'Qualifiées',
  lost: 'Perdues',
  converted: 'Converties',
}

const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  discovery: 'Découverte',
  proposal: 'Proposition',
  negotiation: 'Négociation',
  closed_won: 'Gagnées',
  closed_lost: 'Perdues',
}
