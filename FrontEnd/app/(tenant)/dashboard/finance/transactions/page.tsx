'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  fetchFinanceAccounts,
  fetchFinanceCategories,
  fetchFinanceTransactions,
  type FinanceAccount,
  type FinanceCategory,
  type FinanceTransaction,
  updateFinanceTransaction,
} from '../_lib/finance-api'
import { notify } from '@/lib/notify'
import { DataPagination } from '@/components/ui/data-pagination'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DateTimeField } from '@/components/ui/date-time-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useStore } from '@/lib/store'
import { formatMoneyWithCurrencySuffix, normalizeCurrencyCode } from '@/lib/currency'

export default function FinanceTransactionsPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const [rows, setRows] = useState<FinanceTransaction[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceTransaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinanceTransaction | null>(null)
  const [title, setTitle] = useState('')
  const [transactionType, setTransactionType] = useState<FinanceTransaction['transaction_type']>('expense')
  const [amount, setAmount] = useState('0')
  const [bookedOn, setBookedOn] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [transferAccountId, setTransferAccountId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    Promise.all([fetchFinanceTransactions(), fetchFinanceAccounts(), fetchFinanceCategories()])
      .then(([transactionsData, accountsData, categoriesData]) => {
        setRows(transactionsData)
        setAccounts(accountsData)
        setCategories(categoriesData)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const resetForm = () => {
    setTitle('')
    setTransactionType('expense')
    setAmount('0')
    setBookedOn(new Date().toISOString().slice(0, 10))
    setAccountId(accounts[0]?.id || '')
    setCategoryId('')
    setTransferAccountId('')
    setReference('')
    setNotes('')
  }

  const openCreate = () => {
    setEditing(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (row: FinanceTransaction) => {
    setEditing(row)
    setTitle(row.title || '')
    setTransactionType(row.transaction_type)
    setAmount(row.amount || '0')
    setBookedOn(row.booked_on || new Date().toISOString().slice(0, 10))
    setAccountId(row.account || '')
    setCategoryId(row.category || '')
    setTransferAccountId(row.transfer_account || '')
    setReference(row.reference || '')
    setNotes(row.notes || '')
    setDialogOpen(true)
  }

  const submitForm = async () => {
    setError(null)
    try {
      const payload = {
        title: title.trim(),
        transaction_type: transactionType,
        amount: amount || '0',
        booked_on: bookedOn,
        account: accountId,
        category: transactionType === 'transfer' ? null : categoryId || null,
        transfer_account: transactionType === 'transfer' ? transferAccountId || null : null,
        reference: reference.trim(),
        notes: notes.trim(),
      }
      if (editing) {
        const updated = await updateFinanceTransaction(editing.id, payload)
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        notify.success('Transaction mise à jour')
      } else {
        const created = await createFinanceTransaction(payload)
        setRows((prev) => [created, ...prev])
        notify.success('Transaction ajoutée')
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
      await deleteFinanceTransaction(deleteTarget.id)
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
      notify.success('Transaction supprimée')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.is_active && (transactionType === 'income' ? c.kind === 'income' : c.kind === 'expense')),
    [categories, transactionType]
  )

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.title.toLowerCase().includes(q) || r.transaction_type.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q))
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])
  useEffect(() => setPage(1), [query])
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-x-hidden overflow-y-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openCreate} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Nouvelle transaction
          </button>
          <Link href="/dashboard/finance" className="text-sm text-muted-foreground hover:text-foreground">Retour finance</Link>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <input className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="Rechercher une transaction" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-w-0 overflow-auto rounded-md border">
          <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Libellé</th>
              <th className="p-2 text-left font-medium">Type</th>
              <th className="p-2 text-left font-medium">Date</th>
              <th className="p-2 text-left font-medium">Compte</th>
              <th className="p-2 text-left font-medium">Montant</th>
              <th className="p-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => {
              const account = accountMap.get(row.account)
              return (
                <tr key={row.id} className="border-t">
                  <td className="p-2">{row.title}</td>
                  <td className="p-2 text-muted-foreground">{TYPE_LABELS[row.transaction_type]}</td>
                  <td className="p-2 text-muted-foreground">{row.booked_on}</td>
                  <td className="p-2 text-muted-foreground">{account?.name || '—'}</td>
                  <td className="p-2 tabular-nums text-muted-foreground">
                    {formatMoneyWithCurrencySuffix(row.amount, account?.currency_code || tenantCurrency)}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(row)} className="rounded border px-2 py-1 text-xs">Modifier</button>
                      <button type="button" onClick={() => setDeleteTarget(row)} className="rounded border px-2 py-1 text-xs text-destructive">Supprimer</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
          {filteredRows.length === 0 && !error ? <p className="p-4 text-sm text-muted-foreground">Aucune transaction.</p> : null}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier transaction' : 'Nouvelle transaction'}</DialogTitle>
            <DialogDescription>Saisir un flux financier avec type, compte et montant.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Libellé *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={transactionType} onValueChange={(v) => setTransactionType(v as FinanceTransaction['transaction_type'])}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Revenu</SelectItem>
                    <SelectItem value="expense">Dépense</SelectItem>
                    <SelectItem value="transfer">Transfert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <DateTimeField label="Date comptable" value={bookedOn} onChange={setBookedOn} mode="date" />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Compte source</Label>
                <Select value={accountId || 'none'} onValueChange={(v) => setAccountId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Compte" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sélectionner</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Montant ({tenantCurrency})</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            {transactionType === 'transfer' ? (
              <div className="space-y-1">
                <Label>Compte destinataire</Label>
                <Select value={transferAccountId || 'none'} onValueChange={(v) => setTransferAccountId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Compte destinataire" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sélectionner</SelectItem>
                    {accounts
                      .filter((acc) => acc.id !== accountId)
                      .map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Catégorie</Label>
                <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans catégorie</SelectItem>
                    {filteredCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Référence</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea className="w-full rounded border bg-background px-2 py-1 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded border px-3 py-1 text-sm">Annuler</button>
            <button type="button" onClick={submitForm} disabled={!title.trim() || !accountId || !bookedOn} className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50">Enregistrer</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette transaction ?</AlertDialogTitle>
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

const TYPE_LABELS: Record<FinanceTransaction['transaction_type'], string> = {
  income: 'Revenu',
  expense: 'Dépense',
  transfer: 'Transfert',
}

