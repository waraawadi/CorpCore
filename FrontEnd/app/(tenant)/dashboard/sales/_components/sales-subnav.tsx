'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { salesApiRequest, type SalesOrder } from '../_lib/sales-api'

const items = [
  { href: '/dashboard/sales', label: 'Tableau de bord' },
  { href: '/dashboard/sales/customers', label: 'Clients' },
  { href: '/dashboard/sales/products', label: 'Produits' },
  { href: '/dashboard/sales/orders', label: 'Commandes' },
  { href: '/dashboard/sales/invoices', label: 'Facturation' },
  { href: '/dashboard/sales/stock', label: 'Stock' },
]

export function SalesSubnav() {
  const pathname = usePathname()
  const [orders, setOrders] = useState<SalesOrder[]>([])

  useEffect(() => {
    const run = async () => {
      try {
        const data = await salesApiRequest<SalesOrder[]>('/sales/orders/')
        setOrders(data)
      } catch {
        // Keep nav resilient if endpoint fails.
      }
    }
    run().catch(() => undefined)
  }, [])

  const toInvoiceCount = useMemo(
    () => orders.filter((item) => item.status === 'confirmed' && !item.invoice).length,
    [orders]
  )

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              {item.href === '/dashboard/sales/invoices' && toInvoiceCount > 0 ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {toInvoiceCount}
                </span>
              ) : null}
            </span>
          </Link>
        )
      })}
      </div>
    </div>
  )
}
