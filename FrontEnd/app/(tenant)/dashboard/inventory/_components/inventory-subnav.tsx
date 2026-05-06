'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, ArrowRightLeft, Boxes, ListChecks, Package, Tags, UserCheck } from 'lucide-react'

const links = [
  { href: '/dashboard/inventory', label: 'Vue globale', icon: Boxes },
  { href: '/dashboard/inventory/items', label: 'Articles', icon: Package },
  { href: '/dashboard/inventory/movements', label: 'Mouvements', icon: ArrowRightLeft },
  { href: '/dashboard/inventory/references', label: 'References', icon: Tags },
  { href: '/dashboard/inventory/assets', label: 'Series', icon: Tags },
  { href: '/dashboard/inventory/assignments', label: 'Affectations', icon: UserCheck },
  { href: '/dashboard/inventory/alerts', label: 'Alertes', icon: AlertTriangle },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard/inventory') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function InventorySubnav() {
  const pathname = usePathname()

  return (
    <div className="shrink-0 rounded-lg border border-border/60 bg-card/70 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          Inventaire
        </div>
        {links.map((link) => {
          const Icon = link.icon
          const active = isActive(pathname, link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
