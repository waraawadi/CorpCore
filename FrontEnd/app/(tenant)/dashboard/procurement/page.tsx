'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { notify } from '@/lib/notify'
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ProcurementStatusLegend } from './_components/procurement-status'
import { ProcurementSubnav } from './_components/procurement-subnav'
import {
  procurementApiRequest,
  type ProcurementPurchaseOrder,
  type ProcurementPurchaseRequest,
  type ProcurementSupplier,
} from './_lib/procurement-api'

/** Clé jour calendaire local (alignée avec les dates ISO renvoyées par l’API). */
function dayKeyLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function createLast30Days() {
  const today = new Date()
  const days: Array<{ key: string; label: string }> = []
  for (let i = 29; i >= 0; i -= 1) {
    const d = addDays(today, -i)
    days.push({ key: dayKeyLocal(d), label: `J-${i}` })
  }
  return days
}

export default function ProcurementDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<ProcurementSupplier[]>([])
  const [requests, setRequests] = useState<ProcurementPurchaseRequest[]>([])
  const [orders, setOrders] = useState<ProcurementPurchaseOrder[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r, o] = await Promise.all([
        procurementApiRequest<ProcurementSupplier[]>('/procurement/suppliers/'),
        procurementApiRequest<ProcurementPurchaseRequest[]>('/procurement/requests/'),
        procurementApiRequest<ProcurementPurchaseOrder[]>('/procurement/orders/'),
      ])
      setSuppliers(s)
      setRequests(r)
      setOrders(o)
    } catch (error) {
      notify.error('Chargement achats impossible', error instanceof Error ? error.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const last30 = useMemo(() => createLast30Days(), [])

  const evolutionSeries = useMemo(() => {
    const requestsByDay = new Map<string, number>()
    const ordersByDay = new Map<string, number>()
    const volumeByDay = new Map<string, number>()
    const suppliersByDay = new Map<string, number>()

    requests.forEach((item) => {
      const raw = item.created_at
      if (!raw) return
      const key = dayKeyLocal(new Date(raw))
      requestsByDay.set(key, (requestsByDay.get(key) || 0) + 1)
    })

    orders.forEach((item) => {
      const raw = item.created_at
      if (!raw) return
      const key = dayKeyLocal(new Date(raw))
      ordersByDay.set(key, (ordersByDay.get(key) || 0) + 1)
      volumeByDay.set(key, (volumeByDay.get(key) || 0) + Number(item.total_amount || 0))
    })

    suppliers.forEach((item) => {
      const raw = item.created_at
      if (!raw) return
      const key = dayKeyLocal(new Date(raw))
      suppliersByDay.set(key, (suppliersByDay.get(key) || 0) + 1)
    })

    return last30.map((day) => ({
      day: day.label,
      requests: requestsByDay.get(day.key) || 0,
      orders: ordersByDay.get(day.key) || 0,
      volume: volumeByDay.get(day.key) || 0,
      suppliers: suppliersByDay.get(day.key) || 0,
    }))
  }, [requests, orders, suppliers, last30])

  const activeSuppliers = useMemo(() => suppliers.filter((x) => x.is_active).length, [suppliers])
  const openRequests = useMemo(
    () => requests.filter((x) => x.status === 'draft' || x.status === 'submitted').length,
    [requests]
  )
  const ordersInFlight = useMemo(
    () => orders.filter((x) => x.status === 'draft' || x.status === 'sent' || x.status === 'partially_received').length,
    [orders]
  )
  const ordersTotal = useMemo(
    () => orders.reduce((sum, x) => sum + Number(x.total_amount || 0), 0),
    [orders]
  )

  const totals30d = useMemo(
    () => ({
      requests: evolutionSeries.reduce((s, p) => s + p.requests, 0),
      orders: evolutionSeries.reduce((s, p) => s + p.orders, 0),
      volume: evolutionSeries.reduce((s, p) => s + p.volume, 0),
      suppliers: evolutionSeries.reduce((s, p) => s + p.suppliers, 0),
    }),
    [evolutionSeries]
  )

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:gap-4 md:p-6">
      <ProcurementSubnav />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      <Card className="border-primary/20 bg-gradient-to-br from-card to-card/60">
        <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Tableau de bord Achats</CardTitle>
            <CardDescription>
              Indicateurs et courbes sur 30 jours glissants (date de création des enregistrements).
            </CardDescription>
          </div>
          <Button onClick={() => void load()} disabled={loading} className="w-full sm:w-auto">
            {loading ? 'Chargement...' : 'Actualiser'}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Fournisseurs actifs</p>
              <p className="text-xl font-semibold">{loading ? '—' : activeSuppliers}</p>
              <p className="text-xs text-muted-foreground">{suppliers.length} au total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Demandes ouvertes</p>
              <p className="text-xl font-semibold">{loading ? '—' : openRequests}</p>
              <p className="text-xs text-muted-foreground">{requests.length} demandes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">BC en cours</p>
              <p className="text-xl font-semibold">{loading ? '—' : ordersInFlight}</p>
              <p className="text-xs text-muted-foreground">{orders.length} bons</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Volume BC (total)</p>
              <p className="text-xl font-semibold">
                {loading ? '—' : ordersTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground">Somme des montants</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution — demandes d&apos;achat créées</CardTitle>
            <CardDescription>
              Nombre de demandes par jour de création (30 j). Total période : {totals30d.requests}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer
              className="[aspect-ratio:auto] h-[200px] w-full min-h-[200px] sm:h-[240px] sm:min-h-[240px]"
              config={{ requests: { label: 'Demandes', color: 'var(--chart-1)' } }}
            >
              <LineChart data={evolutionSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} interval={4} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="requests" stroke="var(--color-requests)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution — bons de commande créés</CardTitle>
            <CardDescription>
              Nombre de BC par jour de création (30 j). Total période : {totals30d.orders}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer
              className="[aspect-ratio:auto] h-[200px] w-full min-h-[200px] sm:h-[240px] sm:min-h-[240px]"
              config={{ orders: { label: 'BC', color: 'var(--chart-2)' } }}
            >
              <LineChart data={evolutionSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} interval={4} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="orders" stroke="var(--color-orders)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution — volume BC (XOF)</CardTitle>
            <CardDescription>
              Somme des montants des BC créés chaque jour (30 j). Total période :{' '}
              {totals30d.volume.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer
              className="[aspect-ratio:auto] h-[200px] w-full min-h-[200px] sm:h-[240px] sm:min-h-[240px]"
              config={{ volume: { label: 'Montant', color: 'var(--chart-3)' } }}
            >
              <AreaChart data={evolutionSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} interval={4} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="volume" stroke="var(--color-volume)" fill="var(--color-volume)" fillOpacity={0.25} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution — fiches fournisseurs créées</CardTitle>
            <CardDescription>
              Nouveaux fournisseurs enregistrés par jour (30 j). Total période : {totals30d.suppliers}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer
              className="[aspect-ratio:auto] h-[200px] w-full min-h-[200px] sm:h-[240px] sm:min-h-[240px]"
              config={{ suppliers: { label: 'Fournisseurs', color: 'var(--chart-4)' } }}
            >
              <AreaChart data={evolutionSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} interval={4} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="suppliers"
                  stroke="var(--color-suppliers)"
                  fill="var(--color-suppliers)"
                  fillOpacity={0.22}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raccourcis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/procurement/suppliers">Fournisseurs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/procurement/requests">Demandes d&apos;achat</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/procurement/orders">Bons de commande</Link>
          </Button>
        </CardContent>
      </Card>
      <ProcurementStatusLegend />
      </div>
    </div>
  )
}
