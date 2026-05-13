export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  partial: 'Partiellement payée',
  paid: 'Payée',
  cancelled: 'Annulée',
}

export const STOCK_MOVEMENT_LABELS: Record<string, string> = {
  in: 'Entrée',
  out: 'Sortie',
  adjustment: 'Ajustement',
}

export function getOrderStatusLabel(status?: string | null): string {
  if (!status) return '-'
  return ORDER_STATUS_LABELS[status] || status
}

export function getInvoiceStatusLabel(status?: string | null): string {
  if (!status) return '-'
  return INVOICE_STATUS_LABELS[status] || status
}

export function getStockMovementLabel(movementType?: string | null): string {
  if (!movementType) return '-'
  return STOCK_MOVEMENT_LABELS[movementType] || movementType
}
