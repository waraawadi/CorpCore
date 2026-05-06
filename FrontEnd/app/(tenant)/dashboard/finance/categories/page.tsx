'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createFinanceCategory, deleteFinanceCategory, fetchFinanceCategories, type FinanceCategory, updateFinanceCategory } from '../_lib/finance-api'
import { notify } from '@/lib/notify'
import { DataPagination } from '@/components/ui/data-pagination'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ColorPicker } from '@/components/ui/color-picker'
import { Switch } from '@/components/ui/switch'

export default function FinanceCategoriesPage() {
  const [rows, setRows] = useState<FinanceCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinanceCategory | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<FinanceCategory['kind']>('expense')
  const [color, setColor] = useState('#185FA5')
  const [isActive, setIsActive] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchFinanceCategories()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
  }, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setKind('expense')
    setColor('#185FA5')
    setIsActive(true)
    setDialogOpen(true)
  }

  const openEdit = (row: FinanceCategory) => {
    setEditing(row)
    setName(row.name || '')
    setKind(row.kind)
    setColor(row.color || '#185FA5')
    setIsActive(Boolean(row.is_active))
    setDialogOpen(true)
  }

  const submitForm = async () => {
    setError(null)
    try {
      const payload = { name: name.trim(), kind, color: color.trim(), is_active: isActive }
      if (editing) {
        const updated = await updateFinanceCategory(editing.id, payload)
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        notify.success('Catégorie mise à jour')
      } else {
        const created = await createFinanceCategory(payload)
        setRows((prev) => [created, ...prev])
        notify.success('Catégorie ajoutée')
      }
      setDialogOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Enregistrement impossible', msg)
    }
  }

  const onDelete = async () => {
    if (!deleteTarget) return
    setError(null)
    try {
      await deleteFinanceCategory(deleteTarget.id)
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
      notify.success('Catégorie supprimée')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.kind.toLowerCase().includes(q))
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])
  useEffect(() => setPage(1), [query])
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-x-hidden overflow-y-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Catégories financières</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openCreate} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Nouvelle catégorie
          </button>
          <Link href="/dashboard/finance" className="text-sm text-muted-foreground hover:text-foreground">
            Retour finance
          </Link>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <input className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="Rechercher une catégorie" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-w-0 overflow-auto rounded-md border">
          <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Nom</th>
              <th className="p-2 text-left font-medium">Type</th>
              <th className="p-2 text-left font-medium">Couleur</th>
              <th className="p-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.name}</td>
                <td className="p-2 text-muted-foreground">{row.kind === 'income' ? 'Revenu' : 'Dépense'}</td>
                <td className="p-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: row.color || '#999' }} />
                    {row.color || '—'}
                  </span>
                </td>
                <td className="p-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openEdit(row)} className="rounded border px-2 py-1 text-xs">Modifier</button>
                    <button type="button" onClick={() => setDeleteTarget(row)} className="rounded border px-2 py-1 text-xs text-destructive">Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
          {filteredRows.length === 0 && !error ? <p className="p-4 text-sm text-muted-foreground">Aucune catégorie.</p> : null}
        </div>
      </div>
      {!!filteredRows.length ? (
        <DataPagination
          totalItems={filteredRows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            <DialogDescription>Configurer une catégorie de revenus ou de dépenses.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as FinanceCategory['kind'])}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Revenu</SelectItem>
                  <SelectItem value="expense">Dépense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColorPicker label="Couleur" value={color} onChange={setColor} />
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="finance-category-active">Catégorie active</Label>
              <Switch id="finance-category-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded border px-3 py-1 text-sm">Annuler</button>
            <button type="button" onClick={submitForm} disabled={!name.trim()} className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50">Enregistrer</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irreversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void onDelete()}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

