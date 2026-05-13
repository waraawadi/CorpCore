'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPagination } from '@/components/ui/data-pagination'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { MoreHorizontal } from 'lucide-react'
import { notify } from '@/lib/notify'
import { SalesSubnav } from '../_components/sales-subnav'
import { getInvoiceStatusLabel, getOrderStatusLabel } from '../_lib/sales-status'
import {
  salesApiRequest,
  type SalesCustomer,
  type SalesOrder,
  type SalesOrderInvoiceResult,
  type SalesOrderLine,
  type SalesProduct,
} from '../_lib/sales-api'

type OrderForm = { customer: string; status: 'draft' | 'confirmed' | 'cancelled'; notes: string }
type LineForm = { product: string; quantity: string; unit_price: string }
type PaymentMethod = 'mobile_money' | 'cheque' | 'bank_transfer' | 'cash' | 'other'
const emptyOrder: OrderForm = { customer: '', status: 'draft', notes: '' }
const emptyLine: LineForm = { product: '', quantity: '1', unit_price: '0' }
type DraftLine = LineForm & { id: string; product_name: string }
const createDraftLineId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function SalesOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<SalesCustomer[]>([])
  const [products, setProducts] = useState<SalesProduct[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])

  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [orderDetailsDialogOpen, setOrderDetailsDialogOpen] = useState(false)
  const [lineDialogOpen, setLineDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [invoicePreviewTitle, setInvoicePreviewTitle] = useState('')
  const [invoicePreviewLoading, setInvoicePreviewLoading] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<SalesOrder | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money')
  const [paymentReference, setPaymentReference] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'order' | 'line'; id: string } | null>(null)
  const [confirmConfirmOrderOpen, setConfirmConfirmOrderOpen] = useState(false)
  const [draftLineDeleteId, setDraftLineDeleteId] = useState<string | null>(null)
  const [pendingMerge, setPendingMerge] = useState<{
    mode: 'draft' | 'persisted'
    targetLineId: string
    addedQuantity: number
    orderId?: string
  } | null>(null)
  const [detailOrderId, setDetailOrderId] = useState('')
  const [lineOrderId, setLineOrderId] = useState<string | null>(null)

  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null)
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrder)
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine)
  const [draftLineForm, setDraftLineForm] = useState<LineForm>(emptyLine)
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersPageSize, setOrdersPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'amount_desc' | 'amount_asc' | 'customer_asc'>('recent')

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    const base = query
      ? orders.filter((item) =>
          `${item.reference} ${item.customer_name} ${item.status} ${item.notes || ''}`.toLowerCase().includes(query)
        )
      : orders
    const sorted = [...base]
    if (sortBy === 'recent') sorted.sort((a, b) => b.ordered_at.localeCompare(a.ordered_at))
    if (sortBy === 'amount_desc') sorted.sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
    if (sortBy === 'amount_asc') sorted.sort((a, b) => Number(a.total_amount) - Number(b.total_amount))
    if (sortBy === 'customer_asc') sorted.sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'fr'))
    return sorted
  }, [orders, search, sortBy])
  const detailOrder = useMemo(() => orders.find((o) => o.id === detailOrderId) || null, [orders, detailOrderId])
  const pagedOrders = useMemo(
    () => filteredOrders.slice((ordersPage - 1) * ordersPageSize, ordersPage * ordersPageSize),
    [filteredOrders, ordersPage, ordersPageSize]
  )

  const loadAll = useCallback(async () => {
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
      notify.error('Chargement commandes impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    const prefillSearch = searchParams.get('search')
    if (!prefillSearch) return
    setSearch(prefillSearch)
    setOrdersPage(1)
  }, [searchParams])

  const money = (value: string | number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(Number(value || 0))

  const deleteDetailText = useMemo(() => {
    if (!deleteTarget) return ''
    if (deleteTarget.type === 'order') {
      const o = orders.find((x) => x.id === deleteTarget.id)
      return o ? `Commande ${o.reference} — ${o.customer_name} — total ${money(o.total_amount)}.` : ''
    }
    for (const o of orders) {
      const line = o.lines.find((l) => l.id === deleteTarget.id)
      if (line) {
        return `Ligne « ${line.product_name} » (${line.quantity} × ${money(line.unit_price)}) — commande ${o.reference}.`
      }
    }
    return ''
  }, [deleteTarget, orders])

  const draftLineDeleteSummary = useMemo(() => {
    if (!draftLineDeleteId) return ''
    const line = draftLines.find((l) => l.id === draftLineDeleteId)
    return line ? `${line.product_name} — ${line.quantity} × ${money(line.unit_price)}` : ''
  }, [draftLineDeleteId, draftLines])

  const resetDraftLineForm = useCallback(() => {
    setDraftLineForm({
      product: products[0]?.id || '',
      quantity: '1',
      unit_price: String(products[0]?.unit_price || '0'),
    })
  }, [products])

  const openCreateOrder = () => {
    setEditingOrder(null)
    setOrderForm({ ...emptyOrder, customer: customers[0]?.id || '' })
    setDraftLines([])
    setDraftLineForm({
      product: products[0]?.id || '',
      quantity: '1',
      unit_price: String(products[0]?.unit_price || '0'),
    })
    setOrderDialogOpen(true)
  }

  const openEditOrder = (order: SalesOrder) => {
    setEditingOrder(order)
    setOrderForm({ customer: order.customer, status: order.status, notes: order.notes || '' })
    setDraftLines([])
    resetDraftLineForm()
    setOrderDialogOpen(true)
  }

  const addDraftLine = () => {
    if (!draftLineForm.product) return
    const product = products.find((item) => item.id === draftLineForm.product)
    if (!product) return
    const duplicate = draftLines.find((line) => line.product === draftLineForm.product)
    if (duplicate) {
      setPendingMerge({
        mode: 'draft',
        targetLineId: duplicate.id,
        addedQuantity: Number(draftLineForm.quantity || 0),
      })
      setMergeDialogOpen(true)
      return
    }
    setDraftLines((prev) => [
      ...prev,
      {
        id: createDraftLineId(),
        product: draftLineForm.product,
        quantity: draftLineForm.quantity,
        unit_price: draftLineForm.unit_price,
        product_name: product.name,
      },
    ])
    resetDraftLineForm()
  }

  const removeDraftLine = (id: string) => {
    setDraftLines((prev) => prev.filter((line) => line.id !== id))
  }

  const saveOrder = async () => {
    try {
      if (editingOrder) {
        await salesApiRequest(`/sales/orders/${editingOrder.id}/`, { method: 'PATCH', body: JSON.stringify(orderForm) })
      } else {
        const createdOrder = await salesApiRequest<SalesOrder>('/sales/orders/', { method: 'POST', body: JSON.stringify(orderForm) })
        if (draftLines.length) {
          await Promise.all(
            draftLines.map((line) =>
              salesApiRequest('/sales/order-lines/', {
                method: 'POST',
                body: JSON.stringify({
                  order: createdOrder.id,
                  product: line.product,
                  quantity: line.quantity,
                  unit_price: line.unit_price,
                }),
              })
            )
          )
        }
      }
      setConfirmConfirmOrderOpen(false)
      setOrderDialogOpen(false)
      await loadAll()
      notify.success('Commande enregistree')
    } catch (error) {
      notify.error('Erreur commande', error instanceof Error ? error.message : undefined)
    }
  }

  const requestSaveOrder = () => {
    const needConfirm =
      orderForm.status === 'confirmed' && (!editingOrder || editingOrder.status === 'draft')
    if (needConfirm) {
      setConfirmConfirmOrderOpen(true)
      return
    }
    void saveOrder()
  }

  const confirmDraftLineRemove = () => {
    if (!draftLineDeleteId) return
    removeDraftLine(draftLineDeleteId)
    setDraftLineDeleteId(null)
  }

  const saveLine = async () => {
    if (!lineOrderId) return
    try {
      const payload = { order: lineOrderId, ...lineForm }
      if (editingLineId) {
        await salesApiRequest(`/sales/order-lines/${editingLineId}/`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        const order = orders.find((item) => item.id === lineOrderId)
        const duplicate = order?.lines.find((line) => line.product === lineForm.product)
        if (duplicate) {
          setPendingMerge({
            mode: 'persisted',
            targetLineId: duplicate.id,
            addedQuantity: Number(lineForm.quantity || 0),
            orderId: lineOrderId,
          })
          setMergeDialogOpen(true)
          return
        }
        await salesApiRequest('/sales/order-lines/', { method: 'POST', body: JSON.stringify(payload) })
      }
      setLineDialogOpen(false)
      setLineOrderId(null)
      await loadAll()
      notify.success('Ligne enregistree')
    } catch (error) {
      notify.error('Erreur ligne', error instanceof Error ? error.message : undefined)
    }
  }

  const confirmMergeLine = async () => {
    if (!pendingMerge) return
    try {
      if (pendingMerge.mode === 'draft') {
        setDraftLines((prev) =>
          prev.map((line) => {
            if (line.id !== pendingMerge.targetLineId) return line
            const currentQty = Number(line.quantity || 0)
            const mergedQty = currentQty + pendingMerge.addedQuantity
            return { ...line, quantity: String(mergedQty) }
          })
        )
        setMergeDialogOpen(false)
        setPendingMerge(null)
        resetDraftLineForm()
        notify.success('Produit deja present: quantite fusionnee sur la ligne existante')
        return
      }

      const order = orders.find((item) => item.id === pendingMerge.orderId)
      const line = order?.lines.find((item) => item.id === pendingMerge.targetLineId)
      if (!line) {
        notify.error('Ligne cible introuvable pour la fusion')
        setMergeDialogOpen(false)
        setPendingMerge(null)
        return
      }
      const mergedQty = Number(line.quantity || 0) + pendingMerge.addedQuantity
      await salesApiRequest(`/sales/order-lines/${line.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          order: line.order,
          product: line.product,
          quantity: String(mergedQty),
          unit_price: line.unit_price,
        }),
      })
      setMergeDialogOpen(false)
      setPendingMerge(null)
      setLineDialogOpen(false)
      setLineOrderId(null)
      await loadAll()
      notify.success('Produit deja present: quantite fusionnee sur la ligne existante')
    } catch (error) {
      notify.error('Fusion impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const openOrderDetails = (order: SalesOrder) => {
    setDetailOrderId(order.id)
    setOrderDetailsDialogOpen(true)
  }

  const openCreateLineForOrder = (orderId: string) => {
    setLineOrderId(orderId)
    setEditingLineId(null)
    setLineForm({
      product: products[0]?.id || '',
      quantity: '1',
      unit_price: String(products[0]?.unit_price || '0'),
    })
    setLineDialogOpen(true)
  }

  const openEditLineForOrder = (orderId: string, line: SalesOrderLine) => {
    setLineOrderId(orderId)
    setEditingLineId(line.id)
    setLineForm({
      product: line.product,
      quantity: String(line.quantity),
      unit_price: String(line.unit_price),
    })
    setLineDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === 'order') await salesApiRequest(`/sales/orders/${deleteTarget.id}/`, { method: 'DELETE' })
      if (deleteTarget.type === 'line') await salesApiRequest(`/sales/order-lines/${deleteTarget.id}/`, { method: 'DELETE' })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      await loadAll()
      notify.success('Suppression effectuee')
    } catch (error) {
      notify.error('Suppression impossible', error instanceof Error ? error.message : undefined)
    }
  }

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
      await loadAll()
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

  const goToInvoice = async (order: SalesOrder) => {
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col space-y-4 overflow-hidden p-4 md:p-6">
      <SalesSubnav />

      <Card className="flex min-h-0 flex-[2] flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Commandes</CardTitle>
          <Button onClick={openCreateOrder}>Nouvelle commande</Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Rechercher (reference, client, statut...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setOrdersPage(1)
              }}
            />
            <SearchableSelect
              value={sortBy}
              onChange={(value) => {
                setSortBy(value as 'recent' | 'amount_desc' | 'amount_asc' | 'customer_asc')
                setOrdersPage(1)
              }}
              options={[
                { value: 'recent', label: 'Tri: Plus recentes' },
                { value: 'amount_desc', label: 'Tri: Montant décroissant' },
                { value: 'amount_asc', label: 'Tri: Montant croissant' },
                { value: 'customer_asc', label: 'Tri: Client A-Z' },
              ]}
              placeholder="Choisir un tri"
            />
          </div>
          <div className="grid min-h-0 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {pagedOrders.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-left">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{item.reference}</p>
                <Badge variant={item.status === 'confirmed' ? 'default' : item.status === 'cancelled' ? 'destructive' : 'outline'}>
                  {getOrderStatusLabel(item.status)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{item.customer_name}</p>
              <p className="text-sm font-medium mt-2">{money(item.total_amount)}</p>
              {item.invoice_number ? (
                <p className="mt-1 text-xs text-emerald-600">
                  Facture: {item.invoice_number} ({getInvoiceStatusLabel(item.invoice_status || 'issued')})
                </p>
              ) : null}
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => openPaymentDialog(item)}
                  disabled={item.status !== 'confirmed' || Boolean(item.invoice)}
                >
                  {item.invoice ? 'Facturée' : 'Facturer'}
                </Button>
                {item.invoice ? (
                  <Button size="sm" variant="outline" onClick={() => void goToInvoice(item)}>
                    Voir facture
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="px-2" aria-label="Plus d'actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openOrderDetails(item)}>Détails</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEditOrder(item)}>Modifier</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        setDeleteTarget({ type: 'order', id: item.id })
                        setDeleteDialogOpen(true)
                      }}
                    >
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          </div>
          <DataPagination
            totalItems={filteredOrders.length}
            page={ordersPage}
            pageSize={ordersPageSize}
            onPageChange={setOrdersPage}
            onPageSizeChange={(size) => {
              setOrdersPageSize(size)
              setOrdersPage(1)
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={orderDialogOpen}
        onOpenChange={(open) => {
          setOrderDialogOpen(open)
          if (!open) setConfirmConfirmOrderOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Modifier commande' : 'Nouvelle commande'}</DialogTitle>
            <DialogDescription>
              {editingOrder
                ? 'Mettez a jour les informations de la commande.'
                : 'Renseignez la commande et ajoutez des lignes avant validation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client</Label>
              <SearchableSelect
                value={orderForm.customer}
                onChange={(value) => setOrderForm((s) => ({ ...s, customer: value }))}
                options={customers.map((item) => ({ value: item.id, label: item.name, keywords: `${item.company || ''} ${item.email || ''}` }))}
                placeholder="Sélectionner un client"
              />
            </div>
            <div>
              <Label>Statut</Label>
              <SearchableSelect
                value={orderForm.status}
                onChange={(value) => setOrderForm((s) => ({ ...s, status: value as OrderForm['status'] }))}
                options={[
                  { value: 'draft', label: 'Brouillon' },
                  { value: 'confirmed', label: 'Confirmée' },
                  { value: 'cancelled', label: 'Annulée' },
                ]}
                placeholder="Sélectionner un statut"
              />
            </div>
            <div><Label>Notes</Label><Textarea value={orderForm.notes} onChange={(e) => setOrderForm((s) => ({ ...s, notes: e.target.value }))} /></div>
            {!editingOrder && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Lignes de commande</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Label>Produit</Label>
                    <SearchableSelect
                      value={draftLineForm.product}
                      onChange={(value) => {
                        const p = products.find((x) => x.id === value)
                        setDraftLineForm((s) => ({ ...s, product: value, unit_price: String(p?.unit_price || s.unit_price) }))
                      }}
                      options={products.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` }))}
                      placeholder="Sélectionner un produit"
                    />
                  </div>
                  <div>
                    <Label>Quantité</Label>
                    <Input type="number" min={0.01} step="0.01" value={draftLineForm.quantity} onChange={(e) => setDraftLineForm((s) => ({ ...s, quantity: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label>Prix unitaire</Label>
                    <Input type="number" min={0} step="0.01" value={draftLineForm.unit_price} onChange={(e) => setDraftLineForm((s) => ({ ...s, unit_price: e.target.value }))} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="secondary" className="w-full" onClick={addDraftLine}>
                      Ajouter la ligne
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {draftLines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between rounded-md border p-2">
                      <p className="text-sm">
                        {line.product_name} - {line.quantity} x {money(line.unit_price)}
                      </p>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDraftLineDeleteId(line.id)}>
                        Retirer
                      </Button>
                    </div>
                  ))}
                  {!draftLines.length && <p className="text-xs text-muted-foreground">Aucune ligne ajoutée.</p>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOrderDialogOpen(false)}>Annuler</Button><Button onClick={() => void requestSaveOrder()}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderDetailsDialogOpen} onOpenChange={setOrderDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails de la commande</DialogTitle>
            <DialogDescription>
              Visualisez les informations completes et gerez les lignes de commande.
            </DialogDescription>
          </DialogHeader>
          {!detailOrder ? (
            <p className="text-sm text-muted-foreground">Commande introuvable.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <p className="text-sm"><span className="font-medium">Reference:</span> {detailOrder.reference}</p>
                <p className="text-sm"><span className="font-medium">Client:</span> {detailOrder.customer_name}</p>
                <p className="text-sm"><span className="font-medium">Statut:</span> {getOrderStatusLabel(detailOrder.status)}</p>
                <p className="text-sm"><span className="font-medium">Total:</span> {money(detailOrder.total_amount)}</p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <p className="text-sm">
                  <span className="font-medium">Facturation:</span>{' '}
                  {detailOrder.invoice_number
                    ? `${detailOrder.invoice_number} (${getInvoiceStatusLabel(detailOrder.invoice_status || 'issued')})`
                    : 'Non facturee'}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openPaymentDialog(detailOrder)}
                  disabled={detailOrder.status !== 'confirmed' || Boolean(detailOrder.invoice)}
                >
                  {detailOrder.invoice ? 'Facturée' : 'Générer facture'}
                </Button>
              </div>
              {detailOrder.invoice ? (
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => void goToInvoice(detailOrder)}>
                    Voir la facture
                  </Button>
                </div>
              ) : null}
              <div>
                <p className="text-sm font-medium">Notes</p>
                <p className="text-sm text-muted-foreground">{detailOrder.notes || '-'}</p>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Lignes de commande</p>
                  <Button type="button" size="sm" onClick={() => openCreateLineForOrder(detailOrder.id)}>
                    Ajouter une ligne
                  </Button>
                </div>
                {detailOrder.lines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between rounded-md border p-2">
                    <p className="text-sm">
                      {line.product_name} - {line.quantity} x {money(line.unit_price)} = {money(line.line_total)}
                    </p>
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditLineForOrder(detailOrder.id, line)}>
                        Modifier
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => { setDeleteTarget({ type: 'line', id: line.id }); setDeleteDialogOpen(true) }}>
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
                {!detailOrder.lines.length && <p className="text-xs text-muted-foreground">Aucune ligne de commande.</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLineId ? 'Modifier ligne' : 'Nouvelle ligne'}</DialogTitle>
            <DialogDescription>
              Definissez le produit, la quantite et le prix unitaire de la ligne.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Produit</Label>
              <SearchableSelect
                value={lineForm.product}
                onChange={(value) => {
                  const p = products.find((x) => x.id === value)
                  setLineForm((s) => ({ ...s, product: value, unit_price: String(p?.unit_price || s.unit_price) }))
                }}
                options={products.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` }))}
                placeholder="Sélectionner un produit"
              />
            </div>
            <div><Label>Quantité</Label><Input type="number" min={0.01} step="0.01" value={lineForm.quantity} onChange={(e) => setLineForm((s) => ({ ...s, quantity: e.target.value }))} /></div>
            <div><Label>Prix unitaire</Label><Input type="number" min={0} step="0.01" value={lineForm.unit_price} onChange={(e) => setLineForm((s) => ({ ...s, unit_price: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLineDialogOpen(false)}>Annuler</Button><Button onClick={() => void saveLine()}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer suppression</DialogTitle>
            <DialogDescription>
              {deleteDetailText ? `${deleteDetailText} ` : ''}
              Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button><Button variant="destructive" onClick={() => void confirmDelete()}>Supprimer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produit deja present</DialogTitle>
            <DialogDescription>
              Ce produit existe deja dans la commande. Voulez-vous fusionner en ajoutant la quantite a la ligne existante ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMergeDialogOpen(false); setPendingMerge(null) }}>
              Annuler
            </Button>
            <Button onClick={() => void confirmMergeLine()}>Confirmer la fusion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmConfirmOrderOpen} onOpenChange={setConfirmConfirmOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la commande</DialogTitle>
            <DialogDescription>
              Le statut « Confirmée » applique les mouvements de stock selon les lignes. Assurez-vous que les quantites et produits sont corrects avant de continuer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmConfirmOrderOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveOrder()}>Confirmer et enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(draftLineDeleteId)} onOpenChange={(open) => !open && setDraftLineDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer la ligne</DialogTitle>
            <DialogDescription>
              {draftLineDeleteSummary
                ? `Retirer ${draftLineDeleteSummary} du brouillon ?`
                : 'Retirer cette ligne du brouillon ?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftLineDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDraftLineRemove}>
              Retirer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <p className="text-xs text-muted-foreground">Monnaie a remettre: {computedChange || '0'} XOF</p>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => paymentOrder && void createInvoiceFromOrder(paymentOrder)} disabled={!paymentOrder}>
              Generer facture
            </Button>
          </DialogFooter>
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
