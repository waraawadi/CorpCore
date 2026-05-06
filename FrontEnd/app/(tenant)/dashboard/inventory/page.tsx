'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRightLeft, Boxes, Package, Tags } from 'lucide-react'

import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InventorySubnav } from './_components/inventory-subnav'
import {
  inventoryApiRequest,
  isLowStock,
  type InventoryItem,
  type InventoryMovement,
  type InventorySummary,
} from './_lib/inventory-api'

export default function InventoryOverviewPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, itemsData, movementsData] = await Promise.all([
        inventoryApiRequest<InventorySummary>('/inventory/items/summary/'),
        inventoryApiRequest<InventoryItem[]>('/inventory/items/'),
        inventoryApiRequest<InventoryMovement[]>('/inventory/movements/'),
      ])
      setSummary(summaryData)
      setItems(itemsData)
      setMovements(movementsData)
    } catch (error) {
      notify.error('Chargement inventaire impossible', error instanceof Error ? error.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const lowStock = useMemo(() => items.filter(isLowStock), [items])
  const recentMovements = useMemo(() => movements.slice(0, 8), [movements])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:p-5">
      <InventorySubnav />

      <Card className="shrink-0 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Boxes className="h-4 w-4 text-primary" />
            Inventaire
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => void loadData()} disabled={loading}>
            Actualiser
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 pt-0 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/60 bg-background/80">
            <CardContent className="space-y-0.5 px-2 py-1">
              <p className="text-xs text-muted-foreground">Articles</p>
              <p className="text-lg font-semibold leading-none">{summary?.itemsCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-background/80">
            <CardContent className="space-y-0.5 px-2 py-1">
              <p className="text-xs text-muted-foreground">Articles actifs</p>
              <p className="text-lg font-semibold leading-none">{summary?.activeItemsCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-background/80">
            <CardContent className="space-y-0.5 px-2 py-1">
              <p className="text-xs text-muted-foreground">Stock total</p>
              <p className="text-lg font-semibold leading-none">{summary?.totalQuantity ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="space-y-0.5 px-2 py-1">
              <p className="text-xs text-muted-foreground">Alertes stock faible</p>
              <p className="text-lg font-semibold leading-none text-destructive">{summary?.lowStockCount ?? 0}</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertes prioritaires
              </CardTitle>
              <Link href="/dashboard/inventory/alerts" className="text-xs text-primary hover:underline">
                Voir tout
              </Link>
            </div>
          </CardHeader>
          <CardContent className="h-full space-y-1.5 overflow-auto pt-0">
            {!lowStock.length ? (
              <p className="text-sm text-muted-foreground">Aucune alerte de stock.</p>
            ) : (
              lowStock.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                  <p className="font-medium text-destructive">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantityOnHand} {item.unit} (seuil {item.reorderLevel})
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4" />
                Derniers mouvements
              </CardTitle>
              <Link href="/dashboard/inventory/movements" className="text-xs text-primary hover:underline">
                Voir tout
              </Link>
            </div>
          </CardHeader>
          <CardContent className="h-full space-y-1.5 overflow-auto pt-0">
            {!recentMovements.length ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement.</p>
            ) : (
              recentMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                  <div>
                    <p className="text-sm font-medium">{movement.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {movement.locationName || 'Sans emplacement'} • {new Date(movement.occurred_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Badge variant={movement.movementType === 'out' ? 'destructive' : 'secondary'}>
                    {movement.quantity}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid shrink-0 gap-2 md:grid-cols-3">
        <Link href="/dashboard/inventory/items" className="rounded-lg border border-border/60 bg-card p-2.5 text-sm hover:bg-accent">
          <div className="flex items-center gap-2 font-medium">
            <Package className="h-4 w-4" />
            Articles
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Catalogue et creation des articles.</p>
        </Link>
        <Link href="/dashboard/inventory/references" className="rounded-lg border border-border/60 bg-card p-2.5 text-sm hover:bg-accent">
          <div className="flex items-center gap-2 font-medium">
            <Tags className="h-4 w-4" />
            References
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Categories et emplacements.</p>
        </Link>
        <Link href="/dashboard/inventory/movements" className="rounded-lg border border-border/60 bg-card p-2.5 text-sm hover:bg-accent">
          <div className="flex items-center gap-2 font-medium">
            <ArrowRightLeft className="h-4 w-4" />
            Mouvements
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Entrees, sorties et ajustements.</p>
        </Link>
      </div>
    </div>
  )
}
