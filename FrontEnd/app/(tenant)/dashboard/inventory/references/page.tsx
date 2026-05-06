'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { MapPinPlus, Pencil, Tags, Trash2 } from 'lucide-react'

import { notify } from '@/lib/notify'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { InventoryPagination } from '../_components/inventory-pagination'
import { InventorySubnav } from '../_components/inventory-subnav'
import { inventoryApiRequest, type InventoryCategory, type InventoryLocation } from '../_lib/inventory-api'

export default function InventoryReferencesPage() {
  const [saving, setSaving] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null)
  const [editingLocation, setEditingLocation] = useState<InventoryLocation | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<InventoryCategory | null>(null)
  const [deletingLocation, setDeletingLocation] = useState<InventoryLocation | null>(null)
  const [categoryPage, setCategoryPage] = useState(1)
  const [categoryPageSize, setCategoryPageSize] = useState(10)
  const [locationPage, setLocationPage] = useState(1)
  const [locationPageSize, setLocationPageSize] = useState(10)
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [locations, setLocations] = useState<InventoryLocation[]>([])
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [locationForm, setLocationForm] = useState({ name: '', code: '', description: '' })

  const loadData = useCallback(async () => {
    try {
      const [categoriesData, locationsData] = await Promise.all([
        inventoryApiRequest<InventoryCategory[]>('/inventory/categories/'),
        inventoryApiRequest<InventoryLocation[]>('/inventory/locations/'),
      ])
      setCategories(categoriesData)
      setLocations(locationsData)
    } catch (error) {
      notify.error('Chargement references impossible', error instanceof Error ? error.message : undefined)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!categoryForm.name.trim()) {
      notify.warning('Nom de categorie obligatoire')
      return
    }
    setSaving(true)
    try {
      const isEdit = Boolean(editingCategory)
      const endpoint = isEdit ? `/inventory/categories/${editingCategory?.id}/` : '/inventory/categories/'
      await inventoryApiRequest<InventoryCategory>(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
          is_active: true,
        }),
      })
      notify.success(isEdit ? 'Categorie modifiee' : 'Categorie creee')
      setCategoryDialogOpen(false)
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '' })
      await loadData()
    } catch (error) {
      notify.error(
        editingCategory ? 'Modification categorie impossible' : 'Creation categorie impossible',
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!locationForm.name.trim()) {
      notify.warning("Nom de l'emplacement obligatoire")
      return
    }
    setSaving(true)
    try {
      const isEdit = Boolean(editingLocation)
      const endpoint = isEdit ? `/inventory/locations/${editingLocation?.id}/` : '/inventory/locations/'
      await inventoryApiRequest<InventoryLocation>(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: locationForm.name.trim(),
          code: locationForm.code.trim(),
          description: locationForm.description.trim(),
          is_active: true,
        }),
      })
      notify.success(isEdit ? 'Emplacement modifie' : 'Emplacement cree')
      setLocationDialogOpen(false)
      setEditingLocation(null)
      setLocationForm({ name: '', code: '', description: '' })
      await loadData()
    } catch (error) {
      notify.error(
        editingLocation ? "Modification de l'emplacement impossible" : "Creation de l'emplacement impossible",
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setSaving(false)
    }
  }

  const openCreateCategoryDialog = () => {
    setEditingCategory(null)
    setCategoryForm({ name: '', description: '' })
    setCategoryDialogOpen(true)
  }

  const openEditCategoryDialog = (category: InventoryCategory) => {
    setEditingCategory(category)
    setCategoryForm({ name: category.name, description: category.description || '' })
    setCategoryDialogOpen(true)
  }

  const openCreateLocationDialog = () => {
    setEditingLocation(null)
    setLocationForm({ name: '', code: '', description: '' })
    setLocationDialogOpen(true)
  }

  const openEditLocationDialog = (location: InventoryLocation) => {
    setEditingLocation(location)
    setLocationForm({
      name: location.name,
      code: location.code || '',
      description: location.description || '',
    })
    setLocationDialogOpen(true)
  }

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return
    try {
      await inventoryApiRequest<void>(`/inventory/categories/${deletingCategory.id}/`, { method: 'DELETE' })
      notify.success('Categorie supprimee')
      setDeletingCategory(null)
      await loadData()
    } catch (error) {
      notify.error('Suppression categorie impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const handleDeleteLocation = async () => {
    if (!deletingLocation) return
    try {
      await inventoryApiRequest<void>(`/inventory/locations/${deletingLocation.id}/`, { method: 'DELETE' })
      notify.success('Emplacement supprime')
      setDeletingLocation(null)
      await loadData()
    } catch (error) {
      notify.error("Suppression de l'emplacement impossible", error instanceof Error ? error.message : undefined)
    }
  }
  const categoryTotalPages = Math.max(1, Math.ceil(categories.length / categoryPageSize))
  const locationTotalPages = Math.max(1, Math.ceil(locations.length / locationPageSize))
  const paginatedCategories = useMemo(
    () => categories.slice((categoryPage - 1) * categoryPageSize, categoryPage * categoryPageSize),
    [categories, categoryPage, categoryPageSize]
  )
  const paginatedLocations = useMemo(
    () => locations.slice((locationPage - 1) * locationPageSize, locationPage * locationPageSize),
    [locations, locationPage, locationPageSize]
  )

  useEffect(() => {
    setCategoryPage((prev) => Math.min(prev, categoryTotalPages))
  }, [categoryTotalPages])

  useEffect(() => {
    setLocationPage((prev) => Math.min(prev, locationTotalPages))
  }, [locationTotalPages])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:p-5">
      <InventorySubnav />

      <Card className="shrink-0">
        <CardHeader className="py-3">
          <CardTitle className="text-base">References inventaire</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pt-0 md:grid-cols-2">
          <Button size="sm" onClick={openCreateCategoryDialog}>
            <Tags className="mr-2 h-4 w-4" />
            Nouvelle categorie
          </Button>
          <Button size="sm" variant="outline" onClick={openCreateLocationDialog}>
            <MapPinPlus className="mr-2 h-4 w-4" />
            Nouvel emplacement
          </Button>
        </CardContent>
      </Card>

      <div className="md:hidden min-h-0 flex-1 overflow-hidden">
        <Tabs defaultValue="categories" className="flex h-full min-h-0 flex-col gap-2">
          <TabsList className="shrink-0">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="locations">Emplacements</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent className="flex h-full min-h-0 flex-col pt-0">
                <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
                  {!categories.length ? (
                    <p className="text-sm text-muted-foreground">Aucune categorie.</p>
                  ) : (
                    paginatedCategories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
                        <span>{category.name}</span>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditCategoryDialog(category)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingCategory(category)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {!!categories.length ? (
                  <InventoryPagination
                    totalItems={categories.length}
                    page={categoryPage}
                    pageSize={categoryPageSize}
                    onPageChange={setCategoryPage}
                    onPageSizeChange={(size) => {
                      setCategoryPageSize(size)
                      setCategoryPage(1)
                    }}
                  />
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Emplacements</CardTitle>
              </CardHeader>
              <CardContent className="flex h-full min-h-0 flex-col pt-0">
                <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
                  {!locations.length ? (
                    <p className="text-sm text-muted-foreground">Aucun emplacement.</p>
                  ) : (
                    paginatedLocations.map((location) => (
                      <div key={location.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
                        <span>{location.name}</span>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLocationDialog(location)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingLocation(location)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {!!locations.length ? (
                  <InventoryPagination
                    totalItems={locations.length}
                    page={locationPage}
                    pageSize={locationPageSize}
                    onPageChange={setLocationPage}
                    onPageSizeChange={(size) => {
                      setLocationPageSize(size)
                      setLocationPage(1)
                    }}
                  />
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden min-h-0 flex-1 gap-3 md:grid md:grid-cols-2">
        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full min-h-0 flex-col pt-0">
            <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
              {!categories.length ? (
                <p className="text-sm text-muted-foreground">Aucune categorie.</p>
              ) : (
                paginatedCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
                    <span>{category.name}</span>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditCategoryDialog(category)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingCategory(category)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!!categories.length ? (
              <InventoryPagination
                totalItems={categories.length}
                page={categoryPage}
                pageSize={categoryPageSize}
                onPageChange={setCategoryPage}
                onPageSizeChange={(size) => {
                  setCategoryPageSize(size)
                  setCategoryPage(1)
                }}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Emplacements</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full min-h-0 flex-col pt-0">
            <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">
              {!locations.length ? (
                <p className="text-sm text-muted-foreground">Aucun emplacement.</p>
              ) : (
                paginatedLocations.map((location) => (
                  <div key={location.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
                    <span>{location.name}</span>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLocationDialog(location)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingLocation(location)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!!locations.length ? (
              <InventoryPagination
                totalItems={locations.length}
                page={locationPage}
                pageSize={locationPageSize}
                onPageChange={setLocationPage}
                onPageSizeChange={(size) => {
                  setLocationPageSize(size)
                  setLocationPage(1)
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Modifier categorie' : 'Nouvelle categorie'}</DialogTitle>
            <DialogDescription>Categorie utilisable dans les articles.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-3">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCategoryDialogOpen(false); setEditingCategory(null) }}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {editingCategory ? 'Enregistrer' : 'Creer la categorie'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Modifier emplacement' : 'Nouvel emplacement'}</DialogTitle>
            <DialogDescription>Emplacement utilisable dans les mouvements.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLocation} className="space-y-3">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={locationForm.name}
                onChange={(e) => setLocationForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={locationForm.code}
                onChange={(e) => setLocationForm((prev) => ({ ...prev, code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={locationForm.description}
                onChange={(e) => setLocationForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setLocationDialogOpen(false); setEditingLocation(null) }}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {editingLocation ? 'Enregistrer' : "Creer l'emplacement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingCategory)} onOpenChange={(open) => { if (!open) setDeletingCategory(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette categorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les articles associes conserveront leurs donnees avec categorie vide.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteCategory}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingLocation)} onOpenChange={(open) => { if (!open) setDeletingLocation(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet emplacement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les mouvements associes conserveront leurs donnees avec emplacement vide.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteLocation}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
