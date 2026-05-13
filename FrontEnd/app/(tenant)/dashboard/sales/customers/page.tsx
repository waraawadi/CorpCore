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
import { SalesSubnav } from '../_components/sales-subnav'
import { salesApiRequest, type SalesCustomer } from '../_lib/sales-api'

type CustomerForm = {
  name: string
  company: string
  email: string
  phone: string
  city: string
  country: string
  tax_id: string
  address: string
  notes: string
}

const emptyCustomer: CustomerForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  tax_id: '',
  address: '',
  notes: '',
}

export default function SalesCustomersPage() {
  const [customers, setCustomers] = useState<SalesCustomer[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<SalesCustomer | null>(null)
  const [deleteId, setDeleteId] = useState<string>('')
  const [form, setForm] = useState<CustomerForm>(emptyCustomer)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'recent'>('name_asc')

  const loadCustomers = useCallback(async () => {
    try {
      const data = await salesApiRequest<SalesCustomer[]>('/sales/customers/')
      setCustomers(data)
    } catch (error) {
      notify.error('Chargement clients impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyCustomer)
    setDialogOpen(true)
  }

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const base = query
      ? customers.filter((item) =>
          `${item.name} ${item.company} ${item.email} ${item.phone} ${item.city} ${item.country}`.toLowerCase().includes(query)
        )
      : customers
    const sorted = [...base]
    if (sortBy === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    if (sortBy === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name, 'fr'))
    if (sortBy === 'recent') sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return sorted
  }, [customers, search, sortBy])

  const totalCustomers = filteredCustomers.length
  const pagedCustomers = filteredCustomers.slice((page - 1) * pageSize, page * pageSize)
  const deleteCustomerLabel = useMemo(() => {
    if (!deleteId) return ''
    return customers.find((c) => c.id === deleteId)?.name || ''
  }, [deleteId, customers])

  const openEdit = (item: SalesCustomer) => {
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
    })
    setDialogOpen(true)
  }

  const saveCustomer = async () => {
    try {
      if (editing) {
        await salesApiRequest(`/sales/customers/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(form) })
      } else {
        await salesApiRequest('/sales/customers/', { method: 'POST', body: JSON.stringify(form) })
      }
      setDialogOpen(false)
      await loadCustomers()
      notify.success('Client enregistre')
    } catch (error) {
      notify.error('Erreur client', error instanceof Error ? error.message : undefined)
    }
  }

  const deleteCustomer = async () => {
    try {
      await salesApiRequest(`/sales/customers/${deleteId}/`, { method: 'DELETE' })
      setDeleteOpen(false)
      setDeleteId('')
      await loadCustomers()
      notify.success('Client supprime')
    } catch (error) {
      notify.error('Suppression impossible', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col space-y-4 overflow-hidden p-4 md:p-6">
      <SalesSubnav />
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clients</CardTitle>
          <Button onClick={openCreate}>Nouveau client</Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Rechercher (nom, email, ville, pays...)"
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
                { value: 'recent', label: 'Tri: Plus récents' },
              ]}
              placeholder="Choisir un tri"
            />
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {pagedCustomers.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.company || '-'} • {item.email || '-'} • {item.phone || '-'} • {item.city || '-'}
                </p>
              </div>
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
          ))}
          {!filteredCustomers.length && <p className="text-sm text-muted-foreground">Aucun client.</p>}
          </div>
          <DataPagination
            totalItems={totalCustomers}
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
            <DialogTitle>{editing ? 'Modifier client' : 'Nouveau client'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Mettez a jour les coordonnees et informations du client.' : 'Creez une fiche client pour les commandes et la facturation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
            <div><Label>Entreprise</Label><Input value={form.company} onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></div>
            <div><Label>Telephone</Label><Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></div>
            <div className="md:col-span-2">
              <LocationCountryCityFields
                country={form.country}
                city={form.city}
                onCountryChange={(country) => setForm((s) => ({ ...s, country }))}
                onCityChange={(city) => setForm((s) => ({ ...s, city }))}
              />
            </div>
            <div><Label>ID fiscal</Label><Input value={form.tax_id} onChange={(e) => setForm((s) => ({ ...s, tax_id: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Adresse</Label><Textarea value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={() => void saveCustomer()}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer suppression</DialogTitle>
            <DialogDescription>
              Supprimer definitivement {deleteCustomerLabel ? `« ${deleteCustomerLabel} »` : 'ce client'} ? Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button><Button variant="destructive" onClick={() => void deleteCustomer()}>Supprimer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
