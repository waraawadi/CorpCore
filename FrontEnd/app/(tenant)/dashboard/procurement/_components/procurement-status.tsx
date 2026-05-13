'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProcurementOrderStatus, ProcurementRequestStatus } from '../_lib/procurement-api'

/** Libellés affichés (cohérents avec les filtres existants). */
export const PURCHASE_REQUEST_STATUS_LABEL: Record<ProcurementRequestStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  approved: 'Approuvée',
  rejected: 'Rejetée',
  fulfilled: 'Transformée',
}

export const PURCHASE_ORDER_STATUS_LABEL: Record<ProcurementOrderStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  partially_received: 'Partiellement reçue',
  received: 'Reçue',
  cancelled: 'Annulée',
}

const REQUEST_ACCENT: Record<ProcurementRequestStatus, string> = {
  draft: 'border-l-muted-foreground/70',
  submitted: 'border-l-amber-500',
  approved: 'border-l-emerald-600',
  rejected: 'border-l-destructive',
  fulfilled: 'border-l-violet-600',
}

const REQUEST_BADGE: Record<
  ProcurementRequestStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  draft: { variant: 'outline', className: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground' },
  submitted: { variant: 'outline', className: 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100' },
  approved: { variant: 'outline', className: 'border-emerald-600/50 bg-emerald-600/10 text-emerald-950 dark:text-emerald-100' },
  rejected: { variant: 'destructive' },
  fulfilled: { variant: 'outline', className: 'border-violet-600/50 bg-violet-600/10 text-violet-950 dark:text-violet-100' },
}

const ORDER_ACCENT: Record<ProcurementOrderStatus, string> = {
  draft: 'border-l-muted-foreground/70',
  sent: 'border-l-sky-600',
  partially_received: 'border-l-amber-500',
  received: 'border-l-emerald-600',
  cancelled: 'border-l-destructive',
}

const ORDER_BADGE: Record<
  ProcurementOrderStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  draft: { variant: 'outline', className: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground' },
  sent: { variant: 'outline', className: 'border-sky-600/50 bg-sky-500/10 text-sky-950 dark:text-sky-100' },
  partially_received: { variant: 'outline', className: 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100' },
  received: { variant: 'default', className: 'border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90' },
  cancelled: { variant: 'destructive' },
}

export function purchaseRequestListRowClass(status: ProcurementRequestStatus): string {
  return cn('border-l-4', REQUEST_ACCENT[status])
}

export function purchaseOrderListRowClass(status: ProcurementOrderStatus): string {
  return cn('border-l-4', ORDER_ACCENT[status])
}

export function supplierListRowClass(isActive: boolean): string {
  return cn('border-l-4', isActive ? 'border-l-emerald-600' : 'border-l-muted-foreground/50')
}

/** Bandeau latéral pour blocs « lignes » (dialogue) : reprend la couleur du statut parent. */
export function procurementDetailLinesPanelClass(
  kind: 'request' | 'order',
  status: ProcurementRequestStatus | ProcurementOrderStatus
): string {
  const accent =
    kind === 'request'
      ? REQUEST_ACCENT[status as ProcurementRequestStatus]
      : ORDER_ACCENT[status as ProcurementOrderStatus]
  return cn('rounded-md border bg-card/50 p-2 pl-3', 'border-l-4', accent)
}

export function PurchaseRequestStatusBadge({
  status,
  className,
}: {
  status: ProcurementRequestStatus
  className?: string
}) {
  const cfg = REQUEST_BADGE[status]
  return (
    <Badge variant={cfg.variant} className={cn('shrink-0 font-medium', cfg.className, className)}>
      {PURCHASE_REQUEST_STATUS_LABEL[status]}
    </Badge>
  )
}

export function PurchaseOrderStatusBadge({
  status,
  className,
}: {
  status: ProcurementOrderStatus
  className?: string
}) {
  const cfg = ORDER_BADGE[status]
  return (
    <Badge variant={cfg.variant} className={cn('shrink-0 font-medium', cfg.className, className)}>
      {PURCHASE_ORDER_STATUS_LABEL[status]}
    </Badge>
  )
}

export function SupplierActiveBadge({ isActive, className }: { isActive: boolean; className?: string }) {
  if (isActive) {
    return (
      <Badge variant="outline" className={cn('border-emerald-600/50 bg-emerald-600/10 text-emerald-950 dark:text-emerald-100', className)}>
        Actif
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn('border-muted-foreground/40 bg-muted/50 text-muted-foreground', className)}>
      Inactif
    </Badge>
  )
}

/** Petite pastille sur une ligne article (repère visuel « ligne »). */
export function ProcurementLineDot({ className }: { className?: string }) {
  return (
    <span
      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/50 ring-2 ring-primary/15', className)}
      aria-hidden
    />
  )
}

export function ProcurementStatusLegend() {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
      <p className="mb-3 text-sm font-medium text-foreground">Légende des statuts</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6 sm:gap-y-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Demandes</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PURCHASE_REQUEST_STATUS_LABEL) as ProcurementRequestStatus[]).map((s) => (
              <PurchaseRequestStatusBadge key={s} status={s} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Bons de commande</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PURCHASE_ORDER_STATUS_LABEL) as ProcurementOrderStatus[]).map((s) => (
              <PurchaseOrderStatusBadge key={s} status={s} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Fournisseurs</p>
          <div className="flex flex-wrap gap-1.5">
            <SupplierActiveBadge isActive />
            <SupplierActiveBadge isActive={false} />
          </div>
        </div>
      </div>
    </div>
  )
}
