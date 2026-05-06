'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, UserCheck } from 'lucide-react'

import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { InventoryPagination } from '../_components/inventory-pagination'
import { InventorySubnav } from '../_components/inventory-subnav'
import {
  inventoryApiRequest,
  type InventoryAssetReference,
  type InventoryCategory,
} from '../_lib/inventory-api'

type HrUserOption = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
}

export default function InventoryAssignmentsPage() {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [assets, setAssets] = useState<InventoryAssetReference[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [users, setUsers] = useState<HrUserOption[]>([])
  const [selectedAsset, setSelectedAsset] = useState<InventoryAssetReference | null>(null)
  const [selectedAssigneeAsset, setSelectedAssigneeAsset] = useState<InventoryAssetReference | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assignNote, setAssignNote] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [assetsData, usersData, categoriesData] = await Promise.all([
        inventoryApiRequest<InventoryAssetReference[]>('/inventory/assets/'),
        inventoryApiRequest<HrUserOption[]>('/hr/users/'),
        inventoryApiRequest<InventoryCategory[]>('/inventory/categories/'),
      ])
      setAssets(assetsData.filter((asset) => asset.status !== 'out'))
      setUsers(usersData)
      setCategories(categoriesData)
    } catch (error) {
      notify.error('Chargement affectations impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const userOptions = useMemo<SearchableOption[]>(
    () =>
      users.map((user) => ({
        value: String(user.id),
        label: user.full_name || user.username,
        keywords: user.email,
      })),
    [users]
  )

  const categoryOptions = useMemo<SearchableOption[]>(
    () => [{ value: '', label: 'Toutes categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories]
  )

  const filteredAssets = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return assets
      .filter((asset) => {
        if (categoryId && asset.categoryId !== categoryId) return false
        if (!needle) return true
        return (
          asset.serialNumber.toLowerCase().includes(needle)
          || asset.itemName.toLowerCase().includes(needle)
          || asset.itemSku.toLowerCase().includes(needle)
          || (asset.categoryName || '').toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => {
        const catA = (a.categoryName || '').toLowerCase()
        const catB = (b.categoryName || '').toLowerCase()
        if (catA !== catB) return catA.localeCompare(catB, 'fr')
        const itemA = a.itemName.toLowerCase()
        const itemB = b.itemName.toLowerCase()
        if (itemA !== itemB) return itemA.localeCompare(itemB, 'fr')
        return a.serialNumber.localeCompare(b.serialNumber, 'fr')
      })
  }, [assets, categoryId, search])

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize))
  const paginatedAssets = useMemo(
    () => filteredAssets.slice((page - 1) * pageSize, page * pageSize),
    [filteredAssets, page, pageSize]
  )

  useEffect(() => {
    setPage(1)
  }, [search, categoryId])

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const openAssignDialog = (asset: InventoryAssetReference) => {
    setSelectedAsset(asset)
    setSelectedUserId('')
    setAssignNote('')
    setAssignDialogOpen(true)
  }

  const openAssigneeDialog = (asset: InventoryAssetReference) => {
    setSelectedAssigneeAsset(asset)
    setAssigneeDialogOpen(true)
  }
  const selectedAssigneeUser = useMemo(
    () => users.find((user) => user.id === (selectedAssigneeAsset?.assignedTo || -1)) || null,
    [selectedAssigneeAsset?.assignedTo, users]
  )

  const handleAssign = async () => {
    if (!selectedAsset || !selectedUserId) {
      notify.warning('Selectionnez un employe')
      return
    }
    setAssigning(true)
    try {
      await inventoryApiRequest<InventoryAssetReference>(`/inventory/assets/${selectedAsset.id}/assign/`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: Number(selectedUserId),
          note: assignNote.trim(),
        }),
      })
      notify.success('Article affecte au personnel')
      setAssignDialogOpen(false)
      setSelectedAsset(null)
      await loadData()
    } catch (error) {
      notify.error('Affectation impossible', error instanceof Error ? error.message : undefined)
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async (asset: InventoryAssetReference) => {
    try {
      await inventoryApiRequest<InventoryAssetReference>(`/inventory/assets/${asset.id}/unassign/`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      notify.success('Affectation retiree')
      await loadData()
    } catch (error) {
      notify.error("Retrait d'affectation impossible", error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:p-5">
      <InventorySubnav />

      <Card className="shrink-0">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" />
            Affectation des articles au personnel
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pt-0 md:grid-cols-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher serie, article, SKU..."
          />
          <SearchableSelect
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder="Filtrer categorie"
            emptyMessage="Aucune categorie"
          />
        </CardContent>
      </Card>

      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardContent className="flex h-full min-h-0 flex-col p-3">
          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
            {!filteredAssets.length ? (
              <p className="text-sm text-muted-foreground">Aucune reference disponible pour affectation.</p>
            ) : (
              paginatedAssets.map((asset) => (
                <div key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                  <div>
                    <p className="font-medium">{asset.serialNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.itemName} ({asset.itemSku}) • {asset.categoryName || 'Sans categorie'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={asset.status === 'assigned' ? 'default' : 'secondary'}>
                      {asset.status === 'assigned' ? 'Affecte' : 'En stock'}
                    </Badge>
                    {asset.status === 'assigned' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openAssigneeDialog(asset)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Voir personne
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleUnassign(asset)}>
                          Retirer
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => openAssignDialog(asset)}>
                        Affecter
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {!!filteredAssets.length ? (
            <InventoryPagination
              totalItems={filteredAssets.length}
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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Affecter la reference</DialogTitle>
            <DialogDescription>
              {selectedAsset ? `${selectedAsset.serialNumber} • ${selectedAsset.itemName}` : 'Selection de reference'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SearchableSelect
              value={selectedUserId}
              onChange={setSelectedUserId}
              options={userOptions}
              placeholder="Selectionner un employe"
              emptyMessage="Aucun employe"
            />
            <Textarea
              rows={3}
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="Note d'affectation (optionnel)"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void handleAssign()} disabled={assigning}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Details d&apos;affectation</DialogTitle>
            <DialogDescription>
              {selectedAssigneeAsset ? `${selectedAssigneeAsset.serialNumber} • ${selectedAssigneeAsset.itemName}` : 'Affectation'}
            </DialogDescription>
          </DialogHeader>
          {selectedAssigneeAsset ? (
            <div className="space-y-3 rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
                <span className="text-muted-foreground">Employe</span>
                <span className="font-medium">{selectedAssigneeAsset.assignedToName || 'Non renseigne'}</span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
                <span className="text-muted-foreground">Email</span>
                <span>{selectedAssigneeUser?.email || 'Non renseigne'}</span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
                <span className="text-muted-foreground">Identifiant</span>
                <span>{selectedAssigneeUser?.username || 'Non renseigne'}</span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
                <span className="text-muted-foreground">Date affectation</span>
                <span>{selectedAssigneeAsset.assigned_at ? new Date(selectedAssigneeAsset.assigned_at).toLocaleString('fr-FR') : 'Non renseignee'}</span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
                <span className="text-muted-foreground">Article</span>
                <span>{selectedAssigneeAsset.itemName} ({selectedAssigneeAsset.itemSku})</span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
                <span className="text-muted-foreground">Categorie</span>
                <span>{selectedAssigneeAsset.categoryName || 'Sans categorie'}</span>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Note</p>
                <p className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs">
                  {selectedAssigneeAsset.note || 'Aucune note'}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssigneeDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
