'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Hash } from 'lucide-react'

import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { InventoryPagination } from '../_components/inventory-pagination'
import { InventorySubnav } from '../_components/inventory-subnav'
import {
  inventoryApiRequest,
  type InventoryAssetReference,
  type InventoryCategory,
} from '../_lib/inventory-api'

export default function InventoryAssetsPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [assets, setAssets] = useState<InventoryAssetReference[]>([])

  const loadData = useCallback(async () => {
    try {
      const [categoriesData, assetsData] = await Promise.all([
        inventoryApiRequest<InventoryCategory[]>('/inventory/categories/'),
        inventoryApiRequest<InventoryAssetReference[]>('/inventory/assets/'),
      ])
      setCategories(categoriesData)
      setAssets(assetsData)
    } catch (error) {
      notify.error('Chargement des series impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const categoryOptions = useMemo<SearchableOption[]>(
    () => [{ value: '', label: 'Toutes categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories]
  )

  const filteredAssets = useMemo(() => {
    const searchValue = search.trim().toLowerCase()
    return assets.filter((asset) => {
      if (categoryId && asset.categoryId !== categoryId) return false
      if (!searchValue) return true
      return (
        asset.serialNumber.toLowerCase().includes(searchValue)
        || asset.itemName.toLowerCase().includes(searchValue)
        || asset.itemSku.toLowerCase().includes(searchValue)
        || (asset.categoryName || '').toLowerCase().includes(searchValue)
      )
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

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:p-5">
      <InventorySubnav />

      <Card className="shrink-0">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4" />
            Series / references par categorie
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
              <p className="text-sm text-muted-foreground">Aucune reference.</p>
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
                    <Badge variant={asset.status === 'out' ? 'destructive' : asset.status === 'assigned' ? 'default' : 'secondary'}>
                      {asset.status === 'in_stock' ? 'En stock' : asset.status === 'assigned' ? 'Affecte' : 'Sorti'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{asset.assignedToName || 'Non affecte'}</span>
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
    </div>
  )
}
