'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  createFinanceInvoice,
  createFinanceInvoiceLine,
  deleteFinanceInvoice,
  deleteFinanceInvoiceLine,
  fetchFinanceCategories,
  fetchFinanceInvoiceLines,
  fetchFinanceInvoices,
  type FinanceCategory,
  type FinanceInvoice,
  type FinanceInvoiceLine,
  updateFinanceInvoiceLine,
  updateFinanceInvoice,
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

export default function FinanceInvoicesPage() {
  const searchParams = useSearchParams()
  const queryFromUrl = searchParams.get('query') || ''
  const tenant = useStore((s) => s.tenant)
  const tenantCurrency = normalizeCurrencyCode(tenant.currencyCode)
  const [rows, setRows] = useState<FinanceInvoice[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [lineRows, setLineRows] = useState<FinanceInvoiceLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceInvoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinanceInvoice | null>(null)
  const [lineDeleteTarget, setLineDeleteTarget] = useState<FinanceInvoiceLine | null>(null)

  const [number, setNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [currencyCode, setCurrencyCode] = useState(tenantCurrency)
  const [issuedOn, setIssuedOn] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [status, setStatus] = useState<FinanceInvoice['status']>('draft')
  const [paidAmount, setPaidAmount] = useState('0')
  const [notes, setNotes] = useState('')

  const [linesDialogOpen, setLinesDialogOpen] = useState(false)
  const [linesInvoice, setLinesInvoice] = useState<FinanceInvoice | null>(null)
  const [editingLine, setEditingLine] = useState<FinanceInvoiceLine | null>(null)
  const [lineInvoiceId, setLineInvoiceId] = useState('')
  const [lineDescription, setLineDescription] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [lineUnitPrice, setLineUnitPrice] = useState('0')
  const [lineTaxRate, setLineTaxRate] = useState('0')
  const [lineCategory, setLineCategory] = useState('')

  const load = async () => {
    setError(null)
    try {
      const [invoices, invoiceLines, cats] = await Promise.all([fetchFinanceInvoices(), fetchFinanceInvoiceLines(), fetchFinanceCategories()])
      setRows(invoices)
      setLineRows(invoiceLines)
      setCategories(cats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (queryFromUrl) {
      setQuery(queryFromUrl)
    }
  }, [queryFromUrl])

  const resetForm = () => {
    const today = new Date().toISOString().slice(0, 10)
    setNumber(`INV-${today.replaceAll('-', '')}-${Math.floor(Math.random() * 900 + 100)}`)
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCurrencyCode(tenantCurrency)
    setIssuedOn(today)
    setDueOn('')
    setStatus('draft')
    setPaidAmount('0')
    setNotes('')
  }

  const openCreate = () => {
    setEditing(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (row: FinanceInvoice) => {
    setEditing(row)
    setNumber(row.number)
    setCustomerName(row.customer_name)
    setCustomerEmail(row.customer_email || '')
    setCustomerPhone(row.customer_phone || '')
    setCurrencyCode(normalizeCurrencyCode(row.currency_code))
    setIssuedOn(row.issued_on || '')
    setDueOn(row.due_on || '')
    setStatus(row.status)
    setPaidAmount(row.paid_amount || '0')
    setNotes(row.notes || '')
    setDialogOpen(true)
  }

  const submitForm = async () => {
    setError(null)
    try {
      const payload = {
        number: number.trim(),
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim(),
        currency_code: normalizeCurrencyCode(currencyCode),
        issued_on: issuedOn,
        due_on: dueOn || null,
        status,
        paid_amount: paidAmount || '0',
        notes: notes.trim(),
      }
      if (editing) {
        const updated = await updateFinanceInvoice(editing.id, payload)
        setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        notify.success('Facture mise à jour')
      } else {
        const created = await createFinanceInvoice(payload)
        setRows((prev) => [created, ...prev])
        notify.success('Facture créée')
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
      await deleteFinanceInvoice(deleteTarget.id)
      setRows((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      setLineRows((prev) => prev.filter((x) => x.invoice !== deleteTarget.id))
      setDeleteTarget(null)
      notify.success('Facture supprimée')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Suppression impossible', msg)
    }
  }

  const resetLineForm = (invoiceId?: string) => {
    setEditingLine(null)
    setLineInvoiceId(invoiceId || '')
    setLineDescription('')
    setLineQty('1')
    setLineUnitPrice('0')
    setLineTaxRate('0')
    setLineCategory('')
  }

  const openLinesDialog = (invoice: FinanceInvoice) => {
    setLinesInvoice(invoice)
    resetLineForm(invoice.id)
    setLinesDialogOpen(true)
  }

  const openLineEdit = (line: FinanceInvoiceLine) => {
    setEditingLine(line)
    setLineInvoiceId(line.invoice)
    setLineDescription(line.description || '')
    setLineQty(line.quantity || '1')
    setLineUnitPrice(line.unit_price || '0')
    setLineTaxRate(line.tax_rate || '0')
    setLineCategory(line.category || '')
  }

  const submitLine = async () => {
    if (!lineInvoiceId) return
    setError(null)
    try {
      const payload = {
        invoice: lineInvoiceId,
        description: lineDescription.trim(),
        quantity: lineQty || '1',
        unit_price: lineUnitPrice || '0',
        tax_rate: lineTaxRate || '0',
        category: lineCategory || null,
      }
      if (editingLine) {
        const updated = await updateFinanceInvoiceLine(editingLine.id, payload)
        setLineRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        notify.success('Ligne mise à jour')
      } else {
        const created = await createFinanceInvoiceLine(payload)
        setLineRows((prev) => [...prev, created])
        notify.success('Ligne ajoutée')
      }
      const refreshed = await fetchFinanceInvoices()
      setRows(refreshed)
      resetLineForm(lineInvoiceId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Enregistrement ligne impossible', msg)
    }
  }

  const onDeleteLine = async () => {
    if (!lineDeleteTarget) return
    setError(null)
    try {
      await deleteFinanceInvoiceLine(lineDeleteTarget.id)
      setLineRows((prev) => prev.filter((x) => x.id !== lineDeleteTarget.id))
      const refreshed = await fetchFinanceInvoices()
      setRows(refreshed)
      if (editingLine?.id === lineDeleteTarget.id) {
        resetLineForm(lineDeleteTarget.invoice)
      }
      setLineDeleteTarget(null)
      notify.success('Ligne supprimée')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
      notify.error('Suppression ligne impossible', msg)
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.number.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q) || r.status.toLowerCase().includes(q))
  }, [rows, query])

  const linesByInvoice = useMemo(() => {
    const map = new Map<string, FinanceInvoiceLine[]>()
    lineRows.forEach((line) => {
      if (!map.has(line.invoice)) map.set(line.invoice, [])
      map.get(line.invoice)!.push(line)
    })
    return map
  }, [lineRows])

  const currentInvoiceLines = useMemo(() => {
    if (!linesInvoice) return []
    return linesByInvoice.get(linesInvoice.id) || []
  }, [linesByInvoice, linesInvoice])

  const printInvoice = (invoice: FinanceInvoice) => {
    const lines = linesByInvoice.get(invoice.id) || []
    const popup = window.open('', '_blank')
    if (!popup) {
      notify.error('Impression impossible', 'Autorisez les popups pour continuer.')
      return
    }

    const logoTag = tenant.logoUrl
      ? `<img src="${tenant.logoUrl}" alt="Logo entreprise" style="height:56px;width:56px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;" />`
      : ''
    const companyName = escapeHtml(tenant.name || 'Entreprise')
    const slogan = escapeHtml(tenant.slogan || '')
    const customer = escapeHtml(invoice.customer_name || '')
    const number = escapeHtml(invoice.number || '')
    const issuedOn = escapeHtml(invoice.issued_on || '')
    const dueOn = escapeHtml(invoice.due_on || '—')
    const notes = escapeHtml(invoice.notes || '')

    const linesHtml = lines.length
      ? lines
          .map(
            (line) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(line.description || '')}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(line.quantity || '0')}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatMoneyWithCurrencySuffix(line.unit_price, invoice.currency_code || tenantCurrency))}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(line.tax_rate || '0')}%</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatMoneyWithCurrencySuffix(line.line_total, invoice.currency_code || tenantCurrency))}</td>
              </tr>
            `
          )
          .join('')
      : `<tr><td colspan="5" style="padding:10px;color:#6b7280;">Aucune ligne</td></tr>`

    const statusLabel = INVOICE_STATUS_LABELS[invoice.status] || invoice.status
    const statusColor =
      invoice.status === 'paid'
        ? '#166534'
        : invoice.status === 'partial'
          ? '#92400e'
          : invoice.status === 'cancelled'
            ? '#991b1b'
            : '#1d4ed8'

    popup.document.write(`
      <html>
        <head>
          <title>Facture ${number}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              font-family: Inter, Arial, sans-serif;
              color: #0f172a;
              background: #f8fafc;
              margin: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sheet {
              width: 100%;
              min-height: 100%;
              border: 1px solid #e2e8f0;
              background: #ffffff;
              border-radius: 16px;
              padding: 18px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              padding: 14px;
              border-radius: 14px;
              background: linear-gradient(135deg, #eff6ff, #f8fafc 55%, #eef2ff);
              border: 1px solid #dbeafe;
            }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand h1 { margin: 0; font-size: 20px; line-height: 1.2; }
            .muted { color: #64748b; font-size: 12px; }
            .invoice-title { text-align: right; }
            .invoice-title .big { font-size: 24px; font-weight: 800; letter-spacing: 0.6px; }
            .status {
              margin-top: 8px;
              display: inline-block;
              border-radius: 999px;
              padding: 4px 10px;
              font-size: 11px;
              font-weight: 700;
              border: 1px solid currentColor;
            }
            .meta {
              margin-top: 14px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 10px 12px;
              background: #ffffff;
            }
            .card-title { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
            th { text-align: left; font-size: 11px; color: #475569; padding: 9px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; text-transform: uppercase; letter-spacing: 0.3px; }
            td { padding: 9px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .num { text-align: right; white-space: nowrap; }
            .totals {
              margin-top: 16px;
              margin-left: auto;
              width: 360px;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 10px 12px;
              background: #f8fafc;
            }
            .totals div { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
            .totals .grand { border-top: 1px dashed #cbd5e1; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: 800; }
            .notes {
              margin-top: 14px;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 10px 12px;
              background: #fff;
              font-size: 13px;
            }
            .footer {
              margin-top: 14px;
              font-size: 11px;
              color: #64748b;
              display: flex;
              justify-content: space-between;
              gap: 8px;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div class="brand">
                ${logoTag}
                <div>
                  <h1>${companyName}</h1>
                </div>
              </div>
              <div class="invoice-title">
                <div class="big">FACTURE</div>
                <div class="muted">N° ${number}</div>
                <span class="status" style="color:${statusColor};">${escapeHtml(statusLabel)}</span>
              </div>
            </div>

            <div class="meta">
              <div class="card">
                <div class="card-title">Client</div>
                <div style="font-weight:700;">${customer}</div>
                <div class="muted" style="margin-top:6px;">Référence facture: ${number}</div>
              </div>
              <div class="card" style="text-align:right;">
                <div class="card-title">Dates</div>
                <div><strong>Emission:</strong> ${issuedOn}</div>
                <div><strong>Echéance:</strong> ${dueOn}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="num">Qté</th>
                  <th class="num">P.U</th>
                  <th class="num">Taxe</th>
                  <th class="num">Total ligne</th>
                </tr>
              </thead>
              <tbody>${linesHtml}</tbody>
            </table>
            <div class="totals">
              <div><span>Sous-total</span><strong>${escapeHtml(formatMoneyWithCurrencySuffix(invoice.subtotal_amount, invoice.currency_code || tenantCurrency))}</strong></div>
              <div><span>Taxe</span><strong>${escapeHtml(formatMoneyWithCurrencySuffix(invoice.tax_amount, invoice.currency_code || tenantCurrency))}</strong></div>
              <div><span>Déjà payé</span><strong>${escapeHtml(formatMoneyWithCurrencySuffix(invoice.paid_amount, invoice.currency_code || tenantCurrency))}</strong></div>
              <div class="grand"><span>Total dû</span><strong>${escapeHtml(formatMoneyWithCurrencySuffix(invoice.total_amount, invoice.currency_code || tenantCurrency))}</strong></div>
            </div>
            ${notes ? `<div class="notes"><div class="card-title">Notes</div>${notes}</div>` : ''}
            <div class="footer">
              <span>Document généré par CorpCore</span>
              <span>${slogan ? `${slogan} - ` : ''}${companyName}</span>
            </div>
          </div>
        </body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])
  useEffect(() => setPage(1), [query])
  useEffect(() => setPage((prev) => Math.min(prev, totalPages)), [totalPages])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-x-hidden overflow-y-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Facturation</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openCreate} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Nouvelle facture
          </button>
          <Link href="/dashboard/finance" className="text-sm text-muted-foreground hover:text-foreground">
            Retour finance
          </Link>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <input className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="Rechercher une facture" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-w-0 overflow-auto rounded-md border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium">Numéro</th>
                <th className="p-2 text-left font-medium">Client</th>
                <th className="p-2 text-left font-medium">Émission</th>
                <th className="p-2 text-left font-medium">Statut</th>
                <th className="p-2 text-left font-medium">Total</th>
                <th className="p-2 text-left font-medium">Payé</th>
                <th className="p-2 text-left font-medium">Lignes</th>
                <th className="p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const lines = linesByInvoice.get(row.id) || []
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-2 font-medium">{row.number}</td>
                    <td className="p-2 text-muted-foreground">{row.customer_name}</td>
                    <td className="p-2 text-muted-foreground">{row.issued_on}</td>
                    <td className="p-2 text-muted-foreground">{INVOICE_STATUS_LABELS[row.status]}</td>
                    <td className="p-2 tabular-nums text-muted-foreground">{formatMoneyWithCurrencySuffix(row.total_amount, row.currency_code)}</td>
                    <td className="p-2 tabular-nums text-muted-foreground">{formatMoneyWithCurrencySuffix(row.paid_amount, row.currency_code)}</td>
                    <td className="p-2 text-muted-foreground">{lines.length}</td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openLinesDialog(row)} className="rounded border px-2 py-1 text-xs">
                          Lignes
                        </button>
                        <button type="button" onClick={() => printInvoice(row)} className="rounded border px-2 py-1 text-xs">
                          Imprimer
                        </button>
                        <button type="button" onClick={() => openEdit(row)} className="rounded border px-2 py-1 text-xs">
                          Modifier
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(row)} className="rounded border px-2 py-1 text-xs text-destructive">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredRows.length === 0 && !error ? <p className="p-4 text-sm text-muted-foreground">Aucune facture.</p> : null}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier facture' : 'Nouvelle facture'}</DialogTitle>
            <DialogDescription>Créer une facture et suivre les paiements.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Numéro *</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client *</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Email client</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Téléphone client</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <DateTimeField label="Date émission" value={issuedOn} onChange={setIssuedOn} mode="date" />
              <DateTimeField label="Échéance" value={dueOn} onChange={setDueOn} mode="date" />
              <div className="space-y-1">
                <Label>Devise</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm uppercase" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as FinanceInvoice['status'])}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="issued">Émise</SelectItem>
                    <SelectItem value="partial">Partiellement payée</SelectItem>
                    <SelectItem value="paid">Payée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Montant payé ({normalizeCurrencyCode(currencyCode)})</Label>
                <input className="w-full rounded border bg-background px-2 py-1 text-sm" type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea className="w-full rounded border bg-background px-2 py-1 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded border px-3 py-1 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={!number.trim() || !customerName.trim() || !issuedOn}
              className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={linesDialogOpen}
        onOpenChange={(open) => {
          setLinesDialogOpen(open)
          if (!open) {
            setLinesInvoice(null)
            resetLineForm('')
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lignes de facture {linesInvoice ? `- ${linesInvoice.number}` : ''}</DialogTitle>
            <DialogDescription>Ajouter, modifier ou supprimer les lignes dans ce même écran.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">{editingLine ? 'Modifier la ligne' : 'Nouvelle ligne'}</p>
              <div className="mt-3 grid gap-3">
                <div className="space-y-1">
                  <Label>Description *</Label>
                  <input className="w-full rounded border bg-background px-2 py-1 text-sm" value={lineDescription} onChange={(e) => setLineDescription(e.target.value)} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Quantité</Label>
                    <input className="w-full rounded border bg-background px-2 py-1 text-sm" type="number" value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Prix unitaire</Label>
                    <input className="w-full rounded border bg-background px-2 py-1 text-sm" type="number" value={lineUnitPrice} onChange={(e) => setLineUnitPrice(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Taxe (%)</Label>
                    <input className="w-full rounded border bg-background px-2 py-1 text-sm" type="number" value={lineTaxRate} onChange={(e) => setLineTaxRate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Catégorie</Label>
                  <Select value={lineCategory || 'none'} onValueChange={(v) => setLineCategory(v === 'none' ? '' : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sans catégorie</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitLine}
                    disabled={!lineDescription.trim() || !lineInvoiceId}
                    className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {editingLine ? 'Enregistrer la ligne' : 'Ajouter la ligne'}
                  </button>
                  {editingLine ? (
                    <button type="button" onClick={() => resetLineForm(lineInvoiceId)} className="rounded border px-3 py-1 text-sm">
                      Annuler édition
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">Lignes existantes ({currentInvoiceLines.length})</p>
              <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {currentInvoiceLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune ligne.</p>
                ) : (
                  currentInvoiceLines.map((line) => (
                    <div key={line.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border px-2 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="min-w-0 truncate font-medium">{line.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Qté {line.quantity} x {formatMoneyWithCurrencySuffix(line.unit_price, linesInvoice?.currency_code || tenantCurrency)} - Taxe {line.tax_rate}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openLineEdit(line)} className="rounded border px-2 py-1 text-xs">
                          Modifier
                        </button>
                        <button type="button" onClick={() => setLineDeleteTarget(line)} className="rounded border px-2 py-1 text-xs text-destructive">
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setLinesDialogOpen(false)} className="rounded border px-3 py-1 text-sm">Fermer</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
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

      <AlertDialog open={Boolean(lineDeleteTarget)} onOpenChange={(open) => !open && setLineDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
            <AlertDialogDescription>Le total de la facture sera recalculé.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void onDeleteLine()}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const INVOICE_STATUS_LABELS: Record<FinanceInvoice['status'], string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  partial: 'Partielle',
  paid: 'Payée',
  cancelled: 'Annulée',
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
