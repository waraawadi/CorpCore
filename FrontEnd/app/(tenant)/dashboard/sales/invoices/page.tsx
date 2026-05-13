'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPagination } from '@/components/ui/data-pagination'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notify } from '@/lib/notify'
import { SalesSubnav } from '../_components/sales-subnav'
import { salesApiRequest, type SalesOrder, type SalesOrderInvoiceResult } from '../_lib/sales-api'
import { getInvoiceStatusLabel, getOrderStatusLabel } from '../_lib/sales-status'

type InvoiceSort = 'recent' | 'amount_desc' | 'amount_asc' | 'customer_asc'
type InvoiceFilter = 'all' | 'paid' | 'issued'
type PaymentMethod = 'mobile_money' | 'cheque' | 'bank_transfer' | 'cash' | 'other'

export default function SalesInvoicesPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<InvoiceSort>('recent')
  const [filterBy, setFilterBy] = useState<InvoiceFilter>('all')
  const [invoiceTab, setInvoiceTab] = useState<'not_invoiced' | 'invoiced'>('not_invoiced')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [invoicePreviewTitle, setInvoicePreviewTitle] = useState('')
  const [invoicePreviewLoading, setInvoicePreviewLoading] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<SalesOrder | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money')
  const [paymentReference, setPaymentReference] = useState('')
  const [amountReceived, setAmountReceived] = useState('')

  const loadOrders = useCallback(async () => {
    try {
      const data = await salesApiRequest<SalesOrder[]>('/sales/orders/')
      setOrders(data)
    } catch (error) {
      notify.error('Chargement facturation impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const money = (value: string | number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(Number(value || 0))

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    let base = invoiceTab === 'invoiced' ? orders.filter((item) => Boolean(item.invoice)) : orders.filter((item) => !item.invoice)
    if (filterBy === 'paid') base = base.filter((item) => item.invoice_status === 'paid')
    if (filterBy === 'issued') base = base.filter((item) => item.invoice_status === 'issued' || item.invoice_status === 'partial')

    if (query) {
      base = base.filter((item) =>
        `${item.reference} ${item.customer_name} ${item.invoice_number || ''} ${item.invoice_status || ''}`
          .toLowerCase()
          .includes(query)
      )
    }
    const sorted = [...base]
    if (sortBy === 'recent') sorted.sort((a, b) => b.ordered_at.localeCompare(a.ordered_at))
    if (sortBy === 'amount_desc') sorted.sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
    if (sortBy === 'amount_asc') sorted.sort((a, b) => Number(a.total_amount) - Number(b.total_amount))
    if (sortBy === 'customer_asc') sorted.sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'fr'))
    return sorted
  }, [orders, search, sortBy, filterBy, invoiceTab])

  const pagedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize)

  const stats = useMemo(() => {
    const invoiced = orders.filter((item) => Boolean(item.invoice))
    const toInvoice = orders.filter((item) => item.status === 'confirmed' && !item.invoice)
    const paid = invoiced.filter((item) => item.invoice_status === 'paid')
    return {
      invoicedCount: invoiced.length,
      toInvoiceCount: toInvoice.length,
      paidCount: paid.length,
      invoicedAmount: invoiced.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    }
  }, [orders])

  const createInvoiceFromOrder = async (order: SalesOrder) => {
    try {
      const data = await salesApiRequest<SalesOrderInvoiceResult>(`/sales/orders/${order.id}/create-invoice/`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          amount_received: paymentMethod === 'cash' ? amountReceived : undefined,
        }),
      })
      await loadOrders()
      notify.success(data.message || `Facture ${data.invoice_number} creee`)
      setPaymentDialogOpen(false)
      setPaymentOrder(null)
      setPaymentReference('')
      setAmountReceived('')
    } catch (error) {
      notify.error('Facturation impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const openPaymentDialog = (order: SalesOrder) => {
    setPaymentOrder(order)
    setPaymentMethod('mobile_money')
    setPaymentReference('')
    setAmountReceived('')
    setPaymentDialogOpen(true)
  }

  const computedChange = useMemo(() => {
    if (!paymentOrder || paymentMethod !== 'cash') return ''
    const received = Number(amountReceived || 0)
    const total = Number(paymentOrder.total_amount || 0)
    if (!Number.isFinite(received) || received <= 0) return ''
    return String(Math.max(received - total, 0))
  }, [paymentOrder, paymentMethod, amountReceived])

  const openInvoice = async (order: SalesOrder) => {
    if (!order.invoice_document) return
    setInvoicePreviewLoading(true)
    setInvoicePreviewTitle(order.invoice_document_title || order.invoice_number || 'Facture')
    try {
      const data = await salesApiRequest<{ url: string }>(`/ged/documents/${order.invoice_document}/preview-url/`)
      let nextUrl = data.url
      try {
        const parsed = new URL(data.url, window.location.origin)
        const isLocalBackend = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
        if (isLocalBackend || parsed.protocol === 'http:') {
          nextUrl = `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
        }
      } catch {
        // keep backend URL as-is
      }
      setInvoicePreviewUrl(nextUrl)
      setInvoicePreviewOpen(true)
    } catch (error) {
      notify.error('Ouverture facture impossible', error instanceof Error ? error.message : undefined)
    } finally {
      setInvoicePreviewLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-4 overflow-hidden p-4 md:p-6">
      <SalesSubnav />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Facturation ventes</CardTitle>
            <Button type="button" variant="outline" size="sm" className="md:hidden" onClick={() => setStatusDialogOpen(true)}>
              États
            </Button>
          </div>
        </CardHeader>
        <CardContent className="hidden gap-2 sm:grid-cols-4 md:grid">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Commandes facturees</p>
            <p className="text-lg font-semibold">{stats.invoicedCount}</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs text-muted-foreground">A facturer</p>
            <p className="text-lg font-semibold text-amber-600">{stats.toInvoiceCount}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-xs text-muted-foreground">Factures payees</p>
            <p className="text-lg font-semibold text-emerald-600">{stats.paidCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Montant facture</p>
            <p className="text-lg font-semibold">{money(stats.invoicedAmount)}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>États de facturation</DialogTitle>
            <DialogDescription>Resume des indicateurs de facturation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Commandes facturees</p>
              <p className="text-lg font-semibold">{stats.invoicedCount}</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-muted-foreground">A facturer</p>
              <p className="text-lg font-semibold text-amber-600">{stats.toInvoiceCount}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs text-muted-foreground">Factures payees</p>
              <p className="text-lg font-semibold text-emerald-600">{stats.paidCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Montant facture</p>
              <p className="text-lg font-semibold">{money(stats.invoicedAmount)}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pt-6">
          <Tabs
            value={invoiceTab}
            onValueChange={(value) => {
              setInvoiceTab(value as 'not_invoiced' | 'invoiced')
              setPage(1)
            }}
          >
            <TabsList>
              <TabsTrigger value="not_invoiced">Non facturées</TabsTrigger>
              <TabsTrigger value="invoiced">Facturées</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Rechercher (commande, client, facture...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <SearchableSelect
              value={filterBy}
              onChange={(value) => {
                setFilterBy(value as InvoiceFilter)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'Filtre: Toutes' },
                { value: 'issued', label: 'Filtre: Émises / partielles' },
                { value: 'paid', label: 'Filtre: Payées' },
              ]}
              placeholder="Filtrer"
            />
            <SearchableSelect
              value={sortBy}
              onChange={(value) => {
                setSortBy(value as InvoiceSort)
                setPage(1)
              }}
              options={[
                { value: 'recent', label: 'Tri: Plus recentes' },
                { value: 'amount_desc', label: 'Tri: Montant décroissant' },
                { value: 'amount_asc', label: 'Tri: Montant croissant' },
                { value: 'customer_asc', label: 'Tri: Client A-Z' },
              ]}
              placeholder="Trier"
            />
          </div>

          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {pagedOrders.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.reference}</p>
                    <p className="text-xs text-muted-foreground">{item.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.status === 'confirmed' ? 'default' : item.status === 'cancelled' ? 'destructive' : 'outline'}>
                      {getOrderStatusLabel(item.status)}
                    </Badge>
                    <Badge variant={item.invoice_status === 'paid' ? 'default' : item.invoice ? 'outline' : 'secondary'}>
                      {item.invoice ? getInvoiceStatusLabel(item.invoice_status || 'issued') : 'Non facturee'}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium">{money(item.total_amount)}</p>
                <p className="text-xs text-muted-foreground">{item.invoice_number ? `Facture: ${item.invoice_number}` : 'Aucune facture'}</p>

                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => openPaymentDialog(item)}
                    disabled={item.status !== 'confirmed' || Boolean(item.invoice)}
                  >
                    {item.invoice ? 'Facturée' : 'Générer facture'}
                  </Button>
                  {item.invoice ? (
                    <Button size="sm" variant="outline" onClick={() => void openInvoice(item)}>
                      Voir facture
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/dashboard/sales/orders?search=${encodeURIComponent(item.reference)}`)}
                  >
                    Voir commande
                  </Button>
                </div>
              </div>
            ))}
            {!filteredOrders.length ? <p className="text-sm text-muted-foreground">Aucune donnée de facturation.</p> : null}
          </div>

          <DataPagination
            totalItems={filteredOrders.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open)
          if (!open) setPaymentOrder(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informations de paiement</DialogTitle>
            <DialogDescription>Precisez les modalites de paiement avant de generer la facture.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SearchableSelect
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as PaymentMethod)}
              options={[
                { value: 'mobile_money', label: 'Mobile money' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'bank_transfer', label: 'Virement bancaire' },
                { value: 'cash', label: 'Especes' },
                { value: 'other', label: 'Autre' },
              ]}
              placeholder="Mode de paiement"
            />
            <Input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder={paymentMethod === 'cash' ? 'Reference (optionnelle)' : 'Reference de paiement'}
            />
            {paymentMethod === 'cash' ? (
              <>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="Montant recu"
                />
                <p className="text-xs text-muted-foreground">
                  Monnaie a remettre: {computedChange || '0'} XOF
                </p>
              </>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => paymentOrder && void createInvoiceFromOrder(paymentOrder)} disabled={!paymentOrder}>
              Generer facture
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={invoicePreviewOpen}
        onOpenChange={(open) => {
          setInvoicePreviewOpen(open)
          if (!open) setInvoicePreviewUrl(null)
        }}
      >
        <DialogContent className="h-[85vh] max-w-5xl p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{invoicePreviewTitle}</DialogTitle>
            <DialogDescription>Aperçu PDF de la facture</DialogDescription>
          </DialogHeader>
          <div className="h-[calc(85vh-78px)]">
            {invoicePreviewLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement...</div>
            ) : invoicePreviewUrl ? (
              <iframe title={invoicePreviewTitle} src={invoicePreviewUrl} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucun apercu disponible.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
