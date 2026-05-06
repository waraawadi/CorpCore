'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useEffect, useMemo, useState } from 'react'
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

const sidebarVariants = {
  open: { x: 0, opacity: 1 },
  closed: { x: -280, opacity: 0 },
}

/** Lien actif : exact pour les pages racines, préfixe pour les sous-routes. */
function isSidebarNavActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  const base = href.replace(/\/$/, '') || '/'
  if (base === '/dashboard' || base === '/dashboard/inventory' || base === '/dashboard/crm' || base === '/dashboard/finance') {
    return path === base
  }
  return path === base || path.startsWith(`${base}/`)
}

export function Sidebar() {
  const pathname = usePathname()
  const { tenant, uiState, toggleSidebar } = useStore()
  const [expandedMenu, setExpandedMenu] = useState<string | null>('project-module')

  const moduleItems = useMemo(
    () =>
      [
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
    []
  )

  useEffect(() => {
    const activeModule = moduleItems.find((module) =>
      module.items.some((item) => isSidebarNavActive(item.href, pathname))
    )
    if (activeModule) {
      setExpandedMenu(activeModule.id)
    }
  }, [pathname, moduleItems])

  return (
    <>
      {/* Mobile overlay */}
      {uiState.sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        variants={sidebarVariants}
        initial={false}
        animate={uiState.sidebarOpen ? 'open' : 'closed'}
        transition={{ duration: 0.3 }}
        className="fixed left-0 top-0 z-40 h-full w-72 bg-sidebar border-r border-sidebar-border flex flex-col overflow-y-auto md:relative md:translate-x-0"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-sidebar-border p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-sidebar-border/60 bg-sidebar-accent/30 text-2xl font-bold text-sidebar-primary">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt={tenant.name} className="h-full w-full object-cover" />
                ) : (
                  tenant.logo || '🏢'
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">{tenant.name}</h1>
                <p className="max-w-[170px] truncate text-xs text-sidebar-foreground/60">
                  {tenant.slogan || tenant.plan}
                </p>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="md:hidden text-sidebar-foreground hover:text-sidebar-primary transition-colors"
              aria-label="Toggle sidebar"
            >
              <AnimatedChevronLeftIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-3">
          {moduleItems.map((module) => {
            const ModuleIcon = module.icon
            const isExpanded = expandedMenu === module.id
            return (
              <div key={module.id} className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/10">
                <button
                  type="button"
                  onClick={() => setExpandedMenu((prev) => (prev === module.id ? null : module.id))}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent/40"
                >
                  <span className="flex items-center gap-2">
                    <ModuleIcon className="h-4 w-4" />
                    {module.label}
                  </span>
                  <AnimatedChevronDownIcon
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
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

      </motion.aside>

      {/* Mobile Toggle Button */}
      {!uiState.sidebarOpen && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={toggleSidebar}
          className="fixed bottom-6 left-6 z-30 md:hidden p-2 rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
        >
          <AnimatedChevronRightIcon className="w-6 h-6" />
        </motion.button>
      )}
    </>
  )
}
