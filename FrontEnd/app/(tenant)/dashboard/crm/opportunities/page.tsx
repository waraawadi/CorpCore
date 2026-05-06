'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  createCrmOpportunity,
  deleteCrmOpportunity,
  fetchCrmContacts,
  fetchCrmLeads,
  fetchCrmOpportunities,
  updateCrmOpportunity,
  type CrmContact,
  type CrmLead,
  type CrmOpportunity,
} from '../_lib/crm-api'
import { CrmOpportunitiesNavIcon } from '@/components/crm-animate-icons'
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

export default function CrmOpportunitiesPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const [rows, setRows] = useState<CrmOpportunity[]>([])
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('0')
  const [stage, setStage] = useState('discovery')
  const [probability, setProbability] = useState('0')
  const [contactId, setContactId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CrmOpportunity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrmOpportunity | null>(null)
  const [editName, setEditName] = useState('')
  const [editStage, setEditStage] = useState('discovery')
  const [editAmount, setEditAmount] = useState('0')
  const [editProbability, setEditProbability] = useState('0')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchCrmOpportunities()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
    fetchCrmContacts().then(setContacts).catch(() => undefined)
    fetchCrmLeads().then(setLeads).catch(() => undefined)
  }, [])

  const onCreate = async () => {
    setError(null)
    try {
      const created = await createCrmOpportunity({
        name: name.trim(),
        amount: amount.trim() || '0',
        stage,
        probability: Number(probability || 0),
        contact: contactId || null,
        lead: leadId || null,
      })
      setRows((prev) => [created, ...prev])
      notify.success('Opportunité ajoutée')
      setName('')
      setAmount('0')
      setStage('discovery')
      setProbability('0')
      setContactId('')
      setLeadId('')
      setCreateOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de création'
      setError(msg)
      notify.error('Création opportunité impossible', msg)
    }
  }

  const openEdit = (opportunity: CrmOpportunity) => {
    setEditing(opportunity)
    setEditName(opportunity.name || '')
    setEditStage(opportunity.stage || 'discovery')
    setEditAmount(opportunity.amount || '0')
    setEditProbability(String(opportunity.probability ?? 0))
  }

  const onSaveEdit = async () => {
    if (!editing) return
    setError(null)
    try {
      const updated = await updateCrmOpportunity(editing.id, {
        name: editName.trim(),
        stage: editStage,
        amount: editAmount.trim() || '0',
        probability: Number(editProbability || 0),
      })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setEditing(null)
      notify.success('Opportunité mise à jour')
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
      await deleteCrmOpportunity(deleteTarget.id)
      setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) setEditing(null)
      notify.success('Opportunité supprimée')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de suppression'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((o) => o.name.toLowerCase().includes(q) || o.stage.toLowerCase().includes(q) || o.amount.includes(q))
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

  const stageLabel = (stageValue: string) => STAGE_LABELS[stageValue] || stageValue

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CrmOpportunitiesNavIcon className="text-primary" />
          <h1 className="text-xl font-semibold">Opportunités</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Nouvelle opportunité
          </button>
          <Link href="/dashboard/crm" className="text-sm text-muted-foreground hover:text-foreground">
            Retour CRM
          </Link>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <input
        className="w-full rounded border bg-background px-3 py-2 text-sm"
        placeholder="Rechercher une opportunité (nom, étape, montant)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Nom</th>
              <th className="p-2 text-left font-medium">Étape</th>
              <th className="p-2 text-left font-medium">Montant</th>
              <th className="p-2 text-left font-medium">%</th>
              <th className="p-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-2">{o.name}</td>
                <td className="p-2 text-muted-foreground">{stageLabel(o.stage)}</td>
                <td className="p-2 tabular-nums text-muted-foreground">
                  {formatMoneyWithCurrencySuffix(o.amount, tenantCurrency)}
                </td>
                <td className="p-2 tabular-nums text-muted-foreground">{o.probability}</td>
                <td className="p-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openEdit(o)} className="rounded border px-2 py-1 text-xs">
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(o)}
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
        {filteredRows.length === 0 && !error && <p className="p-4 text-sm text-muted-foreground">Aucune opportunité.</p>}
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
            <DialogTitle>Nouvelle opportunité</DialogTitle>
            <DialogDescription>Créer une opportunité commerciale.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Nom opportunité *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Montant ({tenantCurrency})</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Étape</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Étape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Découverte</SelectItem>
                  <SelectItem value="proposal">Proposition</SelectItem>
                  <SelectItem value="negotiation">Négociation</SelectItem>
                  <SelectItem value="closed_won">Gagnée</SelectItem>
                  <SelectItem value="closed_lost">Perdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Probabilité (%)</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={probability} onChange={(e) => setProbability(e.target.value)} />
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
            <div className="space-y-1">
              <Label>Piste source (optionnel)</Label>
              <Select value={leadId || 'none'} onValueChange={(v) => setLeadId(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Piste source (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Piste source (optionnel)</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
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
              disabled={!name.trim()}
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
            <DialogTitle>Modifier opportunité</DialogTitle>
            <DialogDescription>Mettre à jour l’opportunité sélectionnée.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Nom opportunité *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Montant ({tenantCurrency})</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Étape</Label>
              <Select value={editStage} onValueChange={setEditStage}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Étape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Découverte</SelectItem>
                  <SelectItem value="proposal">Proposition</SelectItem>
                  <SelectItem value="negotiation">Négociation</SelectItem>
                  <SelectItem value="closed_won">Gagnée</SelectItem>
                  <SelectItem value="closed_lost">Perdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Probabilité (%)</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={editProbability} onChange={(e) => setEditProbability(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setEditing(null)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!editName.trim()}
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
            <AlertDialogTitle>Supprimer cette opportunité ?</AlertDialogTitle>
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

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Découverte',
  proposal: 'Proposition',
  negotiation: 'Négociation',
  closed_won: 'Gagnée',
  closed_lost: 'Perdue',
}
