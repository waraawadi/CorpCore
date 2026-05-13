'use client'

import { Badge } from '@/components/ui/badge'
import type { SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from '../_lib/support-api'

export const SUPPORT_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  waiting_customer: 'Attente demandeur',
  resolved: 'Resolu',
  closed: 'Ferme',
}

export const SUPPORT_PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
}

export const SUPPORT_CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  general: 'General',
  access: 'Acces / comptes',
  billing: 'Facturation',
  bug: 'Bug / incident',
  feature: 'Evolution',
  other: 'Autre',
}

export function SupportStatusBadge({ status }: { status: SupportTicketStatus }) {
  const variant =
    status === 'closed' || status === 'resolved'
      ? 'secondary'
      : status === 'open'
        ? 'default'
        : status === 'waiting_customer'
          ? 'outline'
          : 'default'
  return <Badge variant={variant}>{SUPPORT_STATUS_LABEL[status]}</Badge>
}

export function SupportPriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  const variant = priority === 'urgent' ? 'destructive' : priority === 'high' ? 'default' : 'outline'
  return <Badge variant={variant}>{SUPPORT_PRIORITY_LABEL[priority]}</Badge>
}
