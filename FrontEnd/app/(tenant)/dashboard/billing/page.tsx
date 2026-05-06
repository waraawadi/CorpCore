'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeCurrencyCode, formatCurrencyAmount } from '@/lib/currency'

const dateTime = (value?: string | null) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('fr-FR')
  } catch {
    return value
  }
}
const dateOnly = (value?: string | null) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleDateString('fr-FR')
  } catch {
    return value
  }
}

function BillingContent() {
  const searchParams = useSearchParams()
  const {
    tenant,
    billingModules,
    tenantSubscriptions,
    billingLoading,
    apiError,
    hydrateBillingFromApi,
    initiateModulesPayment,
    syncModulesPayment,
  } = useStore()
  const currencyCode = normalizeCurrencyCode(tenant.currencyCode)
  const money = (value: number) => formatCurrencyAmount(value, currencyCode, 'fr-FR', 0)
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [lastTransactionId, setLastTransactionId] = useState<string>('')
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentStep, setPaymentStep] = useState<1 | 2 | 3>(1)
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string>('')
  const [moduleMonths, setModuleMonths] = useState<Record<string, number>>({})
  const [activeModulesDialogOpen, setActiveModulesDialogOpen] = useState(false)

  useEffect(() => {
    hydrateBillingFromApi().catch(() => undefined)
  }, [hydrateBillingFromApi])

  useEffect(() => {
    const tx = searchParams.get('tx')
    if (tx) {
      setLastTransactionId(tx)
    }
  }, [searchParams])

  useEffect(() => {
    setModuleMonths((current) => {
      const next = { ...current }
      billingModules.forEach((module) => {
        if (!next[module.id] || next[module.id] < 1) {
          next[module.id] = 1
        }
      })
      return next
    })
  }, [billingModules])

  const activeSubscriptionByModule = useMemo(() => {
    const map = new Map<string, { status: string; startedAt: string | null; renewalAt: string | null }>()
    tenantSubscriptions.forEach((subscription) => {
      map.set(subscription.module.id, {
        status: subscription.status,
        startedAt: subscription.started_at,
        renewalAt: subscription.renewal_at,
      })
    })
    return map
  }, [tenantSubscriptions])

  const activeSubscriptions = useMemo(
    () =>
      tenantSubscriptions.filter(
        (subscription) => subscription.status === 'active' || subscription.status === 'grace'
      ),
    [tenantSubscriptions]
  )
  const pendingSubscriptions = useMemo(
    () => tenantSubscriptions.filter((subscription) => subscription.status === 'pending'),
    [tenantSubscriptions]
  )
  const nearestRenewalAt = useMemo(() => {
    const renewals = activeSubscriptions
      .map((subscription) => subscription.renewal_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .sort((a, b) => a.getTime() - b.getTime())
    return renewals.length ? renewals[0].toISOString() : null
  }, [activeSubscriptions])
  const maxRenewalAt = useMemo(() => {
    const renewals = activeSubscriptions
      .map((subscription) => subscription.renewal_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .sort((a, b) => b.getTime() - a.getTime())
    return renewals.length ? renewals[0].toISOString() : null
  }, [activeSubscriptions])
  const effectivePaidUntil = useMemo(() => {
    if (!tenant.paidUntil && !maxRenewalAt) return null
    if (tenant.paidUntil && !maxRenewalAt) return tenant.paidUntil
    if (!tenant.paidUntil && maxRenewalAt) return maxRenewalAt
    const tenantDate = new Date(String(tenant.paidUntil))
    const maxRenewalDate = new Date(String(maxRenewalAt))
    return tenantDate > maxRenewalDate ? tenantDate.toISOString() : maxRenewalDate.toISOString()
  }, [tenant.paidUntil, maxRenewalAt])
  const enterpriseStatus = useMemo(() => {
    if (tenant.onTrial) return { label: 'Essai gratuit', variant: 'outline' as const }
    if (activeSubscriptions.length > 0) return { label: 'Abonnement actif', variant: 'default' as const }
    if (pendingSubscriptions.length > 0) return { label: 'Paiement en attente', variant: 'secondary' as const }
    return { label: 'Aucun abonnement actif', variant: 'destructive' as const }
  }, [tenant.onTrial, activeSubscriptions.length, pendingSubscriptions.length])

  const proformaLines = useMemo(() => {
    return billingModules
      .filter((module) => selectedModuleIds.includes(module.id))
      .map((module) => {
        const months = Math.max(1, Number(moduleMonths[module.id] ?? 1))
        const monthly = Number(module.monthly_price_xof || 0)
        return {
          moduleId: module.id,
          moduleName: module.name,
          months,
          monthly,
          subtotal: monthly * months,
        }
      })
  }, [billingModules, selectedModuleIds, moduleMonths])

  const totalSelected = useMemo(() => {
    return proformaLines.reduce((sum, line) => sum + line.subtotal, 0)
  }, [proformaLines])

  const toggleModule = (moduleId: string) => {
    setSelectedModuleIds((current) => {
      if (current.includes(moduleId)) {
        return current.filter((id) => id !== moduleId)
      }
      return [...current, moduleId]
    })
    setModuleMonths((current) => ({ ...current, [moduleId]: Math.max(1, Number(current[moduleId] ?? 1)) }))
  }

  const updateModuleMonths = (moduleId: string, rawValue: string) => {
    const parsed = Number(rawValue)
    setModuleMonths((current) => ({
      ...current,
      [moduleId]: Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1,
    }))
  }

  const handlePaySelected = async () => {
    setPaymentSuccessMessage('')
    setPaymentLoading(true)
    const selectedModuleMonths: Record<string, number> = {}
    selectedModuleIds.forEach((moduleId) => {
      selectedModuleMonths[moduleId] = Math.max(1, Number(moduleMonths[moduleId] ?? 1))
    })
    const { paymentUrl, transactionId } = await initiateModulesPayment(selectedModuleIds, selectedModuleMonths)
    setPaymentLoading(false)
    if (transactionId) {
      setLastTransactionId(transactionId)
    }
    setPaymentUrl(paymentUrl)
    setPaymentStep(2)
  }

  const handleSync = async () => {
    if (!lastTransactionId.trim()) return
    setPaymentSuccessMessage('')
    setSyncLoading(true)
    const ok = await syncModulesPayment(lastTransactionId.trim())
    setSyncLoading(false)
    if (ok) {
      setPaymentSuccessMessage("Paiement verifie. Les modules selectionnes ont ete actives avec leur duree.")
      setSelectedModuleIds([])
      setPaymentDialogOpen(false)
      setPaymentStep(1)
      setPaymentUrl(null)
      setActiveModulesDialogOpen(true)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing & Modules</h1>
          <p className="text-muted-foreground mt-1">
            Gere ton essai gratuit puis active uniquement les modules necessaires.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setActiveModulesDialogOpen(true)}>
            Voir modules actifs
          </Button>
          <Button variant="outline" onClick={() => hydrateBillingFromApi()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statut entreprise</CardTitle>
          <CardDescription>
            Vue globale des abonnements et des dates importantes de ton entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Entreprise: <span className="font-semibold text-foreground">{tenant.name}</span>
            </p>
            <Badge variant={enterpriseStatus.variant}>{enterpriseStatus.label}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Modules actifs</p>
              <p className="mt-1 text-xl font-semibold">{activeSubscriptions.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Paiements en attente</p>
              <p className="mt-1 text-xl font-semibold">{pendingSubscriptions.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Prochaine expiration</p>
              <p className="mt-1 font-semibold">{dateTime(nearestRenewalAt)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Acces global jusqu&apos;au</p>
              <p className="mt-1 font-semibold">{dateOnly(effectivePaidUntil)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {apiError && (
        <div className="text-sm text-destructive border border-destructive/30 rounded-lg p-3">
          {apiError}
        </div>
      )}

      <Dialog open={activeModulesDialogOpen} onOpenChange={setActiveModulesDialogOpen}>
        <DialogContent className="w-[84vw] max-w-[84vw] sm:w-[80vw] sm:max-w-[80vw] max-h-[96vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modules actifs</DialogTitle>
            <DialogDescription>
              Visualise les modules en cours avec la date d&apos;achat et la date d&apos;expiration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!activeSubscriptions.length ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Aucun module actif pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-muted/20">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b bg-background/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-1 font-semibold">Module</th>
                      <th className="px-4 py-1 font-semibold">Statut</th>
                      <th className="px-4 py-1 font-semibold">Date d'achat</th>
                      <th className="px-4 py-1 font-semibold">Date d'expiration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubscriptions.map((subscription) => (
                      <tr key={subscription.id} className="border-b last:border-b-0">
                        <td className="px-4 py-1 align-middle">
                          <p className="font-medium">{subscription.module.name}</p>
                        </td>
                        <td className="px-4 py-1 align-middle">
                          <Badge>{subscription.status}</Badge>
                        </td>
                        <td className="px-4 py-1 align-middle text-sm text-muted-foreground">
                          {dateTime(subscription.started_at)}
                        </td>
                        <td className="px-4 py-1 align-middle text-sm text-muted-foreground">
                          {dateTime(subscription.renewal_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModulesDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {billingModules.map((module) => {
          const subscriptionInfo = activeSubscriptionByModule.get(module.id)
          const status = subscriptionInfo?.status
          const checked = selectedModuleIds.includes(module.id)
          return (
            <Card key={module.id} className={checked ? 'ring-2 ring-primary border-primary/40' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{module.name}</CardTitle>
                  {status && (
                    <Badge variant={status === 'active' ? 'default' : 'outline'}>
                      {status}
                    </Badge>
                  )}
                </div>
                <CardDescription>{module.description || 'Module ERP CorpCore'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xl font-semibold">
                  {money(module.monthly_price_xof)} / mois
                </p>
                <Button
                  variant={checked ? 'default' : 'outline'}
                  onClick={() => toggleModule(module.id)}
                  className="w-full"
                >
                  {checked ? 'Selectionne' : 'Selectionner'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paiement modules selectionnes</CardTitle>
          <CardDescription>
            Tu choisis la duree par module, tu verifies la proforma, puis tu paies dans le dialogue securise.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <strong>Modules:</strong> {selectedModuleIds.length}
          </p>
          <p className="text-sm">
            <strong>Total proforma:</strong> {money(totalSelected)}
          </p>

          {paymentSuccessMessage && (
            <div className="text-sm text-green-700 border border-green-300 bg-green-50 rounded-lg p-3">
              {paymentSuccessMessage}
            </div>
          )}

          <Dialog
            open={paymentDialogOpen}
            onOpenChange={(open) => {
              setPaymentDialogOpen(open)
              if (open) {
                setPaymentStep(1)
                setPaymentUrl(null)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={!selectedModuleIds.length || billingLoading}>
                Payer et activer (dialogue)
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[84vw] max-w-[84vw] sm:w-[80vw] sm:max-w-[80vw] max-h-[96vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Paiement des modules</DialogTitle>
                <DialogDescription>
                  1) Initialise la transaction, 2) paye sur FedaPay, 3) verifie la transaction pour activer les modules.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p><strong>Nombre de modules:</strong> {selectedModuleIds.length}</p>
                  <p><strong>Total a payer:</strong> {money(totalSelected)}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-xs">
                  {[
                    { step: 1 as const, label: 'Proforma' },
                    { step: 2 as const, label: 'Paiement' },
                    { step: 3 as const, label: 'Verification' },
                  ].map((item) => (
                    <button
                      key={item.step}
                      type="button"
                      className={`rounded-md px-2 py-1.5 font-medium transition ${
                        paymentStep === item.step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                      onClick={() => {
                        if (item.step === 1) setPaymentStep(1)
                        if (item.step === 2 && paymentUrl) setPaymentStep(2)
                        if (item.step === 3 && lastTransactionId.trim()) setPaymentStep(3)
                      }}
                    >
                      {item.step}. {item.label}
                    </button>
                  ))}
                </div>

                {paymentStep === 1 && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-sm font-medium">Etape 1 - Proforma</p>
                    {!proformaLines.length ? (
                      <p className="text-sm text-muted-foreground">Selectionne au moins un module.</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="overflow-x-auto rounded-xl border bg-muted/20">
                          <table className="w-full min-w-[760px]">
                            <thead>
                              <tr className="border-b bg-background/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="px-4 py-1 font-semibold">Module</th>
                                <th className="px-4 py-1 font-semibold">Prix mensuel</th>
                                <th className="px-4 py-1 font-semibold">Nombre de mois</th>
                                <th className="px-4 py-1 text-right font-semibold">Sous-total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {proformaLines.map((line) => (
                                <tr key={line.moduleId} className="border-b last:border-b-0">
                                  <td className="px-4 py-1 align-middle">
                                    <p className="font-medium">{line.moduleName}</p>
                                  </td>
                                  <td className="px-4 py-1 align-middle">
                                    <p>{money(line.monthly)}</p>
                                  </td>
                                  <td className="px-4 py-1 align-middle">
                                    <div className="w-[4.5rem]">
                                      <Label htmlFor={`proforma-months-${line.moduleId}`} className="sr-only">
                                        Nombre de mois
                                      </Label>
                                      <Input
                                        id={`proforma-months-${line.moduleId}`}
                                        type="number"
                                        min={1}
                                        value={String(line.months)}
                                        className="h-7 text-center font-semibold px-2"
                                        onChange={(e) => updateModuleMonths(line.moduleId, e.target.value)}
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-1 text-right align-middle font-semibold">
                                    {money(line.subtotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between border-t pt-2">
                          <p className="font-medium">Total proforma</p>
                          <p className="text-base font-bold">{money(totalSelected)}</p>
                        </div>
                        <Button
                          className="w-full"
                          onClick={handlePaySelected}
                          disabled={!selectedModuleIds.length || paymentLoading || billingLoading}
                        >
                          {paymentLoading ? 'Initialisation...' : 'Confirmer proforma et passer au paiement'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {paymentStep === 2 && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">Etape 2 - Paiement FedaPay</p>
                    {paymentUrl ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Formulaire de paiement integre au dialogue.
                        </p>
                        <div className="h-[420px] w-full overflow-hidden rounded-lg border bg-background">
                          <iframe
                            src={paymentUrl}
                            title="Paiement FedaPay"
                            className="h-full w-full border-0"
                            allow="payment *"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Si le formulaire integre ne s&apos;affiche pas, utilise ce lien direct :
                        </p>
                        <a
                          href={paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline"
                        >
                          Ouvrir FedaPay dans un nouvel onglet
                        </a>
                        <Button className="w-full" onClick={() => setPaymentStep(3)}>
                          J&apos;ai termine le paiement
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Initialise d&apos;abord le paiement depuis l&apos;etape Proforma.
                      </p>
                    )}
                  </div>
                )}

                {paymentStep === 3 && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">Etape 3 - Verification et activation</p>
                    <p className="text-xs text-muted-foreground">
                      Clique sur verifier pour confirmer la transaction et activer les modules.
                    </p>
                    <Button onClick={handleSync} disabled={!lastTransactionId.trim() || syncLoading} className="w-full">
                      {syncLoading ? 'Verification...' : 'Verifier et activer les modules'}
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Fermer
                </Button>
                {paymentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setPaymentStep((prev) => (prev === 3 ? 2 : 1))}
                  >
                    Etape precedente
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  )
}
