'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PackagePlus, Pencil, Trash2 } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { InventoryPagination } from '../_components/inventory-pagination'
import { InventorySubnav } from '../_components/inventory-subnav'
import { inventoryApiRequest, isLowStock, type InventoryCategory, type InventoryItem } from '../_lib/inventory-api'

export default function InventoryItemsPage() {
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])

  const [form, setForm] = useState({
    name: '',
    sku: '',
    categoryId: '',
    unit: 'unite',
    reorderLevel: '0',
    description: '',
  })

  const loadData = useCallback(async () => {
    try {
      const [itemsData, categoriesData] = await Promise.all([
        inventoryApiRequest<InventoryItem[]>('/inventory/items/'),
        inventoryApiRequest<InventoryCategory[]>('/inventory/categories/'),
      ])
      setItems(itemsData)
      setCategories(categoriesData)
    } catch (error) {
      notify.error('Chargement articles impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const categoryOptions = useMemo<SearchableOption[]>(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  )
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  )

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim() || !form.sku.trim()) {
      notify.warning('Nom et SKU obligatoires')
      return
    }
    setSaving(true)
    try {
      const isEdit = Boolean(editingItem)
      const endpoint = isEdit ? `/inventory/items/${editingItem?.id}/` : '/inventory/items/'
      await inventoryApiRequest<InventoryItem>(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim(),
          description: form.description.trim(),
          categoryId: form.categoryId || null,
          unit: form.unit.trim() || 'unite',
          reorderLevel: form.reorderLevel || '0',
          isActive: true,
        }),
      })
      notify.success(isEdit ? 'Article modifie' : 'Article cree')
      setDialogOpen(false)
      setEditingItem(null)
      setForm({ name: '', sku: '', categoryId: '', unit: 'unite', reorderLevel: '0', description: '' })
      await loadData()
    } catch (error) {
      notify.error(
        editingItem ? "Modification de l'article impossible" : "Creation de l'article impossible",
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setSaving(false)
    }
  }

  const openCreateDialog = () => {
    setEditingItem(null)
    setForm({ name: '', sku: '', categoryId: '', unit: 'unite', reorderLevel: '0', description: '' })
    setDialogOpen(true)
  }

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      sku: item.sku,
      categoryId: item.categoryId || '',
      unit: item.unit,
      reorderLevel: item.reorderLevel,
      description: item.description || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await inventoryApiRequest<void>(`/inventory/items/${deletingItem.id}/`, { method: 'DELETE' })
      notify.success('Article supprime')
      setDeletingItem(null)
      await loadData()
    } catch (error) {
      notify.error("Suppression de l'article impossible", error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:p-5">
      <InventorySubnav />

      <Card className="shrink-0">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Catalogue des articles</CardTitle>
          <Button size="sm" onClick={openCreateDialog}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Nouvel article
          </Button>
        </CardHeader>
      </Card>

      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardContent className="flex h-full min-h-0 flex-col p-3">
          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
            {!items.length ? (
              <p className="text-sm text-muted-foreground">Aucun article.</p>
            ) : (
              paginatedItems.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku} {item.categoryName ? `• ${item.categoryName}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isLowStock(item) ? 'destructive' : 'secondary'}>
                      {item.quantityOnHand} {item.unit}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Seuil {item.reorderLevel}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingItem(item)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {!!items.length ? (
            <InventoryPagination
              totalItems={items.length}
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
            <DialogTitle>{editingItem ? 'Modifier article' : 'Nouvel article'}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Mise a jour de l'article inventaire." : "Creation d'article dans l'inventaire."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Categorie</Label>
              <SearchableSelect
                value={form.categoryId}
                onChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
                options={categoryOptions}
                placeholder="Sans categorie"
                emptyMessage="Aucune categorie"
              />
            </div>
            <div className="space-y-2">
              <Label>Unite</Label>
              <Input value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Seuil de reappro</Label>
              <Input
                type="number"
                step="0.001"
                value={form.reorderLevel}
                onChange={(e) => setForm((prev) => ({ ...prev, reorderLevel: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null) }}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {editingItem ? 'Enregistrer' : "Creer l'article"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingItem)} onOpenChange={(open) => { if (!open) setDeletingItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera l&apos;article et ses mouvements associes.
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
