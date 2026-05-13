'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { motion } from 'framer-motion'
import {
  AnimatedActivityIcon,
  AnimatedArrowDownUpIcon,
  AnimatedBoxesIcon,
  AnimatedChevronDownIcon,
  AnimatedChevronLeftIcon,
  AnimatedChevronRightIcon,
  AnimatedCreditCardIcon,
  AnimatedFolderOpenIcon,
  AnimatedLayoutGridIcon,
  AnimatedLayoutListIcon,
  AnimatedSettingsIcon,
  AnimatedUserCheckIcon,
  AnimatedUsersIcon,
  CrmActivitiesNavIcon,
  CrmContactsNavIcon,
  CrmDashboardNavIcon,
  CrmLeadsNavIcon,
  CrmModuleIcon,
  CrmOpportunitiesNavIcon,
  FinanceAccountsNavIcon,
  FinanceCategoriesNavIcon,
  FinanceDashboardNavIcon,
  FinanceModuleIcon,
  FinanceReportsNavIcon,
  FinanceTransactionsNavIcon,
} from '@/components/crm-animate-icons'
import { ChevronsLeft, Headphones, LayoutGrid, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SidebarDesktopMode } from '@/lib/types'

const sidebarVariants = {
  open: { x: 0, opacity: 1 },
  closed: { x: -280, opacity: 0 },
}

/** Lien actif : exact pour les pages racines, préfixe pour les sous-routes. */
function isSidebarNavActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  const hrefPath = href.split('?')[0] || href
  const base = hrefPath.replace(/\/$/, '') || '/'
  if (
    base === '/dashboard' ||
    base === '/dashboard/inventory' ||
    base === '/dashboard/crm' ||
    base === '/dashboard/finance' ||
    base === '/dashboard/sales' ||
    base === '/dashboard/procurement' ||
    base === '/dashboard/support'
  ) {
    return path === base
  }
  return path === base || path.startsWith(`${base}/`)
}

type ModuleItem = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  items: { id: string; label: string; icon: ComponentType<{ className?: string }>; href: string }[]
}

function SidebarDesktopModeBar({
  mode,
  onSetMode,
  vertical,
}: {
  mode: SidebarDesktopMode
  onSetMode: (m: SidebarDesktopMode) => void
  vertical?: boolean
}) {
  const btn = (m: SidebarDesktopMode, icon: ReactNode, label: string) => (
    <button
      key={m}
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onSetMode(m)}
      className={cn(
        'rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50',
        mode === m && 'bg-sidebar-primary/25 text-sidebar-primary ring-1 ring-sidebar-primary/40',
        vertical && 'flex h-9 w-9 shrink-0 items-center justify-center p-0',
      )}
    >
      {icon}
    </button>
  )

  return (
    <div
      className={cn(
        'flex-shrink-0 border-t border-sidebar-border/70 bg-sidebar-accent/10 px-2 py-2',
        vertical ? 'flex flex-col items-center gap-1' : 'flex flex-row items-center justify-center gap-1',
      )}
    >
      {btn('expanded', <PanelLeft className="h-4 w-4" />, 'Menu etendu')}
      {btn('icons', <LayoutGrid className="h-4 w-4" />, 'Icones (survol pour ouvrir)')}
      {btn('hidden', <ChevronsLeft className="h-4 w-4" />, 'Masquer le menu (fixe)')}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { tenant, uiState, toggleSidebar, updateUIState } = useStore()
  const isMobile = useIsMobile()
  const desktopMode: SidebarDesktopMode = uiState.sidebarDesktopMode ?? 'expanded'
  const setDesktopMode = useCallback(
    (m: SidebarDesktopMode) => updateUIState({ sidebarDesktopMode: m }),
    [updateUIState],
  )

  const sidebarVisualOpen = !isMobile || uiState.sidebarOpen
  const [expandedMenu, setExpandedMenu] = useState<string | null>('project-module')
  const [railHover, setRailHover] = useState(false)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }

  const onDesktopIconsEnter = () => {
    clearLeaveTimer()
    setRailHover(true)
  }

  const onDesktopIconsLeave = () => {
    clearLeaveTimer()
    leaveTimerRef.current = setTimeout(() => setRailHover(false), 220)
  }

  useEffect(() => () => clearLeaveTimer(), [])

  const moduleItems: ModuleItem[] = useMemo(
    () => [
      {
        id: 'project-module',
        label: 'Module Projets',
        icon: AnimatedLayoutListIcon,
        items: [
          { id: 'dashboard', label: 'Tableau de bord', icon: AnimatedLayoutGridIcon, href: '/dashboard' },
          { id: 'projects', label: 'Projets', icon: AnimatedLayoutListIcon, href: '/dashboard/projects' },
          { id: 'teams', label: 'Equipes', icon: AnimatedUsersIcon, href: '/dashboard/teams' },
          { id: 'calendar', label: 'Calendrier', icon: AnimatedLayoutGridIcon, href: '/dashboard/calendar' },
        ],
      },
      {
        id: 'inventory-module',
        label: 'Module Inventaire',
        icon: AnimatedBoxesIcon,
        items: [
          { id: 'inventory-overview', label: 'Vue globale', icon: AnimatedBoxesIcon, href: '/dashboard/inventory' },
          { id: 'inventory-items', label: 'Articles', icon: AnimatedLayoutListIcon, href: '/dashboard/inventory/items' },
          { id: 'inventory-movements', label: 'Mouvements', icon: AnimatedArrowDownUpIcon, href: '/dashboard/inventory/movements' },
          { id: 'inventory-references', label: 'References', icon: AnimatedLayoutListIcon, href: '/dashboard/inventory/references' },
          { id: 'inventory-assets', label: 'Series', icon: AnimatedLayoutListIcon, href: '/dashboard/inventory/assets' },
          { id: 'inventory-assignments', label: 'Affectations', icon: AnimatedUserCheckIcon, href: '/dashboard/inventory/assignments' },
          { id: 'inventory-alerts', label: 'Alertes', icon: AnimatedActivityIcon, href: '/dashboard/inventory/alerts' },
        ],
      },
      {
        id: 'hr-module',
        label: 'Module RH',
        icon: AnimatedUsersIcon,
        items: [
          { id: 'hr-employees', label: 'Employes', icon: AnimatedUsersIcon, href: '/dashboard/hr/employees' },
          { id: 'hr-departments', label: 'Departements', icon: AnimatedLayoutListIcon, href: '/dashboard/hr/departments' },
          { id: 'hr-contracts', label: 'Contrats', icon: AnimatedUserCheckIcon, href: '/dashboard/hr/contracts' },
          { id: 'hr-leaves', label: 'Conges', icon: AnimatedActivityIcon, href: '/dashboard/hr/leaves' },
          { id: 'hr-payroll-settings', label: 'Parametres paie', icon: AnimatedSettingsIcon, href: '/dashboard/hr/payroll-settings' },
          { id: 'hr-payrolls', label: 'Paies', icon: AnimatedCreditCardIcon, href: '/dashboard/hr/payrolls' },
        ],
      },
      {
        id: 'ged-module',
        label: 'Module GED',
        icon: AnimatedFolderOpenIcon,
        items: [{ id: 'ged', label: 'Documents', icon: AnimatedFolderOpenIcon, href: '/dashboard/ged' }],
      },
      {
        id: 'crm-module',
        label: 'Module CRM',
        icon: CrmModuleIcon,
        items: [
          { id: 'crm-dashboard', label: 'Tableau CRM', icon: CrmDashboardNavIcon, href: '/dashboard/crm' },
          { id: 'crm-contacts', label: 'Contacts', icon: CrmContactsNavIcon, href: '/dashboard/crm/contacts' },
          { id: 'crm-leads', label: 'Pistes', icon: CrmLeadsNavIcon, href: '/dashboard/crm/leads' },
          {
            id: 'crm-opportunities',
            label: 'Opportunites',
            icon: CrmOpportunitiesNavIcon,
            href: '/dashboard/crm/opportunities',
          },
          { id: 'crm-activities', label: 'Activites', icon: CrmActivitiesNavIcon, href: '/dashboard/crm/activities' },
        ],
      },
      {
        id: 'finance-module',
        label: 'Module Finance',
        icon: FinanceModuleIcon,
        items: [
          { id: 'finance-dashboard', label: 'Tableau Finance', icon: FinanceDashboardNavIcon, href: '/dashboard/finance' },
          { id: 'finance-transactions', label: 'Transactions', icon: FinanceTransactionsNavIcon, href: '/dashboard/finance/transactions' },
          { id: 'finance-accounts', label: 'Comptes', icon: FinanceAccountsNavIcon, href: '/dashboard/finance/accounts' },
          { id: 'finance-categories', label: 'Categories', icon: FinanceCategoriesNavIcon, href: '/dashboard/finance/categories' },
          { id: 'finance-invoices', label: 'Factures', icon: AnimatedCreditCardIcon, href: '/dashboard/finance/invoices' },
          { id: 'finance-documents', label: 'Pieces comptables', icon: AnimatedFolderOpenIcon, href: '/dashboard/finance/documents' },
          { id: 'finance-reports', label: 'Rapports', icon: FinanceReportsNavIcon, href: '/dashboard/finance/reports' },
        ],
      },
      {
        id: 'sales-module',
        label: 'Module Ventes',
        icon: AnimatedCreditCardIcon,
        items: [
          { id: 'sales-dashboard', label: 'Tableau Ventes', icon: AnimatedCreditCardIcon, href: '/dashboard/sales' },
          { id: 'sales-customers', label: 'Clients', icon: AnimatedUsersIcon, href: '/dashboard/sales/customers' },
          { id: 'sales-products', label: 'Produits', icon: AnimatedBoxesIcon, href: '/dashboard/sales/products' },
          { id: 'sales-orders', label: 'Commandes', icon: AnimatedLayoutListIcon, href: '/dashboard/sales/orders' },
          { id: 'sales-invoices', label: 'Facturation', icon: AnimatedCreditCardIcon, href: '/dashboard/sales/invoices' },
          { id: 'sales-stock', label: 'Stock', icon: AnimatedFolderOpenIcon, href: '/dashboard/sales/stock' },
        ],
      },
      {
        id: 'procurement-module',
        label: 'Module Achats',
        icon: AnimatedArrowDownUpIcon,
        items: [
          { id: 'procurement-dashboard', label: 'Tableau Achats', icon: AnimatedLayoutGridIcon, href: '/dashboard/procurement' },
          { id: 'procurement-suppliers', label: 'Fournisseurs', icon: AnimatedUsersIcon, href: '/dashboard/procurement/suppliers' },
          { id: 'procurement-requests', label: 'Demandes', icon: AnimatedLayoutListIcon, href: '/dashboard/procurement/requests' },
          {
            id: 'procurement-orders',
            label: 'Bons de commande',
            icon: AnimatedArrowDownUpIcon,
            href: '/dashboard/procurement/orders',
          },
        ],
      },
      {
        id: 'support-module',
        label: 'Module Support',
        icon: Headphones,
        items: [
          { id: 'support-dashboard', label: 'Tableau support', icon: AnimatedLayoutGridIcon, href: '/dashboard/support' },
          { id: 'support-tickets', label: 'Tickets', icon: AnimatedLayoutListIcon, href: '/dashboard/support/tickets' },
        ],
      },
      {
        id: 'admin-module',
        label: 'Administration',
        icon: AnimatedSettingsIcon,
        items: [
          { id: 'company', label: 'Entreprise', icon: AnimatedSettingsIcon, href: '/dashboard/company' },
          { id: 'billing', label: 'Facturation', icon: AnimatedCreditCardIcon, href: '/dashboard/billing' },
          { id: 'settings', label: 'Parametres', icon: AnimatedSettingsIcon, href: '/dashboard/settings' },
        ],
      },
    ],
    [],
  )

  useEffect(() => {
    const activeModule = moduleItems.find((module) =>
      module.items.some((item) => isSidebarNavActive(item.href, pathname)),
    )
    if (activeModule) {
      setExpandedMenu(activeModule.id)
    }
  }, [pathname, moduleItems])

  const renderNav = (opts?: { onNavigate?: () => void }) => (
    <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-6">
      {moduleItems.map((module) => {
        const ModuleIcon = module.icon
        const isExpanded = expandedMenu === module.id
        const moduleActive = module.items.some((item) => isSidebarNavActive(item.href, pathname))
        return (
          <div key={module.id} className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/10">
            <button
              type="button"
              onClick={() => setExpandedMenu((prev) => (prev === module.id ? null : module.id))}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ModuleIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{module.label}</span>
              </span>
              <AnimatedChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
              <div className="space-y-1 border-t border-sidebar-border/60 p-2">
                {module.items.map((item) => {
                  const Icon = item.icon
                  const active = isSidebarNavActive(item.href, pathname)
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => opts?.onNavigate?.()}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-sidebar-primary/25 text-sidebar-primary-foreground shadow-sm ring-1 ring-sidebar-primary/40'
                          : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-sidebar-primary' : ''}`} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  const renderBrandHeader = (opts: { showMobileClose?: boolean }) => (
    <div className="flex-shrink-0 border-b border-sidebar-border p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-sidebar-border/60 bg-sidebar-accent/30 text-2xl font-bold text-sidebar-primary">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-full w-full object-cover" />
            ) : (
              tenant.logo || '🏢'
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-sidebar-foreground">{tenant.name}</h1>
            <p className="max-w-[170px] truncate text-xs text-sidebar-foreground/60">{tenant.slogan || tenant.plan}</p>
          </div>
        </div>
        {opts.showMobileClose ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="shrink-0 text-sidebar-foreground transition-colors hover:text-sidebar-primary md:hidden"
            aria-label="Fermer le menu"
          >
            <AnimatedChevronLeftIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
      {isMobile && uiState.sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Mobile drawer */}
      {isMobile ? (
        <motion.aside
          variants={sidebarVariants}
          initial={false}
          animate={sidebarVisualOpen ? 'open' : 'closed'}
          transition={{ duration: 0.3 }}
          className="fixed left-0 top-0 z-40 flex h-full w-72 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar md:hidden"
        >
          {renderBrandHeader({ showMobileClose: true })}
          {renderNav({ onNavigate: () => toggleSidebar() })}
        </motion.aside>
      ) : null}

      {/* Desktop : etendu */}
      {!isMobile && desktopMode === 'expanded' ? (
        <aside className="relative z-40 hidden h-full w-72 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar md:flex">
          {renderBrandHeader({ showMobileClose: false })}
          {renderNav()}
          <SidebarDesktopModeBar mode={desktopMode} onSetMode={setDesktopMode} />
        </aside>
      ) : null}

      {/* Desktop : rail seul au repos ; menu etendu seul au survol (pas rail + panneau) */}
      {!isMobile && desktopMode === 'icons' ? (
        <div
          className="relative z-40 hidden h-full shrink-0 md:flex"
          onMouseEnter={onDesktopIconsEnter}
          onMouseLeave={onDesktopIconsLeave}
        >
          {railHover ? (
            <aside className="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar shadow-xl">
              {renderBrandHeader({ showMobileClose: false })}
              {renderNav({ onNavigate: () => setRailHover(false) })}
              <SidebarDesktopModeBar mode={desktopMode} onSetMode={setDesktopMode} />
            </aside>
          ) : (
            <div className="flex w-14 flex-col border-r border-sidebar-border bg-sidebar">
              <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1 py-3">
                {moduleItems.map((module) => {
                  const ModuleIcon = module.icon
                  const active = module.items.some((item) => isSidebarNavActive(item.href, pathname))
                  return (
                    <button
                      key={module.id}
                      type="button"
                      title={module.label}
                      aria-label={module.label}
                      onClick={() => setExpandedMenu(module.id)}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/40',
                        active && 'border-sidebar-primary/50 bg-sidebar-primary/20 text-sidebar-primary',
                      )}
                    >
                      <ModuleIcon className="h-5 w-5" />
                    </button>
                  )
                })}
              </div>
              <SidebarDesktopModeBar mode={desktopMode} onSetMode={setDesktopMode} vertical />
            </div>
          )}
        </div>
      ) : null}

      {isMobile && !uiState.sidebarOpen ? (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          type="button"
          onClick={toggleSidebar}
          className="fixed bottom-6 left-6 z-30 rounded-full bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-lg transition-shadow hover:shadow-xl md:hidden"
          aria-label="Ouvrir le menu"
        >
          <AnimatedChevronRightIcon className="h-6 w-6" />
        </motion.button>
      ) : null}
    </>
  )
}
