'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRightLeft, Pencil, TrendingDown, TrendingUp, Trash2 } from 'lucide-react'

import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { InventoryPagination } from '../_components/inventory-pagination'
import { InventorySubnav } from '../_components/inventory-subnav'
import {
  inventoryApiRequest,
  type InventoryItem,
  type InventoryLocation,
  type InventoryMovement,
} from '../_lib/inventory-api'

export default function InventoryMovementsPage() {
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState<InventoryMovement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<InventoryMovement | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [locations, setLocations] = useState<InventoryLocation[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])

  const [form, setForm] = useState({
    itemId: '',
    locationId: '',
    movementType: 'in',
    quantity: '',
    reference: '',
    note: '',
  })

  const loadData = useCallback(async () => {
    try {
      const [itemsData, locationsData, movementsData] = await Promise.all([
        inventoryApiRequest<InventoryItem[]>('/inventory/items/'),
        inventoryApiRequest<InventoryLocation[]>('/inventory/locations/'),
        inventoryApiRequest<InventoryMovement[]>('/inventory/movements/'),
      ])
      setItems(itemsData)
      setLocations(locationsData)
      setMovements(movementsData)
      setForm((prev) => (prev.itemId || !itemsData.length ? prev : { ...prev, itemId: itemsData[0].id }))
    } catch (error) {
      notify.error('Chargement mouvements impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const itemOptions = useMemo<SearchableOption[]>(
    () => items.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` })),
    [items]
  )
  const locationOptions = useMemo<SearchableOption[]>(
    () => [{ value: '', label: 'Sans emplacement' }, ...locations.map((l) => ({ value: l.id, label: l.name }))],
    [locations]
  )
  const movementTypeOptions: SearchableOption[] = [
    { value: 'in', label: 'Entree' },
    { value: 'out', label: 'Sortie' },
    { value: 'adjustment', label: 'Ajustement (+/-)' },
  ]
  const totalPages = Math.max(1, Math.ceil(movements.length / pageSize))
  const paginatedMovements = useMemo(
    () => movements.slice((page - 1) * pageSize, page * pageSize),
    [movements, page, pageSize]
  )

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.itemId || !form.quantity) {
      notify.warning('Article et quantite obligatoires')
      return
    }
    setSaving(true)
    try {
      const isEdit = Boolean(editingMovement)
      const endpoint = isEdit ? `/inventory/movements/${editingMovement?.id}/` : '/inventory/movements/'
      await inventoryApiRequest<InventoryMovement>(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          itemId: form.itemId,
          locationId: form.locationId || null,
          movementType: form.movementType,
          quantity: form.quantity,
          reference: form.reference.trim(),
          note: form.note.trim(),
        }),
      })
      notify.success(isEdit ? 'Mouvement modifie' : 'Mouvement enregistre')
      setDialogOpen(false)
      setEditingMovement(null)
      setForm((prev) => ({ ...prev, quantity: '', reference: '', note: '' }))
      await loadData()
    } catch (error) {
      notify.error(
        editingMovement ? 'Modification mouvement impossible' : 'Mouvement impossible',
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setSaving(false)
    }
  }

  const openCreateDialog = () => {
    setEditingMovement(null)
    setForm((prev) => ({ ...prev, movementType: 'in', quantity: '', reference: '', note: '' }))
    setDialogOpen(true)
  }

  const openEditDialog = (movement: InventoryMovement) => {
    const fallbackItemId = items.find((item) => item.sku === movement.itemSku)?.id || ''
    setEditingMovement(movement)
    setForm({
      itemId: movement.itemId || fallbackItemId,
      locationId: movement.locationId || '',
      movementType: movement.movementType,
      quantity: movement.quantity,
      reference: movement.reference || '',
      note: movement.note || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingMovement) return
    try {
      await inventoryApiRequest<void>(`/inventory/movements/${deletingMovement.id}/`, { method: 'DELETE' })
      notify.success('Mouvement supprime')
      setDeletingMovement(null)
      await loadData()
    } catch (error) {
      notify.error('Suppression mouvement impossible', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:p-5">
      <InventorySubnav />

      <Card className="shrink-0">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Mouvements de stock</CardTitle>
          <Button size="sm" disabled={!items.length} onClick={openCreateDialog}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Nouveau mouvement
          </Button>
        </CardHeader>
      </Card>

      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardContent className="flex h-full min-h-0 flex-col p-3">
          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
            {!movements.length ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement.</p>
            ) : (
              paginatedMovements.map((movement) => {
                const isIn = movement.movementType === 'in'
                const isOut = movement.movementType === 'out'
                return (
                  <div key={movement.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {movement.itemName} <span className="text-xs text-muted-foreground">({movement.itemSku})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {movement.locationName || 'Sans emplacement'} • {new Date(movement.occurred_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <Badge variant={isIn ? 'default' : isOut ? 'destructive' : 'secondary'}>
                        {isIn ? <TrendingUp className="mr-1 h-3 w-3" /> : null}
                        {isOut ? <TrendingDown className="mr-1 h-3 w-3" /> : null}
                        {movement.quantity}
                      </Badge>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(movement)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingMovement(movement)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {!!movements.length ? (
            <InventoryPagination
              totalItems={movements.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMovement ? 'Modifier mouvement' : 'Nouveau mouvement'}</DialogTitle>
            <DialogDescription>Entree, sortie ou ajustement de stock.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Article</Label>
              <SearchableSelect
                value={form.itemId}
                onChange={(value) => setForm((prev) => ({ ...prev, itemId: value }))}
                options={itemOptions}
                placeholder="Selectionner un article"
                emptyMessage="Aucun article"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <SearchableSelect
                value={form.movementType}
                onChange={(value) => setForm((prev) => ({ ...prev, movementType: value }))}
                options={movementTypeOptions}
                placeholder="Type"
                emptyMessage="Aucun type"
              />
            </div>
            <div className="space-y-2">
              <Label>Quantite</Label>
              <Input
                type="number"
                step="0.001"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Emplacement</Label>
              <SearchableSelect
                value={form.locationId}
                onChange={(value) => setForm((prev) => ({ ...prev, locationId: value }))}
                options={locationOptions}
                placeholder="Sans emplacement"
                emptyMessage="Aucun emplacement"
              />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingMovement(null) }}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {editingMovement ? 'Mettre a jour' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingMovement)} onOpenChange={(open) => { if (!open) setDeletingMovement(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce mouvement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le stock de l&apos;article sera recalcule automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
