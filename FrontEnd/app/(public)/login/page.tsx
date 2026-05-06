'use client'

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { MarketingHeader } from '@/components/marketing-header'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const RequiredMark = () => <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Obligatoire</span>

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard'

  const { login, authError, isAuthLoading, clearAuthError } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.trim().length > 0,
    [email, password]
  )

  useEffect(() => {
    clearAuthError()
  }, [clearAuthError])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const ok = await login(email.trim(), password)
    if (ok) {
      router.replace(nextPath)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <MarketingHeader />
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-md">
          <Card className="border-border/60 bg-card/95 shadow-2xl backdrop-blur-sm">
            <CardHeader className="space-y-3">
              <div className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Espace securise
              </div>
              <CardTitle className="text-2xl">Connexion tenant</CardTitle>
              <CardDescription>
                Connecte-toi pour acceder a ton espace ERP avec ton compte entreprise.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email<RequiredMark /></Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      clearAuthError()
                      setEmail(e.target.value)
                    }}
                    autoComplete="email"
                    placeholder="admin@acme.com"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe<RequiredMark /></Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      clearAuthError()
                      setPassword(e.target.value)
                    }}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    className="h-11"
                  />
                </div>

                {authError && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {authError}
                  </p>
                )}

                <Button className="h-11 w-full font-semibold" type="submit" disabled={!canSubmit || isAuthLoading}>
                  {isAuthLoading ? 'Connexion...' : 'Se connecter'}
                </Button>
              </form>
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                Astuce: utilise le domaine de ton entreprise (ex: <span className="font-medium">mgs.corpcore.local</span>).
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Retour a{' '}
                <Link href="/" className="text-primary hover:underline">
                  l'accueil
                </Link>
                {' '}ou{' '}
                <Link href="/signup/company" className="text-primary hover:underline">
                  creer une entreprise
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
