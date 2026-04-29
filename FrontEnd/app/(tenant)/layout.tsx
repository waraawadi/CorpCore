'use client'

import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { useStore } from '@/lib/store'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { uiState, bootstrapAuth, isAuthenticated, isAuthLoading, authChecked } = useStore()

  useEffect(() => {
    // Apply dark mode preference
    if (uiState.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [uiState.darkMode])

  useEffect(() => {
    bootstrapAuth().catch(() => undefined)
  }, [bootstrapAuth])

  useEffect(() => {
    if (authChecked && !isAuthLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/dashboard')}`)
    }
  }, [authChecked, isAuthenticated, isAuthLoading, router, pathname])

  if (!authChecked || (!isAuthenticated && isAuthLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Verification de la session...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:ml-0">
        {/* Topbar */}
        <Topbar />

        {/* Page Content — min-h-0 pour que les pages (ex. Kanban) puissent remplir et scroller en interne */}
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container-fluid flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
