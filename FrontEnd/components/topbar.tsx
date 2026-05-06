'use client'

import { useStore } from '@/lib/store'
import { Search, Bell, Menu, Moon, Sun, ChevronDown, LayoutGrid, Users, LogOut, Building2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AuthDialog } from '@/components/auth-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'

export function Topbar() {
  const {
    toggleSidebar,
    authUser,
    isAuthenticated,
    logout,
    notifications,
    unreadNotificationsCount,
    hydrateNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prefersDark = document.documentElement.classList.contains('dark')
    setIsDark(prefersDark)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    void hydrateNotifications()
    const interval = setInterval(() => {
      void hydrateNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, hydrateNotifications])

  const toggleDarkMode = () => {
    if (!mounted) return
    const html = document.documentElement
    html.classList.toggle('dark')
    setIsDark(html.classList.contains('dark'))
  }

  const userInitials = authUser
    ? `${authUser.first_name?.[0] || ''}${authUser.last_name?.[0] || authUser.username?.[0] || ''}`.toUpperCase()
    : 'AJ'
  const userDisplayName = authUser
    ? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim() || authUser.username
    : 'Profil'

  if (!mounted) return null

  const formatRelative = (value: string) => {
    const date = new Date(value)
    const diffMs = Date.now() - date.getTime()
    const diffMin = Math.max(Math.floor(diffMs / 60000), 0)
    if (diffMin < 1) return "A l'instant"
    if (diffMin < 60) return `Il y a ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `Il y a ${diffH} h`
    const diffD = Math.floor(diffH / 24)
    return `Il y a ${diffD} j`
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left: Menu + Search */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>

          <div className="hidden md:flex relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects, tasks..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleDarkMode}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </motion.button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="relative p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                ) : null}
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px]">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void markAllNotificationsRead()}
                  disabled={unreadNotificationsCount === 0}
                >
                  Tout marquer lu
                </Button>
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">Aucune notification.</div>
              ) : (
                notifications.slice(0, 8).map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    className="cursor-pointer items-start py-2"
                    onClick={() => {
                      void markNotificationRead(item.id)
                      if (item.linkUrl) router.push(item.linkUrl)
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        {!item.isRead ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(item.createdAt)}</p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white">
                    {authUser?.profile_photo ? (
                      <img
                        src={authUser.profile_photo}
                        alt={userDisplayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{userInitials || 'U'}</span>
                    )}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="max-w-[170px] truncate text-sm font-medium text-foreground">{userDisplayName}</p>
                    <p className="max-w-[170px] truncate text-xs text-muted-foreground">{authUser?.email}</p>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[240px]">
                <DropdownMenuLabel>
                  <p className="truncate text-sm">{userDisplayName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{authUser?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/dashboard')} className="cursor-pointer gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Tableau de bord
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/hr')} className="cursor-pointer gap-2">
                  <Users className="h-4 w-4" />
                  Mon espace RH
                </DropdownMenuItem>
                {authUser?.is_company_admin ? (
                  <DropdownMenuItem onClick={() => router.push('/dashboard/company')} className="cursor-pointer gap-2">
                    <Building2 className="h-4 w-4" />
                    Entreprise
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Deconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <AuthDialog />
          )}
        </div>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden border-t border-border px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
    </header>
  )
}
