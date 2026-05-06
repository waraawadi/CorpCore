'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { deleteCrmContact, fetchCrmContact, updateCrmContact, type CrmContact } from '../../_lib/crm-api'
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

export default function CrmContactDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    fetchCrmContact(params.id)
      .then((c) => {
        setContact(c)
        setFirstName(c.first_name || '')
        setLastName(c.last_name || '')
        setEmail(c.email || '')
        setPhone(c.phone || '')
        setCompany(c.company_name || '')
        setNotes(c.notes || '')
      })
      .catch((e: Error) => setError(e.message))
  }, [params?.id])

  const onSave = async () => {
    if (!contact) return
    setError(null)
    try {
      const updated = await updateCrmContact(contact.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company_name: company.trim(),
        notes: notes.trim(),
      })
      setContact(updated)
      notify.success('Contact mis à jour')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de mise à jour'
      setError(msg)
      notify.error('Mise à jour impossible', msg)
    }
  }

  const onDelete = async () => {
    if (!contact) return
    setError(null)
    try {
      await deleteCrmContact(contact.id)
      notify.success('Contact supprimé')
      router.push('/dashboard/crm/contacts')
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
          <CrmContactsNavIcon className="text-primary" />
          <h1 className="text-xl font-semibold">Détail contact</h1>
        </div>
        <Link href="/dashboard/crm/contacts" className="text-sm text-muted-foreground hover:text-foreground">
          Retour contacts
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!contact && !error && <p className="text-sm text-muted-foreground">Chargement...</p>}

      {contact && (
        <div className="rounded-md border p-4 space-y-3 text-sm">
          <FieldInput label="Prénom" value={firstName} onChange={setFirstName} required />
          <FieldInput label="Nom" value={lastName} onChange={setLastName} />
          <FieldInput label="Email" value={email} onChange={setEmail} />
          <FieldInput label="Téléphone" value={phone} onChange={setPhone} />
          <FieldInput label="Société" value={company} onChange={setCompany} />
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
              disabled={!firstName.trim()}
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
