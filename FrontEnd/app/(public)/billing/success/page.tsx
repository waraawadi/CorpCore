'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { MarketingHeader } from '@/components/marketing-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function BillingSuccessContent() {
  const searchParams = useSearchParams()
  const txId = searchParams.get('id') || searchParams.get('transaction_id') || ''
  const status = searchParams.get('status') || ''

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Paiement recu</CardTitle>
              <CardDescription>
                Retour FedaPay recu. Finalise l'activation depuis l'espace billing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Transaction:</strong> {txId || '-'}</p>
              <p><strong>Statut callback:</strong> {status || '-'}</p>
              <p className="text-muted-foreground">
                Clique sur "Verifier et activer" dans l'espace billing pour confirmer cote serveur.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/dashboard/billing${txId ? `?tx=${encodeURIComponent(txId)}` : ''}`}>
                  <Button>Aller au billing</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccessContent />
    </Suspense>
  )
}
