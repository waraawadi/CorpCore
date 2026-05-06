'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createCrmContact, deleteCrmContact, fetchCrmContacts, updateCrmContact, type CrmContact } from '../_lib/crm-api'
import { CrmContactsNavIcon } from '@/components/crm-animate-icons'
import { notify } from '@/lib/notify'
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
import { DataPagination } from '@/components/ui/data-pagination'
import { Label } from '@/components/ui/label'

export default function CrmContactsPage() {
  const [rows, setRows] = useState<CrmContact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CrmContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrmContact | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchCrmContacts()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
  }, [])

  const onCreate = async () => {
    setError(null)
    try {
      const created = await createCrmContact({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        company_name: company.trim(),
      })
      setRows((prev) => [created, ...prev])
      notify.success('Contact ajouté')
      setFirstName('')
      setLastName('')
      setEmail('')
      setCompany('')
      setCreateOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de création'
      setError(msg)
      notify.error('Création du contact impossible', msg)
    }
  }

  const openEdit = (contact: CrmContact) => {
    setEditing(contact)
    setEditFirstName(contact.first_name || '')
    setEditLastName(contact.last_name || '')
    setEditEmail(contact.email || '')
    setEditCompany(contact.company_name || '')
  }

  const onSaveEdit = async () => {
    if (!editing) return
    setError(null)
    try {
      const updated = await updateCrmContact(editing.id, {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        email: editEmail.trim(),
        company_name: editCompany.trim(),
      })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setEditing(null)
      notify.success('Contact mis à jour')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de mise à jour'
      setError(msg)
      notify.error('Mise à jour impossible', msg)
    }
  }

  const onDelete = async () => {
    if (!deleteTarget) return
    setError(null)
    try {
      await deleteCrmContact(deleteTarget.id)
      setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) setEditing(null)
      notify.success('Contact supprimé')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de suppression'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((c) => {
      return (
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company_name.toLowerCase().includes(q)
      )
    })
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize]
  )

  useEffect(() => {
    setPage(1)
  }, [query])

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CrmContactsNavIcon className="text-primary" />
          <h1 className="text-xl font-semibold">Contacts</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Nouveau contact
          </button>
          <Link href="/dashboard/crm" className="text-sm text-muted-foreground hover:text-foreground">
            Retour CRM
          </Link>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <input
        className="w-full rounded border bg-background px-3 py-2 text-sm"
        placeholder="Rechercher un contact (nom, email, société)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Nom</th>
              <th className="p-2 text-left font-medium">Email</th>
              <th className="p-2 text-left font-medium">Société</th>
              <th className="p-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">
                  {c.first_name} {c.last_name}
                </td>
                <td className="p-2 text-muted-foreground">{c.email || '—'}</td>
                <td className="p-2 text-muted-foreground">{c.company_name || '—'}</td>
                <td className="p-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openEdit(c)} className="rounded border px-2 py-1 text-xs">
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      className="rounded border px-2 py-1 text-xs text-destructive"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && !error && <p className="p-4 text-sm text-muted-foreground">Aucun contact.</p>}
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
            <DialogDescription>Créer un contact CRM.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Prénom *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nom</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Société</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={!firstName.trim()}
              className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Ajouter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier contact</DialogTitle>
            <DialogDescription>Mettre à jour le contact sélectionné.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Prénom *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nom</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Société</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setEditing(null)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!editFirstName.trim()}
              className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irreversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onDelete()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
