'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { deleteCrmLead, fetchCrmLead, updateCrmLead, type CrmLead } from '../../_lib/crm-api'
import { CrmLeadsNavIcon } from '@/components/crm-animate-icons'
import { notify } from '@/lib/notify'
import { useStore } from '@/lib/store'
import { normalizeCurrencyCode } from '@/lib/currency'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CrmLeadDetailPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<CrmLead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('new')
  const [source, setSource] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('0')
  const [notes, setNotes] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    fetchCrmLead(params.id)
      .then((l) => {
        setLead(l)
        setTitle(l.title || '')
        setStatus(l.status || 'new')
        setSource(l.source || '')
        setEstimatedValue(l.estimated_value || '0')
        setNotes(l.notes || '')
      })
      .catch((e: Error) => setError(e.message))
  }, [params?.id])

  const onSave = async () => {
    if (!lead) return
    setError(null)
    try {
      const updated = await updateCrmLead(lead.id, {
        title: title.trim(),
        status,
        source: source.trim(),
        estimated_value: estimatedValue.trim() || '0',
        notes: notes.trim(),
      })
      setLead(updated)
      notify.success('Piste mise à jour')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de mise à jour'
      setError(msg)
      notify.error('Mise à jour impossible', msg)
    }
  }

  const onDelete = async () => {
    if (!lead) return
    setError(null)
    try {
      await deleteCrmLead(lead.id)
      notify.success('Piste supprimée')
      router.push('/dashboard/crm/leads')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de suppression'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CrmLeadsNavIcon className="text-primary" />
          <h1 className="text-xl font-semibold">Détail piste</h1>
        </div>
        <Link href="/dashboard/crm/leads" className="text-sm text-muted-foreground hover:text-foreground">
          Retour pistes
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!lead && !error && <p className="text-sm text-muted-foreground">Chargement...</p>}

      {lead && (
        <div className="rounded-md border p-4 space-y-3 text-sm">
          <FieldInput label="Titre" value={title} onChange={setTitle} required />
          <div className="grid grid-cols-3 gap-2">
            <span className="text-muted-foreground">Statut</span>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="col-span-2 w-full">
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
          <FieldInput label="Source" value={source} onChange={setSource} />
          <FieldInput label={`Valeur estimée (${tenantCurrency})`} value={estimatedValue} onChange={setEstimatedValue} />
          <FieldInput label="Contact ID" value={lead.contact || ''} onChange={() => undefined} />
          <FieldInput label="Prochaine relance" value={lead.next_follow_up_at || ''} onChange={() => undefined} />
          <div className="grid grid-cols-3 gap-2">
            <span className="text-muted-foreground">Notes</span>
            <textarea
              className="col-span-2 rounded border bg-background px-2 py-1 text-sm"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!title.trim()}
              className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)} className="rounded border px-3 py-1 text-sm text-destructive">
              Supprimer
            </button>
          </div>
        </div>
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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

function FieldInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-muted-foreground">{label}</span>
      <input
        className="col-span-2 rounded border bg-background px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  )
}
