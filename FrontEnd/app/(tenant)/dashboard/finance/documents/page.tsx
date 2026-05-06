'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  createFinanceDocument,
  deleteFinanceDocument,
  fetchFinanceAccounts,
  fetchFinanceCategories,
  fetchFinanceDocuments,
  fetchFinanceInvoices,
  fetchFinanceTransactions,
  type FinanceAccount,
  type FinanceCategory,
  type FinanceDocument,
  type FinanceInvoice,
  type FinanceTransaction,
  updateFinanceDocument,
} from '../_lib/finance-api'
import { DataPagination } from '@/components/ui/data-pagination'
import { notify } from '@/lib/notify'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimeField } from '@/components/ui/date-time-field'
import { useStore } from '@/lib/store'
import { formatMoneyWithCurrencySuffix, normalizeCurrencyCode } from '@/lib/currency'

export default function FinanceDocumentsPage() {
  const tenantCurrency = useStore((s) => normalizeCurrencyCode(s.tenant.currencyCode))
  const [rows, setRows] = useState<FinanceDocument[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceDocument | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinanceDocument | null>(null)

  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState<FinanceDocument['document_type']>('misc')
  const [reportScope, setReportScope] = useState<FinanceDocument['report_scope']>('misc')
  const [documentDate, setDocumentDate] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('0')
  const [currencyCode, setCurrencyCode] = useState(tenantCurrency)
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')

  const load = async () => {
    setError(null)
    try {
      const [documents, accs, cats, txs, invs] = await Promise.all([
        fetchFinanceDocuments(),
        fetchFinanceAccounts(),
        fetchFinanceCategories(),
        fetchFinanceTransactions(),
        fetchFinanceInvoices(),
      ])
      setRows(documents)
      setAccounts(accs)
      setCategories(cats)
      setTransactions(txs)
      setInvoices(invs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetForm = () => {
    setTitle('')
    setDocumentType('misc')
    setReportScope('misc')
    setDocumentDate(new Date().toISOString().slice(0, 10))
    setReference('')
    setAmount('0')
    setCurrencyCode(tenantCurrency)
    setDescription('')
    setSourceUrl('')
    setAccountId('')
    setCategoryId('')
    setTransactionId('')
    setInvoiceId('')
  }

  const openCreate = () => {
    setEditing(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (row: FinanceDocument) => {
    setEditing(row)
    setTitle(row.title || '')
    setDocumentType(row.document_type)
    setReportScope(row.report_scope)
    setDocumentDate(row.document_date || '')
    setReference(row.reference || '')
    setAmount(row.amount || '0')
    setCurrencyCode(normalizeCurrencyCode(row.currency_code))
    setDescription(row.description || '')
    setSourceUrl(row.source_url || '')
    setAccountId(row.account || '')
    setCategoryId(row.category || '')
    setTransactionId(row.transaction || '')
    setInvoiceId(row.invoice || '')
    setDialogOpen(true)
  }

  const submitForm = async () => {
    setError(null)
    try {
      const payload = {
        title: title.trim(),
        document_type: documentType,
        report_scope: reportScope,
        document_date: documentDate,
        reference: reference.trim(),
        amount: amount || '0',
        currency_code: normalizeCurrencyCode(currencyCode),
        description: description.trim(),
        source_url: sourceUrl.trim(),
        account: accountId || null,
        category: categoryId || null,
        transaction: transactionId || null,
        invoice: invoiceId || null,
      }
      if (editing) {
        const updated = await updateFinanceDocument(editing.id, payload)
        setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        notify.success('Pièce mise à jour')
      } else {
        const created = await createFinanceDocument(payload)
        setRows((prev) => [created, ...prev])
        notify.success('Pièce ajoutée')
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
      await deleteFinanceDocument(deleteTarget.id)
      setRows((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      setDeleteTarget(null)
      notify.success('Pièce supprimée')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.title.toLowerCase().includes(q) || r.document_type.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q))
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])
  useEffect(() => setPage(1), [query])
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-x-hidden overflow-y-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Pièces comptables</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openCreate} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Nouvelle pièce
          </button>
          <Link href="/dashboard/finance" className="text-sm text-muted-foreground hover:text-foreground">
            Retour finance
          </Link>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <input className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="Rechercher une pièce" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-w-0 overflow-auto rounded-md border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium">Titre</th>
                <th className="p-2 text-left font-medium">Type</th>
                <th className="p-2 text-left font-medium">Rapport</th>
                <th className="p-2 text-left font-medium">Date</th>
                <th className="p-2 text-left font-medium">Référence</th>
                <th className="p-2 text-left font-medium">Montant</th>
                <th className="p-2 text-left font-medium">Source</th>
                <th className="p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-medium">{row.title}</td>
                  <td className="p-2 text-muted-foreground">{DOC_TYPE_LABELS[row.document_type]}</td>
                  <td className="p-2 text-muted-foreground">{REPORT_SCOPE_LABELS[row.report_scope]}</td>
                  <td className="p-2 text-muted-foreground">{row.document_date}</td>
                  <td className="p-2 text-muted-foreground">{row.reference || '—'}</td>
                  <td className="p-2 tabular-nums text-muted-foreground">{formatMoneyWithCurrencySuffix(row.amount, row.currency_code || tenantCurrency)}</td>
                  <td className="p-2 text-muted-foreground">
                    {row.source_url ? (
                      <a href={row.source_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        Ouvrir
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
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
          {filteredRows.length === 0 && !error ? <p className="p-4 text-sm text-muted-foreground">Aucune pièce comptable.</p> : null}
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier pièce' : 'Nouvelle pièce'}</DialogTitle>
            <DialogDescription>Rattacher les justificatifs aux rapports financiers.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Titre *</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <DateTimeField label="Date document" value={documentDate} onChange={setDocumentDate} mode="date" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Type de pièce</Label>
                <Select value={documentType} onValueChange={(v) => setDocumentType(v as FinanceDocument['document_type'])}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Scope rapport</Label>
                <Select value={reportScope} onValueChange={(v) => setReportScope(v as FinanceDocument['report_scope'])}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Rapport" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPORT_SCOPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Montant ({normalizeCurrencyCode(currencyCode)})</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Devise</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm uppercase" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Référence</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Compte</Label>
                <Select value={accountId || 'none'} onValueChange={(v) => setAccountId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Compte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Catégorie</Label>
                <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Transaction liée</Label>
                <Select value={transactionId || 'none'} onValueChange={(v) => setTransactionId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Transaction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {transactions.slice(0, 200).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Facture liée</Label>
                <Select value={invoiceId || 'none'} onValueChange={(v) => setInvoiceId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Facture" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Lien pièce (URL)</Label>
              <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <textarea className="w-full rounded border bg-background px-2 py-1 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={!title.trim() || !documentDate}
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
            <AlertDialogTitle>Supprimer cette pièce ?</AlertDialogTitle>
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

const DOC_TYPE_LABELS: Record<FinanceDocument['document_type'], string> = {
  invoice: 'Facture',
  receipt: 'Reçu',
  purchase: 'Achat',
  bank_statement: 'Relevé bancaire',
  payroll: 'Paie',
  tax: 'Fiscalité',
  misc: 'Divers',
}

const REPORT_SCOPE_LABELS: Record<FinanceDocument['report_scope'], string> = {
  balance_sheet: 'Bilan',
  income_statement: 'Compte de résultat',
  cashflow: 'Flux de trésorerie',
  tax: 'Fiscal',
  audit: 'Audit',
  misc: 'Divers',
}
