'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { notify } from '@/lib/notify'
import { SupportSubnav } from './_components/support-subnav'
import { SUPPORT_STATUS_LABEL } from './_components/support-status'
import { supportApiRequest, type SupportDashboardStats } from './_lib/support-api'

export default function SupportDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SupportDashboardStats | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await supportApiRequest<SupportDashboardStats>('/support/dashboard/')
      setStats(data)
    } catch (error) {
      notify.error('Chargement support impossible', error instanceof Error ? error.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const statusRows = useMemo(() => {
    if (!stats?.by_status) return []
    return Object.entries(stats.by_status).sort((a, b) => a[0].localeCompare(b[0]))
  }, [stats])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:gap-4 md:p-6">
      <SupportSubnav />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-card/60">
          <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Support interne</CardTitle>
              <CardDescription>
                Centralisez les demandes d aide, incidents et questions pour votre equipe sur ce tenant.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                {loading ? 'Chargement...' : 'Actualiser'}
              </Button>
              <Button asChild>
                <Link href="/dashboard/support/tickets">Voir les tickets</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Tickets total</p>
                <p className="text-2xl font-semibold">{loading ? '—' : (stats?.tickets_total ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Ouverts / en cours / attente</p>
                <p className="text-2xl font-semibold">{loading ? '—' : (stats?.tickets_open_like ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Mes tickets</p>
                <p className="text-2xl font-semibold">{loading ? '—' : (stats?.tickets_mine ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Demandeur ou assigne a moi</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Raccourci</p>
                <Button asChild variant="secondary" className="mt-2 w-full">
                  <Link href="/dashboard/support/tickets">Nouveau ticket</Link>
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repartition par statut</CardTitle>
            <CardDescription>Nombre de tickets par etat actuel.</CardDescription>
          </CardHeader>
          <CardContent>
            {statusRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{loading ? 'Chargement...' : 'Aucun ticket pour le moment.'}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {statusRows.map(([key, count]) => (
                  <li key={key} className="rounded-md border px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">
                      {(SUPPORT_STATUS_LABEL as Record<string, string>)[key] || key}
                    </span>{' '}
                    <span className="font-semibold tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
