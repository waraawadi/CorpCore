'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  convertCrmLead,
  createCrmLead,
  deleteCrmLead,
  fetchCrmContacts,
  fetchCrmLeads,
  updateCrmLead,
  type CrmContact,
  type CrmLead,
} from '../_lib/crm-api'
import { CrmLeadsNavIcon } from '@/components/crm-animate-icons'
import { notify } from '@/lib/notify'
import { useStore } from '@/lib/store'
import { formatMoneyWithCurrencySuffix, normalizeCurrencyCode } from '@/lib/currency'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CrmLeadsPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const [rows, setRows] = useState<CrmLead[]>([])
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('0')
  const [contactId, setContactId] = useState('')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [convertingLead, setConvertingLead] = useState<CrmLead | null>(null)
  const [editing, setEditing] = useState<CrmLead | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrmLead | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState('new')
  const [editValue, setEditValue] = useState('0')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchCrmLeads()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
    fetchCrmContacts().then(setContacts).catch(() => undefined)
  }, [])

  const onCreate = async () => {
    setError(null)
    try {
      const created = await createCrmLead({
        title: title.trim(),
        estimated_value: value.trim() || '0',
        contact: contactId || null,
      })
      setRows((prev) => [created, ...prev])
      notify.success('Piste ajoutée')
      setTitle('')
      setValue('0')
      setContactId('')
      setCreateOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de création'
      setError(msg)
      notify.error('Création de la piste impossible', msg)
    }
  }

  const onConvert = async (lead: CrmLead) => {
    setError(null)
    try {
      await convertCrmLead(lead.id, {
        opportunity_name: `Opp - ${lead.title}`,
        amount: lead.estimated_value || '0',
        stage: 'discovery',
      })
      setRows((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'converted' } : l)))
      notify.success('Piste convertie en opportunité')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de conversion'
      setError(msg)
      notify.error('Conversion impossible', msg)
    }
  }

  const openEdit = (lead: CrmLead) => {
    setEditing(lead)
    setEditTitle(lead.title || '')
    setEditStatus(lead.status || 'new')
    setEditValue(lead.estimated_value || '0')
  }

  const onSaveEdit = async () => {
    if (!editing) return
    setError(null)
    try {
      const updated = await updateCrmLead(editing.id, {
        title: editTitle.trim(),
        status: editStatus,
        estimated_value: editValue.trim() || '0',
      })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setEditing(null)
      notify.success('Piste mise à jour')
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
      await deleteCrmLead(deleteTarget.id)
      setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) setEditing(null)
      notify.success('Piste supprimée')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de suppression'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((l) => l.title.toLowerCase().includes(q) || l.status.toLowerCase().includes(q) || l.estimated_value.includes(q))
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

  const statusLabel = (statusValue: string) => LEAD_STATUS_LABELS[statusValue] || statusValue

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CrmLeadsNavIcon className="text-primary" />
          <h1 className="text-xl font-semibold">Pistes</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Nouvelle piste
          </button>
          <Link href="/dashboard/crm" className="text-sm text-muted-foreground hover:text-foreground">
            Retour CRM
          </Link>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <input
        className="w-full rounded border bg-background px-3 py-2 text-sm"
        placeholder="Rechercher une piste (titre, statut, valeur)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Titre</th>
              <th className="p-2 text-left font-medium">Statut</th>
              <th className="p-2 text-left font-medium">Valeur est.</th>
              <th className="p-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2">{l.title}</td>
                <td className="p-2 text-muted-foreground">{statusLabel(l.status)}</td>
                <td className="p-2 tabular-nums text-muted-foreground">
                  {formatMoneyWithCurrencySuffix(l.estimated_value, tenantCurrency)}
                </td>
                <td className="p-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openEdit(l)} className="rounded border px-2 py-1 text-xs">
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setConvertingLead(l)}
                      disabled={l.status === 'converted'}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Convertir
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(l)}
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
        {filteredRows.length === 0 && !error && <p className="p-4 text-sm text-muted-foreground">Aucune piste.</p>}
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
            <DialogTitle>Nouvelle piste</DialogTitle>
            <DialogDescription>Créer une nouvelle piste commerciale.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Titre piste *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Montant ({tenantCurrency})</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Contact (optionnel)</Label>
              <Select value={contactId || 'none'} onValueChange={(v) => setContactId(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Contact (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Contact (optionnel)</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={!title.trim()}
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
            <DialogTitle>Modifier piste</DialogTitle>
            <DialogDescription>Mettre à jour la piste sélectionnée.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Titre *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Nouvelle</SelectItem>
                  <SelectItem value="contacted">Contactée</SelectItem>
                  <SelectItem value="qualified">Qualifiée</SelectItem>
                  <SelectItem value="lost">Perdue</SelectItem>
                  <SelectItem value="converted">Convertie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Montant ({tenantCurrency})</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setEditing(null)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!editTitle.trim()}
              className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(convertingLead)} onOpenChange={(open) => !open && setConvertingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convertir cette piste ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va créer une opportunité à partir de la piste sélectionnée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!convertingLead) return
                void onConvert(convertingLead)
                setConvertingLead(null)
              }}
            >
              Convertir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette piste ?</AlertDialogTitle>
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

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle',
  contacted: 'Contactée',
  qualified: 'Qualifiée',
  lost: 'Perdue',
  converted: 'Convertie',
}
