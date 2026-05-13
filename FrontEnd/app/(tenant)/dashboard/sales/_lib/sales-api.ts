'use client'

import { formatApiErrorBody, getApiBaseUrl } from '@/lib/api'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export type SalesCustomer = {
  id: string
  name: string
  company: string
  email: string
  phone: string
  city: string
  country: string
  tax_id: string
  address: string
  notes: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type SalesProduct = {
  id: string
  name: string
  sku: string
  description: string
  unit_price: string
  stock_quantity: string
  reorder_level: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type SalesStockMovement = {
  id: string
  product: string
  product_name: string
  product_sku: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: string
  note: string
  created_at: string
}

export type SalesStockAlert = {
  product_id: string
  product_name: string
  product_sku: string
  stock_quantity: string
  reorder_level: string
  severity: 'critical' | 'warning'
  message: string
}

export type SalesStockSummary = {
  total_products: number
  out_of_stock: number
  low_stock: number
  healthy_stock: number
}

export type SalesOrderLine = {
  id: string
  order: string
  product: string
  product_name: string
  quantity: string
  unit_price: string
  line_total: string
}

export type SalesOrder = {
  id: string
  reference: string
  customer: string
  customer_name: string
  status: 'draft' | 'confirmed' | 'cancelled'
  ordered_at: string
  notes: string
  total_amount: string
  invoice: string | null
  invoice_number: string
  invoice_status: 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled' | ''
  invoice_document: string | null
  invoice_document_title: string
  lines: SalesOrderLine[]
  created_at?: string
  updated_at?: string
}

export type SalesOrderInvoiceResult = {
  invoice_id: string
  invoice_number: string
  invoice_status?: 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled'
  invoice_document_id?: string
  invoice_document_title?: string
  payment_method?: 'mobile_money' | 'cheque' | 'bank_transfer' | 'cash' | 'other'
  payment_reference?: string
  amount_received?: string
  change_amount?: string
  message: string
}

export async function salesApiRequest<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      const parsed = formatApiErrorBody(body)
      if (parsed) detail = parsed
    } catch {
      // no-op
    }
    throw new Error(detail)
  }

  if (response.status === 204) return null as T
  return (await response.json()) as T
}
