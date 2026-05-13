'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DataPagination } from '@/components/ui/data-pagination'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { MoreHorizontal } from 'lucide-react'
import {
  procurementDetailLinesPanelClass,
  PurchaseOrderStatusBadge,
  PURCHASE_ORDER_STATUS_LABEL,
  ProcurementLineDot,
  purchaseOrderListRowClass,
} from '../_components/procurement-status'
import { ProcurementSubnav } from '../_components/procurement-subnav'
import {
  procurementApiRequest,
  type ProcurementOrderLine,
  type ProcurementOrderStatus,
  type ProcurementPurchaseOrder,
  type ProcurementPurchaseRequest,
  type ProcurementSupplier,
} from '../_lib/procurement-api'

const ORDER_STATUS_FILTER: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  ...(['draft', 'sent', 'partially_received', 'received', 'cancelled'] as const).map((value) => ({
    value,
    label: PURCHASE_ORDER_STATUS_LABEL[value],
  })),
]

const ORDER_STATUS_FORM: { value: ProcurementOrderStatus; label: string }[] = (
  ['draft', 'sent', 'partially_received', 'received', 'cancelled'] as const
).map((value) => ({ value, label: PURCHASE_ORDER_STATUS_LABEL[value] }))

export default function ProcurementOrdersPage() {
  const [orders, setOrders] = useState<ProcurementPurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<ProcurementSupplier[]>([])
  const [requests, setRequests] = useState<ProcurementPurchaseRequest[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [status, setStatus] = useState<ProcurementOrderStatus>('draft')
  const [notes, setNotes] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [sourceRequestId, setSourceRequestId] = useState('')
  const [totalAmount, setTotalAmount] = useState('0')
  const [lines, setLines] = useState<ProcurementPurchaseOrder['lines']>([])
  const [lineDesc, setLineDesc] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [linePrice, setLinePrice] = useState('0')
  const [deleteOrderOpen, setDeleteOrderOpen] = useState(false)
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null)
  const [orderLineDeleteId, setOrderLineDeleteId] = useState<string | null>(null)
  const [editLineOpen, setEditLineOpen] = useState(false)
  const [editLineId, setEditLineId] = useState('')
  const [editLineDesc, setEditLineDesc] = useState('')
  const [editLineQty, setEditLineQty] = useState('1')
  const [editLinePrice, setEditLinePrice] = useState('0')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'ref_asc'>('recent')

  const loadRefs = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        procurementApiRequest<ProcurementSupplier[]>('/procurement/suppliers/'),
        procurementApiRequest<ProcurementPurchaseRequest[]>('/procurement/requests/'),
      ])
      setSuppliers(s.filter((x) => x.is_active))
      setRequests(r)
    } catch (error) {
      notify.error('Chargement references impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadRefs()
  }, [loadRefs])

  const filteredOrders = useMemo(() => {
    let base = orders
    const query = search.trim().toLowerCase()
    if (query) base = base.filter((x) => `${x.reference} ${x.supplier_name} ${x.notes}`.toLowerCase().includes(query))
    if (supplierFilter) base = base.filter((x) => x.supplier === supplierFilter)
    const sorted = [...base]
    if (sortBy === 'ref_asc') sorted.sort((a, b) => a.reference.localeCompare(b.reference, 'fr'))
    if (sortBy === 'recent') sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return sorted
  }, [orders, search, supplierFilter, sortBy])

  const loadOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const q = params.toString()
      const data = await procurementApiRequest<ProcurementPurchaseOrder[]>(`/procurement/orders/${q ? `?${q}` : ''}`)
      setOrders(data)
    } catch (error) {
      notify.error('Chargement bons impossible', error instanceof Error ? error.message : undefined)
    }
  }, [statusFilter])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  )

  const supplierFilterOptions = useMemo(
    () => [{ value: '', label: 'Tous les fournisseurs' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
    [suppliers]
  )

  const sourceRequestOptions = useMemo(() => {
    const head = { value: '', label: 'Sans demande source' }
    const eligible = requests.filter((req) => {
      if (orderId && req.linked_purchase_order_id === orderId) return true
      if (req.status !== 'approved') return false
      return !req.linked_purchase_order_id
    })
    const opts = eligible.map((req) => ({
      value: req.id,
      label: `${req.reference} — ${req.title}`,
      keywords: req.title,
    }))
    return [head, ...opts]
  }, [requests, orderId])

  const refreshDetail = useCallback(async (id: string) => {
    const detail = await procurementApiRequest<ProcurementPurchaseOrder>(`/procurement/orders/${id}/`)
    setReference(detail.reference)
    setSupplierId(detail.supplier)
    setStatus(detail.status)
    setNotes(detail.notes || '')
    setExpectedDelivery(detail.expected_delivery || '')
    setSourceRequestId(detail.source_request || '')
    setTotalAmount(detail.total_amount || '0')
    setLines(detail.lines || [])
  }, [])

  const openCreate = () => {
    setOrderId(null)
    setReference('')
    setSupplierId(suppliers[0]?.id || '')
    setStatus('draft')
    setNotes('')
    setExpectedDelivery('')
    setSourceRequestId('')
    setTotalAmount('0')
    setLines([])
    setLineDesc('')
    setLineQty('1')
    setLinePrice('0')
    setDialogOpen(true)
  }

  const openEdit = async (item: ProcurementPurchaseOrder) => {
    setOrderId(item.id)
    setDialogOpen(true)
    try {
      await refreshDetail(item.id)
    } catch (error) {
      notify.error('Chargement bon impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const saveHeader = async () => {
    try {
      if (!supplierId) {
        notify.error('Choisissez un fournisseur')
        return
      }
      const payload: Record<string, unknown> = {
        supplier: supplierId,
        status,
        notes,
        expected_delivery: expectedDelivery.trim() || null,
        source_request: sourceRequestId || null,
        import_request_lines: true,
      }
      if (orderId) {
        await procurementApiRequest(`/procurement/orders/${orderId}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        await refreshDetail(orderId)
        await loadOrders()
        await loadRefs()
        notify.success('Bon enregistre')
      } else {
        const created = await procurementApiRequest<ProcurementPurchaseOrder>('/procurement/orders/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setOrderId(created.id)
        await refreshDetail(created.id)
        await loadOrders()
        await loadRefs()
        notify.success('Bon cree')
      }
    } catch (error) {
      notify.error('Erreur enregistrement', error instanceof Error ? error.message : undefined)
    }
  }

  const addLine = async () => {
    if (!orderId) {
      notify.error('Enregistrez le bon avant d\'ajouter des lignes')
      return
    }
    if (!lineDesc.trim()) {
      notify.error('Description ligne obligatoire')
      return
    }
    try {
      await procurementApiRequest('/procurement/order-lines/', {
        method: 'POST',
        body: JSON.stringify({
          order: orderId,
          description: lineDesc.trim(),
          quantity: lineQty,
          unit_price: linePrice,
        }),
      })
      setLineDesc('')
      setLineQty('1')
      setLinePrice('0')
      await refreshDetail(orderId)
      await loadOrders()
      notify.success('Ligne ajoutee')
    } catch (error) {
      notify.error('Erreur ligne', error instanceof Error ? error.message : undefined)
    }
  }

  const confirmRemoveOrderLine = async () => {
    if (!orderId || !orderLineDeleteId) return
    try {
      await procurementApiRequest(`/procurement/order-lines/${orderLineDeleteId}/`, { method: 'DELETE' })
      setOrderLineDeleteId(null)
      await refreshDetail(orderId)
      await loadOrders()
      notify.success('Ligne supprimee')
    } catch (error) {
      notify.error('Suppression ligne impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const openEditOrderLine = (ln: ProcurementOrderLine) => {
    setEditLineId(ln.id)
    setEditLineDesc(ln.description)
    setEditLineQty(ln.quantity)
    setEditLinePrice(ln.unit_price)
    setEditLineOpen(true)
  }

  const saveEditOrderLine = async () => {
    if (!editLineDesc.trim()) {
      notify.error('Description ligne obligatoire')
      return
    }
    try {
      await procurementApiRequest(`/procurement/order-lines/${editLineId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: editLineDesc.trim(),
          quantity: editLineQty,
          unit_price: editLinePrice,
        }),
      })
      setEditLineOpen(false)
      if (orderId) await refreshDetail(orderId)
      await loadOrders()
      notify.success('Ligne mise a jour')
    } catch (error) {
      notify.error('Mise a jour ligne impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const deleteOrder = async () => {
    if (!deleteOrderId) return
    try {
      await procurementApiRequest(`/procurement/orders/${deleteOrderId}/`, { method: 'DELETE' })
      setDeleteOrderOpen(false)
      setDeleteOrderId(null)
      if (orderId === deleteOrderId) {
        setDialogOpen(false)
        setOrderId(null)
      }
      await loadOrders()
      await loadRefs()
      notify.success('Bon supprime')
    } catch (error) {
      notify.error('Suppression bon impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const totalItems = filteredOrders.length
  const paged = filteredOrders.slice((page - 1) * pageSize, page * pageSize)

  const deleteOrderSummary = useMemo(() => {
    if (!deleteOrderId) return ''
    const o = orders.find((x) => x.id === deleteOrderId)
    return o ? `${o.reference} — ${o.supplier_name}` : ''
  }, [deleteOrderId, orders])

  const orderLineDeleteSummary = useMemo(() => {
    if (!orderLineDeleteId) return ''
    const ln = lines.find((l) => l.id === orderLineDeleteId)
    return ln ? `${ln.description} (${ln.quantity} × ${ln.unit_price})` : ''
  }, [orderLineDeleteId, lines])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col space-y-4 overflow-hidden p-4 md:p-6">
      <ProcurementSubnav />
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bons de commande fournisseur</CardTitle>
          <Button onClick={openCreate} disabled={!suppliers.length}>
            Nouveau bon
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Rechercher (reference, fournisseur...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <SearchableSelect
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
              options={ORDER_STATUS_FILTER}
              placeholder="Filtrer statut"
            />
            <SearchableSelect
              value={supplierFilter}
              onChange={(v) => {
                setSupplierFilter(v)
                setPage(1)
              }}
              options={supplierFilterOptions}
              placeholder="Fournisseur"
            />
            <SearchableSelect
              value={sortBy}
              onChange={(v) => {
                setSortBy(v as 'recent' | 'ref_asc')
                setPage(1)
              }}
              options={[
                { value: 'recent', label: 'Tri: Plus recents' },
                { value: 'ref_asc', label: 'Tri: Reference A-Z' },
              ]}
              placeholder="Tri"
            />
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {paged.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border bg-card/30 p-3 ${purchaseOrderListRowClass(item.status)}`}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openEdit(item)}>
                  <p className="font-medium">
                    {item.reference} — {item.supplier_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Total {item.total_amount} • {item.source_request_reference || 'Sans demande source'}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <PurchaseOrderStatusBadge status={item.status} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="px-2" aria-label="Plus d'actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void openEdit(item)}>Ouvrir</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeleteOrderId(item.id)
                          setDeleteOrderOpen(true)
                        }}
                      >
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {!filteredOrders.length && <p className="text-sm text-muted-foreground">Aucun bon.</p>}
          </div>
          <DataPagination
            totalItems={totalItems}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <DialogTitle className="m-0">{orderId ? `Bon ${reference}` : 'Nouveau bon de commande'}</DialogTitle>
              {orderId ? <PurchaseOrderStatusBadge status={status} /> : null}
            </div>
            <DialogDescription>
              {orderId
                ? "Modifiez l'entete, le fournisseur, la demande source et les lignes. La suppression du bon est irreversible."
                : 'Choisissez un fournisseur puis enregistrez pour ajouter des lignes ou lier une demande approuvee.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {orderId ? (
              <p className="text-xs text-muted-foreground">
                Référence: {reference} • Total {totalAmount}
              </p>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Fournisseur</Label>
                <SearchableSelect
                  value={supplierId}
                  onChange={setSupplierId}
                  options={supplierOptions}
                  placeholder="Choisir un fournisseur"
                  disabled={!supplierOptions.length}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label>Statut</Label>
                  <PurchaseOrderStatusBadge status={status} />
                </div>
                <SearchableSelect
                  value={status}
                  onChange={(v) => setStatus(v as ProcurementOrderStatus)}
                  options={ORDER_STATUS_FORM.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="Statut"
                />
              </div>
              <div>
                <Label>Livraison prevue</Label>
                <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Demande source (optionnel)</Label>
                <SearchableSelect
                  value={sourceRequestId}
                  onChange={setSourceRequestId}
                  options={sourceRequestOptions}
                  placeholder="Lier une demande approuvee"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Seules les demandes au statut Approuvee et sans autre bon peuvent etre choisies. A
                  l&apos;enregistrement, les lignes de la demande remplacent les lignes du bon et la demande passe en
                  Transformee.
                </p>
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button type="button" onClick={() => void saveHeader()}>
                Enregistrer l&apos;entete
              </Button>
            </DialogFooter>
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Lignes</p>
              <div className="mb-3 grid gap-2 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Input value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} disabled={!orderId} />
                </div>
                <div>
                  <Label>Quantite</Label>
                  <Input value={lineQty} onChange={(e) => setLineQty(e.target.value)} disabled={!orderId} />
                </div>
                <div>
                  <Label>Prix unit.</Label>
                  <Input value={linePrice} onChange={(e) => setLinePrice(e.target.value)} disabled={!orderId} />
                </div>
                <div className="md:col-span-4">
                  <Button type="button" variant="secondary" onClick={() => void addLine()} disabled={!orderId}>
                    Ajouter la ligne
                  </Button>
                </div>
              </div>
              <div className={`max-h-48 space-y-2 overflow-y-auto ${procurementDetailLinesPanelClass('order', status)}`}>
                {lines.map((ln) => (
                  <div key={ln.id} className="flex items-start justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0 last:pb-0 first:pt-0">
                    <div className="flex min-w-0 flex-1 gap-2">
                      <ProcurementLineDot />
                      <span className="min-w-0 flex-1 leading-snug">
                        {ln.description} — {ln.quantity} × {ln.unit_price} = {ln.line_total}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEditOrderLine(ln)}>
                        Modifier
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOrderLineDeleteId(ln.id)}>
                        Retirer
                      </Button>
                    </div>
                  </div>
                ))}
                {!lines.length && <p className="text-xs text-muted-foreground">Aucune ligne.</p>}
              </div>
            </div>
          </div>
          <DialogFooter className={`gap-2 ${orderId ? 'sm:justify-between' : ''}`}>
            {orderId ? (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => {
                  setDeleteOrderId(orderId)
                  setDeleteOrderOpen(true)
                }}
              >
                Supprimer le bon
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOrderOpen} onOpenChange={setDeleteOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le bon de commande</DialogTitle>
            <DialogDescription>
              {deleteOrderSummary
                ? `Supprimer definitivement « ${deleteOrderSummary} » ? Les lignes seront supprimees. Une demande source liee pourra repasser en approuvee si plus aucun bon ne la reference.`
                : 'Supprimer ce bon ?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOrderOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void deleteOrder()}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(orderLineDeleteId)} onOpenChange={(open) => !open && setOrderLineDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer la ligne</DialogTitle>
            <DialogDescription>
              {orderLineDeleteSummary
                ? `Retirer la ligne « ${orderLineDeleteSummary} » de ce bon ?`
                : 'Retirer cette ligne ?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderLineDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void confirmRemoveOrderLine()}>
              Retirer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLineOpen} onOpenChange={setEditLineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la ligne</DialogTitle>
            <DialogDescription>Ajustez la description, la quantite ou le prix unitaire.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Description</Label>
              <Input value={editLineDesc} onChange={(e) => setEditLineDesc(e.target.value)} />
            </div>
            <div>
              <Label>Quantite</Label>
              <Input value={editLineQty} onChange={(e) => setEditLineQty(e.target.value)} />
            </div>
            <div>
              <Label>Prix unit.</Label>
              <Input value={editLinePrice} onChange={(e) => setEditLinePrice(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLineOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveEditOrderLine()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
