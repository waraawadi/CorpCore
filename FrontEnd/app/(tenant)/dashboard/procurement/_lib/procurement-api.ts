'use client'

import { formatApiErrorBody, getApiBaseUrl } from '@/lib/api'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export type ProcurementSupplier = {
  id: string
  name: string
  company: string
  email: string
  phone: string
  city: string
  country: string
  address: string
  tax_id: string
  notes: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type ProcurementRequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'fulfilled'

export type ProcurementRequestLine = {
  id: string
  request: string
  description: string
  quantity: string
  unit_price: string
  line_total: string
  created_at?: string
  updated_at?: string
}

export type ProcurementPurchaseRequest = {
  id: string
  reference: string
  title: string
  status: ProcurementRequestStatus
  notes: string
  requested_by: string | null
  requested_by_label: string
  eligible_for_purchase_order?: boolean
  linked_purchase_order_id?: string | null
  lines: ProcurementRequestLine[]
  created_at?: string
  updated_at?: string
}

export type ProcurementOrderStatus =
  | 'draft'
  | 'sent'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export type ProcurementOrderLine = {
  id: string
  order: string
  description: string
  quantity: string
  unit_price: string
  line_total: string
  created_at?: string
  updated_at?: string
}

export type ProcurementPurchaseOrder = {
  id: string
  reference: string
  supplier: string
  supplier_name: string
  status: ProcurementOrderStatus
  notes: string
  expected_delivery: string | null
  total_amount: string
  source_request: string | null
  source_request_reference: string
  lines: ProcurementOrderLine[]
  created_at?: string
  updated_at?: string
}

export async function procurementApiRequest<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
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
