import { formatApiErrorBody, getApiBaseUrl } from '@/lib/api'

const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export type InventoryCategory = {
  id: string
  name: string
  description?: string
  is_active?: boolean
}

export type InventoryLocation = {
  id: string
  name: string
  code?: string
  description?: string
  is_active?: boolean
}

export type InventoryItem = {
  id: string
  name: string
  sku: string
  description?: string
  categoryName?: string
  categoryId?: string | null
  unit: string
  quantityOnHand: string
  reorderLevel: string
  isActive: boolean
}

export type InventoryMovement = {
  id: string
  itemId?: string
  itemName: string
  itemSku: string
  locationId?: string | null
  locationName?: string
  movementType: 'in' | 'out' | 'adjustment'
  quantity: string
  reference?: string
  note?: string
  occurred_at: string
  movedByName?: string
}

export type InventorySummary = {
  itemsCount: number
  activeItemsCount: number
  lowStockCount: number
  totalQuantity: number
}

export type InventoryAssetReference = {
  id: string
  serialNumber: string
  status: 'in_stock' | 'assigned' | 'out'
  itemId: string
  itemName: string
  itemSku: string
  categoryId?: string | null
  categoryName?: string
  locationName?: string
  assignedTo?: number | null
  assignedToName?: string
  assigned_at?: string | null
  note?: string
  sourceMovementInId?: string | null
  sourceMovementOutId?: string | null
}

export async function inventoryApiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
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
      // ignore malformed error body
    }
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function isLowStock(item: InventoryItem): boolean {
  return Number(item.quantityOnHand) <= Number(item.reorderLevel) && item.isActive
}
