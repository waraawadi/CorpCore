'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard/support', label: 'Tableau de bord' },
  { href: '/dashboard/support/tickets', label: 'Tickets' },
]

export function SupportSubnav() {
  const pathname = usePathname()

  return (
    <div className="w-full shrink-0 overflow-x-auto pb-1">
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
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
