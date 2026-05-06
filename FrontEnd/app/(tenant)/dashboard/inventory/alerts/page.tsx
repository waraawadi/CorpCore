'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InventoryPagination } from '../_components/inventory-pagination'
import { InventorySubnav } from '../_components/inventory-subnav'
import { inventoryApiRequest, isLowStock, type InventoryItem } from '../_lib/inventory-api'

export default function InventoryAlertsPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const loadData = useCallback(async () => {
    try {
      const data = await inventoryApiRequest<InventoryItem[]>('/inventory/items/')
      setItems(data)
    } catch (error) {
      notify.error('Chargement alertes impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const lowStockItems = useMemo(() => items.filter(isLowStock), [items])
  const totalPages = Math.max(1, Math.ceil(lowStockItems.length / pageSize))
  const paginatedLowStockItems = useMemo(
    () => lowStockItems.slice((page - 1) * pageSize, page * pageSize),
    [lowStockItems, page, pageSize]
  )

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:p-5">
      <InventorySubnav />

      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Alertes de stock faible
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full min-h-0 flex-col pt-0">
          <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
            {!lowStockItems.length ? (
              <p className="text-sm text-muted-foreground">Aucune alerte de stock.</p>
            ) : (
              paginatedLowStockItems.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                  <div>
                    <p className="font-medium text-destructive">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      {item.quantityOnHand} {item.unit}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Seuil {item.reorderLevel}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {!!lowStockItems.length ? (
            <InventoryPagination
              totalItems={lowStockItems.length}
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
