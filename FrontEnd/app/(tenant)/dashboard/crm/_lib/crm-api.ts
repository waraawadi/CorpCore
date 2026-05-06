import { formatApiErrorBody, getApiBaseUrl } from '@/lib/api'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export type CrmDashboardStats = {
  contacts_count: number
  leads_count: number
  leads_by_status: Record<string, number>
  opportunities_count: number
  opportunities_by_stage: Record<string, number>
  pipeline_amount: string
  weighted_pipeline_amount: string
}

export type CrmContact = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  company_name: string
  notes: string
  owner: number
  created_at: string
  updated_at: string
}

export type CrmLead = {
  id: string
  title: string
  status: string
  source: string
  contact: string | null
  owner: number
  estimated_value: string
  next_follow_up_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type CrmOpportunity = {
  id: string
  name: string
  stage: string
  amount: string
  probability: number
  lead: string | null
  contact: string | null
  owner: number
  expected_close_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type CrmActivity = {
  id: string
  activity_type: string
  subject: string
  body: string
  contact: string | null
  lead: string | null
  opportunity: string | null
  created_by: number
  created_at: string
  updated_at: string
}

export async function crmApiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
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

export function fetchCrmDashboard() {
  return crmApiRequest<CrmDashboardStats>('/crm/dashboard/')
}

export function fetchCrmContacts() {
  return crmApiRequest<CrmContact[]>('/crm/contacts/')
}

export function fetchCrmContact(id: string) {
  return crmApiRequest<CrmContact>(`/crm/contacts/${id}/`)
}

export function updateCrmContact(id: string, payload: Partial<Omit<CrmContact, 'id' | 'owner' | 'created_at' | 'updated_at'>>) {
  return crmApiRequest<CrmContact>(`/crm/contacts/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteCrmContact(id: string) {
  return crmApiRequest<void>(`/crm/contacts/${id}/`, { method: 'DELETE' })
}

export function createCrmContact(payload: {
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  company_name?: string
  notes?: string
}) {
  return crmApiRequest<CrmContact>('/crm/contacts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchCrmLeads() {
  return crmApiRequest<CrmLead[]>('/crm/leads/')
}

export function fetchCrmLead(id: string) {
  return crmApiRequest<CrmLead>(`/crm/leads/${id}/`)
}

export function updateCrmLead(id: string, payload: Partial<Omit<CrmLead, 'id' | 'owner' | 'created_at' | 'updated_at'>>) {
  return crmApiRequest<CrmLead>(`/crm/leads/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteCrmLead(id: string) {
  return crmApiRequest<void>(`/crm/leads/${id}/`, { method: 'DELETE' })
}

export function createCrmLead(payload: {
  title: string
  status?: string
  source?: string
  contact?: string | null
  estimated_value?: string
  next_follow_up_at?: string | null
  notes?: string
}) {
  return crmApiRequest<CrmLead>('/crm/leads/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function convertCrmLead(
  id: string,
  payload: { opportunity_name: string; amount?: string; stage?: string; expected_close_date?: string | null }
) {
  return crmApiRequest<CrmOpportunity>(`/crm/leads/${id}/convert/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchCrmOpportunities() {
  return crmApiRequest<CrmOpportunity[]>('/crm/opportunities/')
}

export function fetchCrmOpportunity(id: string) {
  return crmApiRequest<CrmOpportunity>(`/crm/opportunities/${id}/`)
}

export function updateCrmOpportunity(
  id: string,
  payload: Partial<Omit<CrmOpportunity, 'id' | 'owner' | 'created_at' | 'updated_at'>>
) {
  return crmApiRequest<CrmOpportunity>(`/crm/opportunities/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteCrmOpportunity(id: string) {
  return crmApiRequest<void>(`/crm/opportunities/${id}/`, { method: 'DELETE' })
}

export function createCrmOpportunity(payload: {
  name: string
  stage?: string
  amount?: string
  probability?: number
  lead?: string | null
  contact?: string | null
  expected_close_date?: string | null
  notes?: string
}) {
  return crmApiRequest<CrmOpportunity>('/crm/opportunities/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchCrmActivities() {
  return crmApiRequest<CrmActivity[]>('/crm/activities/')
}
