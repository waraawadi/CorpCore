'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { deleteCrmOpportunity, fetchCrmOpportunity, updateCrmOpportunity, type CrmOpportunity } from '../../_lib/crm-api'
import { CrmOpportunitiesNavIcon } from '@/components/crm-animate-icons'
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

export default function CrmOpportunityDetailPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [opportunity, setOpportunity] = useState<CrmOpportunity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [stage, setStage] = useState('discovery')
  const [amount, setAmount] = useState('0')
  const [probability, setProbability] = useState('0')
  const [notes, setNotes] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    fetchCrmOpportunity(params.id)
      .then((o) => {
        setOpportunity(o)
        setName(o.name || '')
        setStage(o.stage || 'discovery')
        setAmount(o.amount || '0')
        setProbability(String(o.probability ?? 0))
        setNotes(o.notes || '')
      })
      .catch((e: Error) => setError(e.message))
  }, [params?.id])

  const onSave = async () => {
    if (!opportunity) return
    setError(null)
    try {
      const updated = await updateCrmOpportunity(opportunity.id, {
        name: name.trim(),
        stage,
        amount: amount.trim() || '0',
        probability: Number(probability || 0),
        notes: notes.trim(),
      })
      setOpportunity(updated)
      notify.success('Opportunité mise à jour')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de mise à jour'
      setError(msg)
      notify.error('Mise à jour impossible', msg)
    }
  }

  const onDelete = async () => {
    if (!opportunity) return
    setError(null)
    try {
      await deleteCrmOpportunity(opportunity.id)
      notify.success('Opportunité supprimée')
      router.push('/dashboard/crm/opportunities')
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
          <CrmOpportunitiesNavIcon className="text-primary" />
          <h1 className="text-xl font-semibold">Détail opportunité</h1>
        </div>
        <Link href="/dashboard/crm/opportunities" className="text-sm text-muted-foreground hover:text-foreground">
          Retour opportunités
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!opportunity && !error && <p className="text-sm text-muted-foreground">Chargement...</p>}

      {opportunity && (
        <div className="rounded-md border p-4 space-y-3 text-sm">
          <FieldInput label="Nom" value={name} onChange={setName} required />
          <div className="grid grid-cols-3 gap-2">
            <span className="text-muted-foreground">Étape</span>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="col-span-2 w-full">
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
          <FieldInput label={`Montant (${tenantCurrency})`} value={amount} onChange={setAmount} />
          <FieldInput label="Probabilité (%)" value={probability} onChange={setProbability} />
          <FieldInput label="Lead ID" value={opportunity.lead || ''} onChange={() => undefined} />
          <FieldInput label="Contact ID" value={opportunity.contact || ''} onChange={() => undefined} />
          <FieldInput label="Date de clôture" value={opportunity.expected_close_date || ''} onChange={() => undefined} />
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
              disabled={!name.trim()}
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
