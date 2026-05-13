'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { salesApiRequest, type SalesProduct } from '../_lib/sales-api'

type ProductForm = { name: string; description: string; unit_price: string; stock_quantity: string; reorder_level: string }
const emptyProduct: ProductForm = { name: '', description: '', unit_price: '0', stock_quantity: '0', reorder_level: '0' }

export default function SalesProductsPage() {
  const [products, setProducts] = useState<SalesProduct[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<SalesProduct | null>(null)
  const [deleteId, setDeleteId] = useState('')
  const [form, setForm] = useState<ProductForm>(emptyProduct)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_desc' | 'stock_asc'>('name_asc')

  const loadProducts = useCallback(async () => {
    try {
      const data = await salesApiRequest<SalesProduct[]>('/sales/products/')
      setProducts(data)
    } catch (error) {
      notify.error('Chargement produits impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const money = (value: string | number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(Number(value || 0))

  const saveProduct = async () => {
    try {
      if (editing) {
        await salesApiRequest(`/sales/products/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(form) })
      } else {
        await salesApiRequest('/sales/products/', { method: 'POST', body: JSON.stringify(form) })
      }
      setDialogOpen(false)
      await loadProducts()
      notify.success('Produit enregistre')
    } catch (error) {
      notify.error('Erreur produit', error instanceof Error ? error.message : undefined)
    }
  }

  const deleteProduct = async () => {
    try {
      await salesApiRequest(`/sales/products/${deleteId}/`, { method: 'DELETE' })
      setDeleteOpen(false)
      setDeleteId('')
      await loadProducts()
      notify.success('Produit supprime')
    } catch (error) {
      notify.error('Suppression impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    const base = query
      ? products.filter((item) =>
          `${item.name} ${item.sku} ${item.description}`.toLowerCase().includes(query)
        )
      : products
    const sorted = [...base]
    if (sortBy === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    if (sortBy === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name, 'fr'))
    if (sortBy === 'price_desc') sorted.sort((a, b) => Number(b.unit_price) - Number(a.unit_price))
    if (sortBy === 'stock_asc') sorted.sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity))
    return sorted
  }, [products, search, sortBy])

  const totalProducts = filteredProducts.length
  const pagedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize)
  const deleteProductLabel = useMemo(() => {
    if (!deleteId) return ''
    const p = products.find((item) => item.id === deleteId)
    return p ? `${p.name} (${p.sku})` : ''
  }, [deleteId, products])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col space-y-4 overflow-hidden p-4 md:p-6">
      <SalesSubnav />
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Produits</CardTitle>
          <Button onClick={() => { setEditing(null); setForm(emptyProduct); setDialogOpen(true) }}>Nouveau produit</Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Rechercher (nom, SKU, description...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <SearchableSelect
              value={sortBy}
              onChange={(value) => {
                setSortBy(value as 'name_asc' | 'name_desc' | 'price_desc' | 'stock_asc')
                setPage(1)
              }}
              options={[
                { value: 'name_asc', label: 'Tri: Nom A-Z' },
                { value: 'name_desc', label: 'Tri: Nom Z-A' },
                { value: 'price_desc', label: 'Tri: Prix décroissant' },
                { value: 'stock_asc', label: 'Tri: Stock croissant' },
              ]}
              placeholder="Choisir un tri"
            />
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {pagedProducts.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{item.name} <span className="text-xs text-muted-foreground">({item.sku})</span></p>
                <p className="text-xs text-muted-foreground">
                  {money(item.unit_price)} • Stock {item.stock_quantity} • Seuil {item.reorder_level}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="px-2" aria-label="Plus d'actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(item)
                      setForm({
                        name: item.name,
                        description: item.description || '',
                        unit_price: String(item.unit_price),
                        stock_quantity: String(item.stock_quantity),
                        reorder_level: String(item.reorder_level),
                      })
                      setDialogOpen(true)
                    }}
                  >
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setDeleteId(item.id)
                      setDeleteOpen(true)
                    }}
                  >
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          </div>
          <DataPagination
            totalItems={totalProducts}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier produit' : 'Nouveau produit'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Mettez a jour le catalogue, le prix et les niveaux de stock.' : 'Ajoutez un article au catalogue. Le SKU est genere automatiquement.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
            <div><Label>Prix unitaire</Label><Input type="number" min={0} value={form.unit_price} onChange={(e) => setForm((s) => ({ ...s, unit_price: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Stock initial</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm((s) => ({ ...s, stock_quantity: e.target.value }))} /></div>
              <div><Label>Seuil alerte</Label><Input type="number" value={form.reorder_level} onChange={(e) => setForm((s) => ({ ...s, reorder_level: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} /></div>
            {!editing && <p className="text-xs text-muted-foreground">SKU genere automatiquement.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={() => void saveProduct()}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer suppression</DialogTitle>
            <DialogDescription>
              Supprimer definitivement {deleteProductLabel ? `« ${deleteProductLabel} »` : 'ce produit'} ? Les references en commande peuvent echouer. Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button><Button variant="destructive" onClick={() => void deleteProduct()}>Supprimer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
