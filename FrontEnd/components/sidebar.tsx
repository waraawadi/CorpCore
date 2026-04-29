'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useEffect, useMemo, useState } from 'react'
import {
  LayoutGrid,
  ListTodo,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  CreditCard,
  Users,
  FolderOpen,
  Boxes,
  Package,
  ArrowRightLeft,
  Tags,
  AlertTriangle,
  UserCheck,
} from 'lucide-react'
import { motion } from 'framer-motion'

const sidebarVariants = {
  open: { x: 0, opacity: 1 },
  closed: { x: -280, opacity: 0 },
}

/** Lien actif : exact pour les pages racines, préfixe pour les sous-routes. */
function isSidebarNavActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  const base = href.replace(/\/$/, '') || '/'
  if (base === '/dashboard' || base === '/dashboard/inventory') {
    return path === base
  }
  return path === base || path.startsWith(`${base}/`)
}

export function Sidebar() {
  const pathname = usePathname()
  const { projects, tenant, uiState, toggleSidebar, logout, isAuthenticated, authUser } = useStore()
  const [expandedMenu, setExpandedMenu] = useState<string | null>('project-module')
  const [quickProjectsOpen, setQuickProjectsOpen] = useState(true)

  const moduleItems = useMemo(
    () =>
      [
    {
      id: 'project-module',
      label: 'Module Projets',
      icon: ListTodo,
      items: [
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutGrid, href: '/dashboard' },
        { id: 'projects', label: 'Projets', icon: ListTodo, href: '/dashboard/projects' },
        { id: 'teams', label: 'Equipes', icon: Users, href: '/dashboard/teams' },
        { id: 'calendar', label: 'Calendrier', icon: Calendar, href: '/dashboard/calendar' },
      ],
    },
    {
      id: 'inventory-module',
      label: 'Module Inventaire',
      icon: Boxes,
      items: [
        { id: 'inventory-overview', label: 'Vue globale', icon: Boxes, href: '/dashboard/inventory' },
        { id: 'inventory-items', label: 'Articles', icon: Package, href: '/dashboard/inventory/items' },
        { id: 'inventory-movements', label: 'Mouvements', icon: ArrowRightLeft, href: '/dashboard/inventory/movements' },
        { id: 'inventory-references', label: 'References', icon: Tags, href: '/dashboard/inventory/references' },
        { id: 'inventory-assets', label: 'Series', icon: Tags, href: '/dashboard/inventory/assets' },
        { id: 'inventory-assignments', label: 'Affectations', icon: UserCheck, href: '/dashboard/inventory/assignments' },
        { id: 'inventory-alerts', label: 'Alertes', icon: AlertTriangle, href: '/dashboard/inventory/alerts' },
      ],
    },
    {
      id: 'hr-module',
      label: 'Module RH',
      icon: Users,
      items: [{ id: 'hr', label: 'Ressources humaines', icon: Users, href: '/dashboard/hr' }],
    },
    {
      id: 'ged-module',
      label: 'Module GED',
      icon: FolderOpen,
      items: [{ id: 'ged', label: 'Documents', icon: FolderOpen, href: '/dashboard/ged' }],
    },
    {
      id: 'admin-module',
      label: 'Administration',
      icon: Settings,
      items: [
        { id: 'billing', label: 'Facturation', icon: CreditCard, href: '/dashboard/billing' },
        { id: 'settings', label: 'Parametres', icon: Settings, href: '/dashboard/settings' },
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
              <div className="text-2xl font-bold text-sidebar-primary">{tenant.logo}</div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">{tenant.name}</h1>
                <p className="text-xs text-sidebar-foreground/60">{tenant.plan}</p>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="md:hidden text-sidebar-foreground hover:text-sidebar-primary transition-colors"
              aria-label="Toggle sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
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
                  <ChevronDown
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

        {/* Projects Quick Access */}
        <div className="flex-shrink-0 border-t border-sidebar-border p-3">
          <button
            onClick={() => setQuickProjectsOpen((prev) => !prev)}
            className="w-full text-left text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider hover:text-sidebar-foreground transition-colors p-2"
          >
            Projets
          </button>
          {quickProjectsOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 mt-2">
              {projects.map((project) => {
                const projectHref = `/dashboard/projects/${project.id}`
                const projectActive = pathname === projectHref || pathname.startsWith(`${projectHref}/`)
                return (
                <Link
                  key={project.id}
                  href={projectHref}
                  aria-current={projectActive ? 'page' : undefined}
                  className={`block px-3 py-2 rounded text-sm transition-colors truncate ${
                    projectActive
                      ? 'bg-sidebar-primary/20 text-sidebar-primary-foreground font-medium ring-1 ring-sidebar-primary/30'
                      : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: project.color || '#185FA5' }} />
                  {project.name}
                </Link>
                )
              })}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-sidebar-border p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
            <Settings className="w-4 h-4" />
            <span>{isAuthenticated ? (authUser?.email || authUser?.username || 'Profil') : 'Profil'}</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-sidebar-foreground/70 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Deconnexion</span>
          </button>
        </div>
      </motion.aside>

      {/* Mobile Toggle Button */}
      {!uiState.sidebarOpen && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={toggleSidebar}
          className="fixed bottom-6 left-6 z-30 md:hidden p-2 rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
        >
          <ChevronRight className="w-6 h-6" />
        </motion.button>
      )}
    </>
  )
}
