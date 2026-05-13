'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPagination } from '@/components/ui/data-pagination'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MoreHorizontal } from 'lucide-react'
import { notify } from '@/lib/notify'
import { SalesSubnav } from '../_components/sales-subnav'
import { getStockMovementLabel } from '../_lib/sales-status'
import {
  salesApiRequest,
  type SalesProduct,
  type SalesStockAlert,
  type SalesStockMovement,
  type SalesStockSummary,
} from '../_lib/sales-api'

type StockForm = { product: string; movement_type: 'in' | 'out' | 'adjustment'; quantity: string; note: string }
const emptyStock: StockForm = { product: '', movement_type: 'adjustment', quantity: '0', note: '' }

export default function SalesStockPage() {
  const [products, setProducts] = useState<SalesProduct[]>([])
  const [movements, setMovements] = useState<SalesStockMovement[]>([])
  const [alerts, setAlerts] = useState<SalesStockAlert[]>([])
  const [summary, setSummary] = useState<SalesStockSummary | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteMovementId, setDeleteMovementId] = useState<string | null>(null)
  const [form, setForm] = useState<StockForm>(emptyStock)
  const [movementFilter, setMovementFilter] = useState<'all' | 'in' | 'out' | 'adjustment'>('all')
  const [productsPage, setProductsPage] = useState(1)
  const [productsPageSize, setProductsPageSize] = useState(20)
  const [movementsPage, setMovementsPage] = useState(1)
  const [movementsPageSize, setMovementsPageSize] = useState(20)
  const [productsSearch, setProductsSearch] = useState('')
  const [productsSort, setProductsSort] = useState<'name_asc' | 'stock_asc' | 'stock_desc'>('name_asc')
  const [movementsSearch, setMovementsSearch] = useState('')
  const [movementsSort, setMovementsSort] = useState<'recent' | 'qty_desc' | 'qty_asc'>('recent')
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)

  const filteredProducts = useMemo(() => {
    const query = productsSearch.trim().toLowerCase()
    const base = query
      ? products.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(query))
      : products
    const sorted = [...base]
    if (productsSort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    if (productsSort === 'stock_asc') sorted.sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity))
    if (productsSort === 'stock_desc') sorted.sort((a, b) => Number(b.stock_quantity) - Number(a.stock_quantity))
    return sorted
  }, [products, productsSearch, productsSort])
  const pagedProducts = filteredProducts.slice((productsPage - 1) * productsPageSize, productsPage * productsPageSize)
  const filteredMovements = useMemo(() => {
    const byType = movementFilter === 'all' ? movements : movements.filter((item) => item.movement_type === movementFilter)
    const query = movementsSearch.trim().toLowerCase()
    const bySearch = query
      ? byType.filter((item) => `${item.product_name} ${item.product_sku} ${item.note}`.toLowerCase().includes(query))
      : byType
    const sorted = [...bySearch]
    if (movementsSort === 'recent') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (movementsSort === 'qty_desc') sorted.sort((a, b) => Number(b.quantity) - Number(a.quantity))
    if (movementsSort === 'qty_asc') sorted.sort((a, b) => Number(a.quantity) - Number(b.quantity))
    return sorted
  }, [movements, movementFilter, movementsSearch, movementsSort])
  const pagedMovements = filteredMovements.slice((movementsPage - 1) * movementsPageSize, movementsPage * movementsPageSize)

  const deleteMovementSummary = useMemo(() => {
    if (!deleteMovementId) return ''
    const m = movements.find((item) => item.id === deleteMovementId)
    if (!m) return ''
    return `${m.product_name} (${m.product_sku}) — ${getStockMovementLabel(m.movement_type)} ${m.quantity}`
  }, [deleteMovementId, movements])

  const loadData = useCallback(async () => {
    try {
      const [productsData, movementsData, alertsData, summaryData] = await Promise.all([
        salesApiRequest<SalesProduct[]>('/sales/products/'),
        salesApiRequest<SalesStockMovement[]>('/sales/stock-movements/'),
        salesApiRequest<SalesStockAlert[]>('/sales/products/stock-alerts/'),
        salesApiRequest<SalesStockSummary>('/sales/stock-movements/summary/'),
      ])
      setProducts(productsData)
      setMovements(movementsData)
      setAlerts(alertsData)
      setSummary(summaryData)
    } catch (error) {
      notify.error('Chargement stock impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveMovement = async () => {
    try {
      await salesApiRequest('/sales/stock-movements/', { method: 'POST', body: JSON.stringify(form) })
      setDialogOpen(false)
      setForm(emptyStock)
      await loadData()
      notify.success('Mouvement enregistre')
    } catch (error) {
      notify.error('Erreur stock', error instanceof Error ? error.message : undefined)
    }
  }

  const deleteMovement = async () => {
    if (!deleteMovementId) return
    try {
      await salesApiRequest(`/sales/stock-movements/${deleteMovementId}/`, { method: 'DELETE' })
      setDeleteMovementId(null)
      await loadData()
      notify.success('Mouvement supprime')
    } catch (error) {
      notify.error('Suppression impossible', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col space-y-4 overflow-hidden p-4 md:p-6">
      <SalesSubnav />
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Stock produits</CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="md:hidden" onClick={() => setStatusDialogOpen(true)}>
              États
            </Button>
            <Button onClick={() => { setForm({ ...emptyStock, product: products[0]?.id || '' }); setDialogOpen(true) }}>Nouveau mouvement</Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {summary ? (
            <div className="hidden gap-2 sm:grid-cols-4 md:grid">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Produits suivis</p>
                <p className="text-lg font-semibold">{summary.total_products}</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground">Rupture</p>
                <p className="text-lg font-semibold text-destructive">{summary.out_of_stock}</p>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs text-muted-foreground">Stock faible</p>
                <p className="text-lg font-semibold text-amber-600">{summary.low_stock}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs text-muted-foreground">Stock sain</p>
                <p className="text-lg font-semibold text-emerald-600">{summary.healthy_stock}</p>
              </div>
            </div>
          ) : null}

          {alerts.length > 0 && (
            <div className="hidden rounded-lg border border-destructive/30 bg-destructive/5 p-3 md:block">
              <p className="mb-2 text-sm font-medium text-destructive">Alertes stock ({alerts.length})</p>
              <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
                {alerts.map((alert) => (
                  <div key={`${alert.product_id}-${alert.severity}`} className="flex items-center justify-between text-xs">
                    <span>
                      {alert.product_name} ({alert.product_sku}) - {alert.message}
                    </span>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>
                      {alert.stock_quantity}/{alert.reorder_level}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Tabs defaultValue="products" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="products">Stock produits</TabsTrigger>
              <TabsTrigger value="movements">Derniers mouvements</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  placeholder="Rechercher produit (nom, SKU...)"
                  value={productsSearch}
                  onChange={(e) => {
                    setProductsSearch(e.target.value)
                    setProductsPage(1)
                  }}
                />
                <SearchableSelect
                  value={productsSort}
                  onChange={(value) => {
                    setProductsSort(value as 'name_asc' | 'stock_asc' | 'stock_desc')
                    setProductsPage(1)
                  }}
                  options={[
                    { value: 'name_asc', label: 'Tri: Nom A-Z' },
                    { value: 'stock_asc', label: 'Tri: Stock croissant' },
                    { value: 'stock_desc', label: 'Tri: Stock décroissant' },
                  ]}
                  placeholder="Choisir un tri"
                />
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {pagedProducts.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.name} <span className="text-xs text-muted-foreground">({item.sku})</span></p>
                      <p className="text-xs text-muted-foreground">Stock: {item.stock_quantity} • Seuil: {item.reorder_level}</p>
                    </div>
                    <Badge variant={Number(item.stock_quantity) <= Number(item.reorder_level) ? 'destructive' : 'outline'}>
                      {Number(item.stock_quantity) <= Number(item.reorder_level) ? 'Alerte' : 'OK'}
                    </Badge>
                  </div>
                ))}
              </div>
              <DataPagination
                totalItems={filteredProducts.length}
                page={productsPage}
                pageSize={productsPageSize}
                onPageChange={setProductsPage}
                onPageSizeChange={(size) => {
                  setProductsPageSize(size)
                  setProductsPage(1)
                }}
              />
            </TabsContent>

            <TabsContent value="movements" className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  placeholder="Rechercher mouvement (produit, note...)"
                  value={movementsSearch}
                  onChange={(e) => {
                    setMovementsSearch(e.target.value)
                    setMovementsPage(1)
                  }}
                />
                <div>
                  <SearchableSelect
                    value={movementFilter}
                    onChange={(value) => {
                      setMovementFilter(value as 'all' | 'in' | 'out' | 'adjustment')
                      setMovementsPage(1)
                    }}
                    options={[
                      { value: 'all', label: 'Tous les mouvements' },
                      { value: 'in', label: 'Entrees' },
                      { value: 'out', label: 'Sorties' },
                      { value: 'adjustment', label: 'Ajustements' },
                    ]}
                    placeholder="Filtrer mouvements"
                  />
                </div>
                <div>
                  <SearchableSelect
                    value={movementsSort}
                    onChange={(value) => {
                      setMovementsSort(value as 'recent' | 'qty_desc' | 'qty_asc')
                      setMovementsPage(1)
                    }}
                    options={[
                      { value: 'recent', label: 'Tri: Plus récents' },
                      { value: 'qty_desc', label: 'Tri: Quantité décroissante' },
                      { value: 'qty_asc', label: 'Tri: Quantité croissante' },
                    ]}
                    placeholder="Tri mouvements"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {pagedMovements.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.product_name} <span className="text-xs text-muted-foreground">({item.product_sku})</span></p>
                      <p className="text-xs text-muted-foreground">{item.note || '-'} • {new Date(item.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={item.movement_type === 'out' ? 'destructive' : 'outline'}>
                        {getStockMovementLabel(item.movement_type)} {item.quantity}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="px-2" aria-label="Plus d'actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteMovementId(item.id)}
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
                totalItems={filteredMovements.length}
                page={movementsPage}
                pageSize={movementsPageSize}
                onPageChange={setMovementsPage}
                onPageSizeChange={(size) => {
                  setMovementsPageSize(size)
                  setMovementsPage(1)
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>États de stock</DialogTitle>
            <DialogDescription>Resume des niveaux de stock et alertes.</DialogDescription>
          </DialogHeader>
          {summary ? (
            <div className="grid gap-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Produits suivis</p>
                <p className="text-lg font-semibold">{summary.total_products}</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground">Rupture</p>
                <p className="text-lg font-semibold text-destructive">{summary.out_of_stock}</p>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs text-muted-foreground">Stock faible</p>
                <p className="text-lg font-semibold text-amber-600">{summary.low_stock}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs text-muted-foreground">Stock sain</p>
                <p className="text-lg font-semibold text-emerald-600">{summary.healthy_stock}</p>
              </div>
            </div>
          ) : null}
          {alerts.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="mb-2 text-sm font-medium text-destructive">Alertes ({alerts.length})</p>
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {alerts.map((alert) => (
                  <p key={`${alert.product_id}-${alert.severity}`} className="text-xs">
                    {alert.product_name} ({alert.product_sku}) - {alert.message}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau mouvement stock</DialogTitle>
            <DialogDescription>Enregistrez une entrée, une sortie ou un ajustement pour mettre a jour le stock du produit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Produit</Label>
              <SearchableSelect
                value={form.product}
                onChange={(value) => setForm((s) => ({ ...s, product: value }))}
                options={products.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` }))}
                placeholder="Sélectionner un produit"
              />
            </div>
            <div>
              <Label>Type</Label>
              <SearchableSelect
                value={form.movement_type}
                onChange={(value) => setForm((s) => ({ ...s, movement_type: value as StockForm['movement_type'] }))}
                options={[
                  { value: 'in', label: 'Entrée' },
                  { value: 'out', label: 'Sortie' },
                  { value: 'adjustment', label: 'Ajustement' },
                ]}
                placeholder="Sélectionner un type"
              />
            </div>
            <div><Label>Quantité</Label><Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))} /></div>
            <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={() => void saveMovement()}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteMovementId)} onOpenChange={(open) => !open && setDeleteMovementId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le mouvement</DialogTitle>
            <DialogDescription>
              {deleteMovementSummary
                ? `Supprimer definitivement « ${deleteMovementSummary} » ? Les niveaux de stock actuels ne seront pas recalculés automatiquement.`
                : 'Supprimer ce mouvement ? Les niveaux de stock actuels ne seront pas recalculés automatiquement.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMovementId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void deleteMovement()}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
