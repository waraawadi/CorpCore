'use client'

import { formatApiErrorBody, getApiBaseUrl } from '@/lib/api'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_customer'
  | 'resolved'
  | 'closed'

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type SupportTicketCategory = 'general' | 'access' | 'billing' | 'bug' | 'feature' | 'other'

export type SupportTicketComment = {
  id: string
  ticket: string
  author: number
  author_name: string
  body: string
  created_at: string
  updated_at: string
}

export type SupportTicket = {
  id: string
  reference: string
  title: string
  description: string
  category: SupportTicketCategory
  priority: SupportTicketPriority
  status: SupportTicketStatus
  requester: number
  requester_name: string
  assignee: number | null
  assignee_name: string
  resolved_at: string | null
  comments_count?: number
  comments?: SupportTicketComment[]
  created_at: string
  updated_at: string
}

export type SupportDashboardStats = {
  tickets_total: number
  tickets_open_like: number
  tickets_mine: number
  by_status: Record<string, number>
}

export async function supportApiRequest<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
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
