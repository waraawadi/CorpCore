'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { deleteFinanceAccount, fetchFinanceAccounts, type FinanceAccount, createFinanceAccount, updateFinanceAccount } from '../_lib/finance-api'
import { notify } from '@/lib/notify'
import { DataPagination } from '@/components/ui/data-pagination'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { useStore } from '@/lib/store'
import { formatMoneyWithCurrencySuffix, normalizeCurrencyCode } from '@/lib/currency'

export default function FinanceAccountsPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const [rows, setRows] = useState<FinanceAccount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinanceAccount | null>(null)
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<FinanceAccount['account_type']>('bank')
  const [currencyCode, setCurrencyCode] = useState(tenantCurrency)
  const [openingBalance, setOpeningBalance] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchFinanceAccounts()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
  }, [])

  const resetForm = () => {
    setName('')
    setAccountType('bank')
    setCurrencyCode(tenantCurrency)
    setOpeningBalance('0')
    setIsActive(true)
  }

  const openCreate = () => {
    resetForm()
    setEditing(null)
    setCreateOpen(true)
  }

  const openEdit = (row: FinanceAccount) => {
    setEditing(row)
    setName(row.name || '')
    setAccountType(row.account_type)
    setCurrencyCode(normalizeCurrencyCode(row.currency_code))
    setOpeningBalance(row.opening_balance || '0')
    setIsActive(Boolean(row.is_active))
    setCreateOpen(true)
  }

  const submitForm = async () => {
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        account_type: accountType,
        currency_code: normalizeCurrencyCode(currencyCode),
        opening_balance: openingBalance || '0',
        is_active: isActive,
      }
      if (editing) {
        const updated = await updateFinanceAccount(editing.id, payload)
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        notify.success('Compte mis à jour')
      } else {
        const created = await createFinanceAccount(payload)
        setRows((prev) => [created, ...prev])
        notify.success('Compte ajouté')
      }
      setCreateOpen(false)
      resetForm()
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
      await deleteFinanceAccount(deleteTarget.id)
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
      notify.success('Compte supprimé')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.account_type.toLowerCase().includes(q))
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])

  useEffect(() => setPage(1), [query])
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-x-hidden overflow-y-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Comptes financiers</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openCreate} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Nouveau compte
          </button>
          <Link href="/dashboard/finance" className="text-sm text-muted-foreground hover:text-foreground">
            Retour finance
          </Link>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <input
        className="w-full rounded border bg-background px-3 py-2 text-sm"
        placeholder="Rechercher un compte"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-w-0 overflow-auto rounded-md border">
          <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Nom</th>
              <th className="p-2 text-left font-medium">Type</th>
              <th className="p-2 text-left font-medium">Devise</th>
              <th className="p-2 text-left font-medium">Solde initial</th>
              <th className="p-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.name}</td>
                <td className="p-2 text-muted-foreground">{TYPE_LABELS[row.account_type]}</td>
                <td className="p-2 text-muted-foreground">{normalizeCurrencyCode(row.currency_code)}</td>
                <td className="p-2 tabular-nums text-muted-foreground">{formatMoneyWithCurrencySuffix(row.opening_balance, row.currency_code)}</td>
                <td className="p-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openEdit(row)} className="rounded border px-2 py-1 text-xs">
                      Modifier
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(row)} className="rounded border px-2 py-1 text-xs text-destructive">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
          {filteredRows.length === 0 && !error ? <p className="p-4 text-sm text-muted-foreground">Aucun compte.</p> : null}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier compte' : 'Nouveau compte'}</DialogTitle>
            <DialogDescription>Configurer un compte de trésorerie.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as FinanceAccount['account_type'])}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Type de compte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Caisse</SelectItem>
                  <SelectItem value="bank">Banque</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Devise</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm uppercase" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Solde initial ({normalizeCurrencyCode(currencyCode)})</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="finance-account-active">Compte actif</Label>
              <Switch id="finance-account-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button type="button" onClick={submitForm} disabled={!name.trim()} className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50">
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
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

const TYPE_LABELS: Record<FinanceAccount['account_type'], string> = {
  cash: 'Caisse',
  bank: 'Banque',
  mobile_money: 'Mobile money',
}

