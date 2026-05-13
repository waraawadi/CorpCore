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
import { LocationCountryCityFields } from '@/components/location-country-city-fields'
import { notify } from '@/lib/notify'
import { MoreHorizontal } from 'lucide-react'
import { SupplierActiveBadge, supplierListRowClass } from '../_components/procurement-status'
import { ProcurementSubnav } from '../_components/procurement-subnav'
import { procurementApiRequest, type ProcurementSupplier } from '../_lib/procurement-api'

type SupplierForm = {
  name: string
  company: string
  email: string
  phone: string
  city: string
  country: string
  tax_id: string
  address: string
  notes: string
  is_active: boolean
}

const emptySupplier: SupplierForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  tax_id: '',
  address: '',
  notes: '',
  is_active: true,
}

export default function ProcurementSuppliersPage() {
  const [suppliers, setSuppliers] = useState<ProcurementSupplier[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<ProcurementSupplier | null>(null)
  const [deleteId, setDeleteId] = useState<string>('')
  const [form, setForm] = useState<SupplierForm>(emptySupplier)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'recent'>('name_asc')

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await procurementApiRequest<ProcurementSupplier[]>('/procurement/suppliers/')
      setSuppliers(data)
    } catch (error) {
      notify.error('Chargement fournisseurs impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadSuppliers()
  }, [loadSuppliers])

  const openCreate = () => {
    setEditing(null)
    setForm(emptySupplier)
    setDialogOpen(true)
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const base = query
      ? suppliers.filter((item) =>
          `${item.name} ${item.company} ${item.email} ${item.phone} ${item.city} ${item.country}`.toLowerCase().includes(query)
        )
      : suppliers
    const sorted = [...base]
    if (sortBy === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    if (sortBy === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name, 'fr'))
    if (sortBy === 'recent') sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return sorted
  }, [suppliers, search, sortBy])

  const totalItems = filtered.length
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const deleteSupplierLabel = useMemo(() => {
    if (!deleteId) return ''
    return suppliers.find((s) => s.id === deleteId)?.name || ''
  }, [deleteId, suppliers])

  const openEdit = (item: ProcurementSupplier) => {
    setEditing(item)
    setForm({
      name: item.name,
      company: item.company || '',
      email: item.email || '',
      phone: item.phone || '',
      city: item.city || '',
      country: item.country || '',
      tax_id: item.tax_id || '',
      address: item.address || '',
      notes: item.notes || '',
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  const saveSupplier = async () => {
    try {
      if (editing) {
        await procurementApiRequest(`/procurement/suppliers/${editing.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        })
      } else {
        await procurementApiRequest('/procurement/suppliers/', { method: 'POST', body: JSON.stringify(form) })
      }
      setDialogOpen(false)
      await loadSuppliers()
      notify.success('Fournisseur enregistre')
    } catch (error) {
      notify.error('Erreur fournisseur', error instanceof Error ? error.message : undefined)
    }
  }

  const deleteSupplier = async () => {
    try {
      await procurementApiRequest(`/procurement/suppliers/${deleteId}/`, { method: 'DELETE' })
      setDeleteOpen(false)
      setDeleteId('')
      await loadSuppliers()
      notify.success('Fournisseur supprime')
    } catch (error) {
      notify.error('Suppression impossible', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col space-y-4 overflow-hidden p-4 md:p-6">
      <ProcurementSubnav />
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fournisseurs</CardTitle>
          <Button onClick={openCreate}>Nouveau fournisseur</Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Rechercher (nom, email, ville...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <SearchableSelect
              value={sortBy}
              onChange={(value) => {
                setSortBy(value as 'name_asc' | 'name_desc' | 'recent')
                setPage(1)
              }}
              options={[
                { value: 'name_asc', label: 'Tri: Nom A-Z' },
                { value: 'name_desc', label: 'Tri: Nom Z-A' },
                { value: 'recent', label: 'Tri: Plus recents' },
              ]}
              placeholder="Choisir un tri"
            />
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {paged.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border bg-card/30 p-3 ${supplierListRowClass(item.is_active)}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.company || '-'} • {item.email || '-'} • {item.phone || '-'} • {item.city || '-'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SupplierActiveBadge isActive={item.is_active} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="px-2" aria-label="Plus d'actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(item)}>Modifier</DropdownMenuItem>
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
              </div>
            ))}
            {!filtered.length && <p className="text-sm text-muted-foreground">Aucun fournisseur.</p>}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Mettez a jour les coordonnees et le statut actif du fournisseur.'
                : 'Ajoutez un fournisseur pour les bons de commande et les achats.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
            <div>
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div>
              <Label>Entreprise</Label>
              <Input value={form.company} onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <Label>Telephone</Label>
              <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <LocationCountryCityFields
                country={form.country}
                city={form.city}
                onCountryChange={(country) => setForm((s) => ({ ...s, country }))}
                onCityChange={(city) => setForm((s) => ({ ...s, city }))}
              />
            </div>
            <div>
              <Label>ID fiscal</Label>
              <Input value={form.tax_id} onChange={(e) => setForm((s) => ({ ...s, tax_id: e.target.value }))} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
                />
                Actif
              </label>
            </div>
            <div className="md:col-span-2">
              <Label>Adresse</Label>
              <Textarea value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveSupplier()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer suppression</DialogTitle>
            <DialogDescription>
              {deleteSupplierLabel
                ? `Supprimer definitivement « ${deleteSupplierLabel} » ? Impossible si des bons de commande existent encore pour ce fournisseur.`
                : 'Supprimer ce fournisseur ?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void deleteSupplier()}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
