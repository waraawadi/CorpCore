'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const RequiredMark = () => <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Obligatoire</span>

export function AuthDialog() {
  const { login, isAuthLoading, authError, clearAuthError } = useStore()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const canSubmit = useMemo(() => email.trim().length > 0 && password.trim().length > 0, [email, password])

  useEffect(() => {
    if (open) {
      clearAuthError()
    }
  }, [open, clearAuthError])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    const ok = await login(email.trim(), password)
    if (ok) {
      setOpen(false)
      setPassword('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Se connecter</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connexion</DialogTitle>
          <DialogDescription>
            Connecte-toi avec ton compte tenant pour activer les appels API réels.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email<RequiredMark /></Label>
            <Input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                clearAuthError()
                setEmail(e.target.value)
              }}
              placeholder="admin@tenant.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Mot de passe<RequiredMark /></Label>
            <Input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => {
                clearAuthError()
                setPassword(e.target.value)
              }}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
            />
          </div>

          {authError && (
            <p className="text-sm text-destructive">{authError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit || isAuthLoading}>
              {isAuthLoading ? 'Connexion...' : 'Valider'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
