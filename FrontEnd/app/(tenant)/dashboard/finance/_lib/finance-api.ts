import { formatApiErrorBody, getApiBaseUrl } from '@/lib/api'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export type FinanceDashboardStats = {
  accounts_count: number
  categories_count: number
  transactions_count: number
  income_amount: string
  expense_amount: string
  transfer_amount: string
  opening_balance_total: string
  net_cashflow: string
}

export type FinanceReportPayload = {
  filters: {
    date_from?: string
    date_to?: string
    category?: string
    document_type?: string
    report_scope?: string
    invoice_status?: string
  }
  summary: {
    income_amount: string
    expense_amount: string
    transfer_amount: string
    net_cashflow: string
  }
  invoice_summary?: {
    count: number
    billed_total: string
    paid_total: string
    outstanding_total: string
  }
  document_summary?: {
    count: number
    total_amount: string
  }
  by_category: Array<{
    category_id: string | null
    category_name: string
    total: string
  }>
  monthly: Array<{
    month: string | null
    transaction_type: 'income' | 'expense' | 'transfer'
    total: string
  }>
}

export type FinanceAccount = {
  id: string
  name: string
  account_type: 'cash' | 'bank' | 'mobile_money'
  currency_code: string
  opening_balance: string
  is_active: boolean
  owner: number
  created_at: string
  updated_at: string
}

export type FinanceCategory = {
  id: string
  name: string
  kind: 'income' | 'expense'
  color: string
  is_active: boolean
  owner: number
  created_at: string
  updated_at: string
}

export type FinanceTransaction = {
  id: string
  title: string
  transaction_type: 'income' | 'expense' | 'transfer'
  amount: string
  booked_on: string
  notes: string
  reference: string
  account: string
  category: string | null
  transfer_account: string | null
  owner: number
  created_at: string
  updated_at: string
}

export type FinanceInvoice = {
  id: string
  number: string
  customer_name: string
  customer_email: string
  customer_phone: string
  currency_code: string
  issued_on: string
  due_on: string | null
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled'
  notes: string
  subtotal_amount: string
  tax_amount: string
  total_amount: string
  paid_amount: string
  owner: number
  created_at: string
  updated_at: string
}

export type FinanceInvoiceLine = {
  id: string
  invoice: string
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
  line_total: string
  category: string | null
  owner: number
  created_at: string
  updated_at: string
}

export type FinanceDocument = {
  id: string
  title: string
  document_type: 'invoice' | 'receipt' | 'purchase' | 'bank_statement' | 'payroll' | 'tax' | 'misc'
  report_scope: 'balance_sheet' | 'income_statement' | 'cashflow' | 'tax' | 'audit' | 'misc'
  document_date: string
  reference: string
  amount: string
  currency_code: string
  description: string
  source_url: string
  account: string | null
  category: string | null
  transaction: string | null
  invoice: string | null
  owner: number
  created_at: string
  updated_at: string
}

async function financeApiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  if (!response.ok) {
    let detail = `Erreur API (${response.status})`
    try {
      const body = await response.json()
      detail = formatApiErrorBody(body) || detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function fetchFinanceDashboard() {
  return financeApiRequest<FinanceDashboardStats>('/finance/dashboard/')
}

export function fetchFinanceAccounts() {
  return financeApiRequest<FinanceAccount[]>('/finance/accounts/')
}

export function createFinanceAccount(payload: {
  name: string
  account_type: FinanceAccount['account_type']
  currency_code: string
  opening_balance?: string
  is_active?: boolean
}) {
  return financeApiRequest<FinanceAccount>('/finance/accounts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceAccount(id: string, payload: Partial<Omit<FinanceAccount, 'id' | 'owner' | 'created_at' | 'updated_at'>>) {
  return financeApiRequest<FinanceAccount>(`/finance/accounts/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFinanceAccount(id: string) {
  return financeApiRequest<void>(`/finance/accounts/${id}/`, { method: 'DELETE' })
}

export function fetchFinanceCategories() {
  return financeApiRequest<FinanceCategory[]>('/finance/categories/')
}

export function createFinanceCategory(payload: {
  name: string
  kind: FinanceCategory['kind']
  color?: string
  is_active?: boolean
}) {
  return financeApiRequest<FinanceCategory>('/finance/categories/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceCategory(id: string, payload: Partial<Omit<FinanceCategory, 'id' | 'owner' | 'created_at' | 'updated_at'>>) {
  return financeApiRequest<FinanceCategory>(`/finance/categories/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFinanceCategory(id: string) {
  return financeApiRequest<void>(`/finance/categories/${id}/`, { method: 'DELETE' })
}

export function fetchFinanceTransactions() {
  return financeApiRequest<FinanceTransaction[]>('/finance/transactions/')
}

export function fetchFinanceReports(params?: {
  date_from?: string
  date_to?: string
  category?: string
  document_type?: string
  report_scope?: string
  invoice_status?: string
}) {
  const q = new URLSearchParams()
  if (params?.date_from) q.set('date_from', params.date_from)
  if (params?.date_to) q.set('date_to', params.date_to)
  if (params?.category) q.set('category', params.category)
  if (params?.document_type) q.set('document_type', params.document_type)
  if (params?.report_scope) q.set('report_scope', params.report_scope)
  if (params?.invoice_status) q.set('invoice_status', params.invoice_status)
  const suffix = q.toString() ? `?${q.toString()}` : ''
  return financeApiRequest<FinanceReportPayload>(`/finance/reports/${suffix}`)
}

export function generateFinanceReportDocument(params?: {
  date_from?: string
  date_to?: string
  category?: string
  document_type?: string
  report_scope?: string
  invoice_status?: string
  sections?: string[]
}) {
  return financeApiRequest<{
    message: string
    document_id: string
    document_title: string
    folder_id: string
    folder_name: string
    sections?: string[]
  }>('/finance/reports/', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  })
}

export function createFinanceTransaction(payload: {
  title: string
  transaction_type: FinanceTransaction['transaction_type']
  amount: string
  booked_on: string
  account: string
  category?: string | null
  transfer_account?: string | null
  reference?: string
  notes?: string
}) {
  return financeApiRequest<FinanceTransaction>('/finance/transactions/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceTransaction(
  id: string,
  payload: Partial<Omit<FinanceTransaction, 'id' | 'owner' | 'created_at' | 'updated_at'>>
) {
  return financeApiRequest<FinanceTransaction>(`/finance/transactions/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFinanceTransaction(id: string) {
  return financeApiRequest<void>(`/finance/transactions/${id}/`, { method: 'DELETE' })
}

export function fetchFinanceInvoices() {
  return financeApiRequest<FinanceInvoice[]>('/finance/invoices/')
}

export function createFinanceInvoice(payload: {
  number: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  currency_code: string
  issued_on: string
  due_on?: string | null
  status?: FinanceInvoice['status']
  notes?: string
  paid_amount?: string
}) {
  return financeApiRequest<FinanceInvoice>('/finance/invoices/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceInvoice(id: string, payload: Partial<Omit<FinanceInvoice, 'id' | 'owner' | 'created_at' | 'updated_at'>>) {
  return financeApiRequest<FinanceInvoice>(`/finance/invoices/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFinanceInvoice(id: string) {
  return financeApiRequest<void>(`/finance/invoices/${id}/`, { method: 'DELETE' })
}

export function fetchFinanceInvoiceLines(invoiceId?: string) {
  const suffix = invoiceId ? `?invoice=${encodeURIComponent(invoiceId)}` : ''
  return financeApiRequest<FinanceInvoiceLine[]>(`/finance/invoice-lines/${suffix}`)
}

export function createFinanceInvoiceLine(payload: {
  invoice: string
  description: string
  quantity: string
  unit_price: string
  tax_rate?: string
  category?: string | null
}) {
  return financeApiRequest<FinanceInvoiceLine>('/finance/invoice-lines/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceInvoiceLine(
  id: string,
  payload: Partial<Omit<FinanceInvoiceLine, 'id' | 'owner' | 'created_at' | 'updated_at'>>
) {
  return financeApiRequest<FinanceInvoiceLine>(`/finance/invoice-lines/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFinanceInvoiceLine(id: string) {
  return financeApiRequest<void>(`/finance/invoice-lines/${id}/`, { method: 'DELETE' })
}

export function fetchFinanceDocuments(params?: { document_type?: string; report_scope?: string; date_from?: string; date_to?: string }) {
  const q = new URLSearchParams()
  if (params?.document_type) q.set('document_type', params.document_type)
  if (params?.report_scope) q.set('report_scope', params.report_scope)
  if (params?.date_from) q.set('date_from', params.date_from)
  if (params?.date_to) q.set('date_to', params.date_to)
  const suffix = q.toString() ? `?${q.toString()}` : ''
  return financeApiRequest<FinanceDocument[]>(`/finance/documents/${suffix}`)
}

export function createFinanceDocument(payload: {
  title: string
  document_type: FinanceDocument['document_type']
  report_scope: FinanceDocument['report_scope']
  document_date: string
  reference?: string
  amount?: string
  currency_code: string
  description?: string
  source_url?: string
  account?: string | null
  category?: string | null
  transaction?: string | null
  invoice?: string | null
}) {
  return financeApiRequest<FinanceDocument>('/finance/documents/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceDocument(id: string, payload: Partial<Omit<FinanceDocument, 'id' | 'owner' | 'created_at' | 'updated_at'>>) {
  return financeApiRequest<FinanceDocument>(`/finance/documents/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFinanceDocument(id: string) {
  return financeApiRequest<void>(`/finance/documents/${id}/`, { method: 'DELETE' })
}

