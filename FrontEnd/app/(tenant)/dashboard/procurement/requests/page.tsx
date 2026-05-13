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
  PurchaseRequestStatusBadge,
  PURCHASE_REQUEST_STATUS_LABEL,
  ProcurementLineDot,
  purchaseRequestListRowClass,
} from '../_components/procurement-status'
import { ProcurementSubnav } from '../_components/procurement-subnav'
import {
  procurementApiRequest,
  type ProcurementPurchaseRequest,
  type ProcurementRequestLine,
  type ProcurementRequestStatus,
} from '../_lib/procurement-api'

const REQUEST_STATUS_FILTER: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  ...(['draft', 'submitted', 'approved', 'rejected', 'fulfilled'] as const).map((value) => ({
    value,
    label: PURCHASE_REQUEST_STATUS_LABEL[value],
  })),
]

const REQUEST_STATUS_FORM: { value: ProcurementRequestStatus; label: string }[] = (
  ['draft', 'submitted', 'approved', 'rejected', 'fulfilled'] as const
).map((value) => ({ value, label: PURCHASE_REQUEST_STATUS_LABEL[value] }))

export default function ProcurementRequestsPage() {
  const [requests, setRequests] = useState<ProcurementPurchaseRequest[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<ProcurementRequestStatus>('draft')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<ProcurementRequestLine[]>([])
  const [reference, setReference] = useState('')
  const [requestedByLabel, setRequestedByLabel] = useState('')
  const [lineDesc, setLineDesc] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [linePrice, setLinePrice] = useState('0')
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false)
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null)
  const [requestLineDeleteId, setRequestLineDeleteId] = useState<string | null>(null)
  const [editLineOpen, setEditLineOpen] = useState(false)
  const [editLineId, setEditLineId] = useState('')
  const [editLineDesc, setEditLineDesc] = useState('')
  const [editLineQty, setEditLineQty] = useState('1')
  const [editLinePrice, setEditLinePrice] = useState('0')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'ref_asc'>('recent')

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const q = params.toString()
      const data = await procurementApiRequest<ProcurementPurchaseRequest[]>(
        `/procurement/requests/${q ? `?${q}` : ''}`
      )
      setRequests(data)
    } catch (error) {
      notify.error('Chargement demandes impossible', error instanceof Error ? error.message : undefined)
    }
  }, [statusFilter])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const refreshDetail = useCallback(async (id: string) => {
    const detail = await procurementApiRequest<ProcurementPurchaseRequest>(`/procurement/requests/${id}/`)
    setReference(detail.reference)
    setTitle(detail.title)
    setStatus(detail.status)
    setNotes(detail.notes || '')
    setLines(detail.lines || [])
    setRequestedByLabel(detail.requested_by_label || '')
  }, [])

  const openCreate = () => {
    setRequestId(null)
    setReference('')
    setTitle('')
    setStatus('draft')
    setNotes('')
    setLines([])
    setRequestedByLabel('')
    setLineDesc('')
    setLineQty('1')
    setLinePrice('0')
    setDialogOpen(true)
  }

  const openEdit = async (item: ProcurementPurchaseRequest) => {
    setRequestId(item.id)
    setDialogOpen(true)
    try {
      await refreshDetail(item.id)
    } catch (error) {
      notify.error('Chargement demande impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const saveHeader = async () => {
    try {
      if (!title.trim()) {
        notify.error('Le titre est obligatoire')
        return
      }
      if (requestId) {
        await procurementApiRequest(`/procurement/requests/${requestId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ title, status, notes }),
        })
        await refreshDetail(requestId)
        await loadList()
        notify.success('Demande enregistree')
      } else {
        const created = await procurementApiRequest<ProcurementPurchaseRequest>('/procurement/requests/', {
          method: 'POST',
          body: JSON.stringify({ title, status, notes }),
        })
        setRequestId(created.id)
        await refreshDetail(created.id)
        await loadList()
        notify.success('Demande creee')
      }
    } catch (error) {
      notify.error('Erreur enregistrement', error instanceof Error ? error.message : undefined)
    }
  }

  const addLine = async () => {
    if (!requestId) {
      notify.error('Enregistrez la demande avant d\'ajouter des lignes')
      return
    }
    if (!lineDesc.trim()) {
      notify.error('Description ligne obligatoire')
      return
    }
    try {
      await procurementApiRequest('/procurement/request-lines/', {
        method: 'POST',
        body: JSON.stringify({
          request: requestId,
          description: lineDesc.trim(),
          quantity: lineQty,
          unit_price: linePrice,
        }),
      })
      setLineDesc('')
      setLineQty('1')
      setLinePrice('0')
      await refreshDetail(requestId)
      await loadList()
      notify.success('Ligne ajoutee')
    } catch (error) {
      notify.error('Erreur ligne', error instanceof Error ? error.message : undefined)
    }
  }

  const confirmRemoveRequestLine = async () => {
    if (!requestId || !requestLineDeleteId) return
    try {
      await procurementApiRequest(`/procurement/request-lines/${requestLineDeleteId}/`, { method: 'DELETE' })
      setRequestLineDeleteId(null)
      await refreshDetail(requestId)
      await loadList()
      notify.success('Ligne supprimee')
    } catch (error) {
      notify.error('Suppression ligne impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const openEditRequestLine = (ln: ProcurementRequestLine) => {
    setEditLineId(ln.id)
    setEditLineDesc(ln.description)
    setEditLineQty(ln.quantity)
    setEditLinePrice(ln.unit_price)
    setEditLineOpen(true)
  }

  const saveEditRequestLine = async () => {
    if (!editLineDesc.trim()) {
      notify.error('Description ligne obligatoire')
      return
    }
    try {
      await procurementApiRequest(`/procurement/request-lines/${editLineId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: editLineDesc.trim(),
          quantity: editLineQty,
          unit_price: editLinePrice,
        }),
      })
      setEditLineOpen(false)
      if (requestId) await refreshDetail(requestId)
      await loadList()
      notify.success('Ligne mise a jour')
    } catch (error) {
      notify.error('Mise a jour ligne impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const deleteRequest = async () => {
    if (!deleteRequestId) return
    try {
      await procurementApiRequest(`/procurement/requests/${deleteRequestId}/`, { method: 'DELETE' })
      setDeleteRequestOpen(false)
      setDeleteRequestId(null)
      if (requestId === deleteRequestId) {
        setDialogOpen(false)
        setRequestId(null)
      }
      await loadList()
      notify.success('Demande supprimee')
    } catch (error) {
      notify.error('Suppression demande impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const base = query
      ? requests.filter((r) => `${r.reference} ${r.title}`.toLowerCase().includes(query))
      : requests
    const sorted = [...base]
    if (sortBy === 'ref_asc') sorted.sort((a, b) => a.reference.localeCompare(b.reference, 'fr'))
    if (sortBy === 'recent') sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return sorted
  }, [requests, search, sortBy])

  const totalItems = filtered.length
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const deleteRequestSummary = useMemo(() => {
    if (!deleteRequestId) return ''
    const r = requests.find((x) => x.id === deleteRequestId)
    return r ? `${r.reference} — ${r.title}` : ''
  }, [deleteRequestId, requests])

  const requestLineDeleteSummary = useMemo(() => {
    if (!requestLineDeleteId) return ''
    const ln = lines.find((l) => l.id === requestLineDeleteId)
    return ln ? `${ln.description} (${ln.quantity} × ${ln.unit_price})` : ''
  }, [requestLineDeleteId, lines])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col space-y-4 overflow-hidden p-4 md:p-6">
      <ProcurementSubnav />
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Demandes d&apos;achat</CardTitle>
          <Button onClick={openCreate}>Nouvelle demande</Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Rechercher (reference, titre...)"
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
              options={REQUEST_STATUS_FILTER}
              placeholder="Filtrer par statut"
            />
            <SearchableSelect
              value={sortBy}
              onChange={(v) => {
                setSortBy(v as 'recent' | 'ref_asc')
                setPage(1)
              }}
              options={[
                { value: 'recent', label: 'Tri: Plus recentes' },
                { value: 'ref_asc', label: 'Tri: Reference A-Z' },
              ]}
              placeholder="Tri"
            />
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {paged.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border bg-card/30 p-3 ${purchaseRequestListRowClass(item.status)}`}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openEdit(item)}>
                  <p className="font-medium">
                    {item.reference} — {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.requested_by_label || 'Demandeur inconnu'}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <PurchaseRequestStatusBadge status={item.status} />
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
                          setDeleteRequestId(item.id)
                          setDeleteRequestOpen(true)
                        }}
                      >
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {!filtered.length && <p className="text-sm text-muted-foreground">Aucune demande.</p>}
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
              <DialogTitle className="m-0">{requestId ? `Demande ${reference}` : 'Nouvelle demande'}</DialogTitle>
              {requestId ? <PurchaseRequestStatusBadge status={status} /> : null}
            </div>
            <DialogDescription>
              {requestId
                ? "Modifiez l'entete et les lignes. La suppression de la demande est irreversible."
                : "Creez une demande puis enregistrez l'entete pour pouvoir ajouter des lignes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {requestId ? (
              <p className="text-xs text-muted-foreground">
                Référence: {reference} • {requestedByLabel || 'Demandeur'}
              </p>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Titre</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label>Statut</Label>
                  <PurchaseRequestStatusBadge status={status} />
                </div>
                <SearchableSelect
                  value={status}
                  onChange={(v) => setStatus(v as ProcurementRequestStatus)}
                  options={REQUEST_STATUS_FORM.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="Statut"
                />
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
                  <Input value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} disabled={!requestId} />
                </div>
                <div>
                  <Label>Quantite</Label>
                  <Input value={lineQty} onChange={(e) => setLineQty(e.target.value)} disabled={!requestId} />
                </div>
                <div>
                  <Label>Prix unit.</Label>
                  <Input value={linePrice} onChange={(e) => setLinePrice(e.target.value)} disabled={!requestId} />
                </div>
                <div className="md:col-span-4">
                  <Button type="button" variant="secondary" onClick={() => void addLine()} disabled={!requestId}>
                    Ajouter la ligne
                  </Button>
                </div>
              </div>
              <div className={`max-h-48 space-y-2 overflow-y-auto ${procurementDetailLinesPanelClass('request', status)}`}>
                {lines.map((ln) => (
                  <div key={ln.id} className="flex items-start justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0 last:pb-0 first:pt-0">
                    <div className="flex min-w-0 flex-1 gap-2">
                      <ProcurementLineDot />
                      <span className="min-w-0 flex-1 leading-snug">
                        {ln.description} — {ln.quantity} × {ln.unit_price} = {ln.line_total}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEditRequestLine(ln)}>
                        Modifier
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRequestLineDeleteId(ln.id)}>
                        Retirer
                      </Button>
                    </div>
                  </div>
                ))}
                {!lines.length && <p className="text-xs text-muted-foreground">Aucune ligne.</p>}
              </div>
            </div>
          </div>
          <DialogFooter className={`gap-2 ${requestId ? 'sm:justify-between' : ''}`}>
            {requestId ? (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => {
                  setDeleteRequestId(requestId)
                  setDeleteRequestOpen(true)
                }}
              >
                Supprimer la demande
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteRequestOpen} onOpenChange={setDeleteRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la demande</DialogTitle>
            <DialogDescription>
              {deleteRequestSummary
                ? `Supprimer definitivement « ${deleteRequestSummary} » ? Les lignes seront supprimees. Les bons de commande lies conserveront une reference videe si la suppression est autorisee.`
                : 'Supprimer cette demande ?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRequestOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void deleteRequest()}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(requestLineDeleteId)} onOpenChange={(open) => !open && setRequestLineDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer la ligne</DialogTitle>
            <DialogDescription>
              {requestLineDeleteSummary
                ? `Retirer la ligne « ${requestLineDeleteSummary} » de cette demande ?`
                : 'Retirer cette ligne ?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestLineDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void confirmRemoveRequestLine()}>
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
            <Button onClick={() => void saveEditRequestLine()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
