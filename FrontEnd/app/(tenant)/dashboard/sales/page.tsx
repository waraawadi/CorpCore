'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { notify } from '@/lib/notify'
import { SalesSubnav } from './_components/sales-subnav'
import { Area, AreaChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { salesApiRequest, type SalesCustomer, type SalesOrder, type SalesProduct } from './_lib/sales-api'

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
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
    days.push({ key: dayKey(d), label: `J-${i}` })
  }
  return days
}

export default function SalesDashboardPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<SalesCustomer[]>([])
  const [products, setProducts] = useState<SalesProduct[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [customersData, productsData, ordersData] = await Promise.all([
        salesApiRequest<SalesCustomer[]>('/sales/customers/'),
        salesApiRequest<SalesProduct[]>('/sales/products/'),
        salesApiRequest<SalesOrder[]>('/sales/orders/'),
      ])
      setCustomers(customersData)
      setProducts(productsData)
      setOrders(ordersData)
    } catch (error) {
      notify.error('Chargement dashboard ventes impossible', error instanceof Error ? error.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const last30 = useMemo(() => createLast30Days(), [])

  const chartSeries = useMemo(() => {
    const revenueByDay = new Map<string, number>()
    const ordersByDay = new Map<string, number>()
    const customersByDay = new Map<string, number>()

    orders.forEach((order) => {
      const key = dayKey(new Date(order.ordered_at))
      if (!revenueByDay.has(key)) revenueByDay.set(key, 0)
      if (!ordersByDay.has(key)) ordersByDay.set(key, 0)
      if (order.status === 'confirmed') {
        revenueByDay.set(key, (revenueByDay.get(key) || 0) + Number(order.total_amount || 0))
      }
      ordersByDay.set(key, (ordersByDay.get(key) || 0) + 1)
    })

    customers.forEach((customer) => {
      const rawDate = customer.created_at || customer.updated_at
      if (!rawDate) return
      const key = dayKey(new Date(rawDate))
      customersByDay.set(key, (customersByDay.get(key) || 0) + 1)
    })

    return last30.map((day) => ({
      day: day.label,
      revenue: revenueByDay.get(day.key) || 0,
      orders: ordersByDay.get(day.key) || 0,
      customers: customersByDay.get(day.key) || 0,
    }))
  }, [orders, customers, last30])

  const totalRevenue = useMemo(() => chartSeries.reduce((sum, p) => sum + p.revenue, 0), [chartSeries])
  const totalOrders = useMemo(() => chartSeries.reduce((sum, p) => sum + p.orders, 0), [chartSeries])

  const channelData = useMemo(() => {
    const revenueByCustomer = new Map<string, number>()
    orders.forEach((order) => {
      if (order.status !== 'confirmed') return
      const customer = order.customer_name || 'Client non renseigné'
      const current = revenueByCustomer.get(customer) || 0
      revenueByCustomer.set(customer, current + Number(order.total_amount || 0))
    })
    const sorted = Array.from(revenueByCustomer.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const top = sorted.slice(0, 4)
    const othersTotal = sorted.slice(4).reduce((sum, item) => sum + item.value, 0)
    const palette = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#64748b']
    const pie = top.map((item, index) => ({
      ...item,
      fill: palette[index % palette.length],
    }))
    if (othersTotal > 0) {
      pie.push({ name: 'Autres clients', value: othersTotal, fill: palette[4] })
    }
    return pie
  }, [orders])

  const statusData = useMemo(() => {
    const draft = orders.filter((o) => o.status === 'draft').length
    const confirmed = orders.filter((o) => o.status === 'confirmed').length
    const cancelled = orders.filter((o) => o.status === 'cancelled').length
    return [
      { name: 'Brouillons', value: draft, fill: 'var(--color-draft)' },
      { name: 'Confirmées', value: confirmed, fill: 'var(--color-confirmed)' },
      { name: 'Annulées', value: cancelled, fill: 'var(--color-cancelled)' },
    ]
  }, [orders])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:gap-4 md:p-6">
      <SalesSubnav />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      <Card className="border-primary/20 bg-gradient-to-br from-card to-card/60">
        <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Tableau de bord Ventes</CardTitle>
            <p className="text-sm text-muted-foreground">Graphiques reliés aux données des commandes et des clients.</p>
          </div>
          <Button onClick={() => void loadData()} disabled={loading} className="w-full sm:w-auto">
            {loading ? 'Chargement...' : 'Actualiser'}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">CA confirme (30 jours)</p><p className="text-xl font-semibold">{totalRevenue.toLocaleString('fr-FR')} XOF</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Commandes</p><p className="text-xl font-semibold">{totalOrders}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Clients</p><p className="text-xl font-semibold">{customers.length}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Produits</p><p className="text-xl font-semibold">{products.length}</p></CardContent></Card>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Courbe du chiffre d'affaires</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <ChartContainer className="h-[170px] w-full sm:h-[210px] lg:h-[240px]" config={{ revenue: { label: 'CA', color: 'hsl(var(--chart-1))' } }}>
              <LineChart data={chartSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Courbe Commandes vs Clients</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              className="h-[170px] w-full sm:h-[210px] lg:h-[240px]"
              config={{
                orders: { label: 'Commandes', color: 'hsl(var(--chart-2))' },
                customers: { label: 'Nouveaux clients', color: 'hsl(var(--chart-3))' },
              }}
            >
              <AreaChart data={chartSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="orders" stroke="var(--color-orders)" fill="var(--color-orders)" fillOpacity={0.22} />
                <Area type="monotone" dataKey="customers" stroke="var(--color-customers)" fill="var(--color-customers)" fillOpacity={0.2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Répartition du CA par client</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              className="h-[170px] w-full sm:h-[210px] lg:h-[240px]"
              config={{
                total: { label: 'Chiffre d’affaires', color: '#3b82f6' },
              }}
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie
                  data={channelData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={isMobile ? 24 : 44}
                  outerRadius={isMobile ? 42 : 72}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <ChartLegend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Statut des commandes</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              className="h-[170px] w-full sm:h-[210px] lg:h-[240px]"
              config={{
                draft: { label: 'Brouillons', color: '#f59e0b' },
                confirmed: { label: 'Confirmées', color: '#22c55e' },
                cancelled: { label: 'Annulées', color: '#ef4444' },
              }}
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={isMobile ? 42 : 72} />
                <ChartLegend content={<ChartLegendContent />} />
                <ChartLegend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
