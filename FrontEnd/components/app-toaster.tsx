'use client'

import { Toaster } from 'sonner'

/**
 * Toasts globaux : coin supérieur droit, styles distincts par type (succès, erreur, etc.).
 */
export function AppToaster() {
  return (
    <Toaster
      className="!z-[200]"
      position="top-right"
      expand
      closeButton
      duration={4200}
      visibleToasts={5}
      gap={10}
      offset={16}
      theme="system"
      toastOptions={{
        classNames: {
          toast:
            'group pointer-events-auto flex w-full max-w-[min(420px,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-xl border p-4 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-opacity-90',
          title: 'text-sm font-semibold leading-tight tracking-tight',
          description: 'text-xs leading-snug opacity-90',
          success:
            'border-emerald-500/40 bg-emerald-500/[0.11] text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-500/12 dark:text-emerald-50',
          error:
            'border-rose-500/40 bg-rose-500/[0.11] text-rose-950 dark:border-rose-400/35 dark:bg-rose-500/12 dark:text-rose-50',
          warning:
            'border-amber-500/45 bg-amber-500/[0.13] text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/14 dark:text-amber-50',
          info: 'border-sky-500/40 bg-sky-500/[0.11] text-sky-950 dark:border-sky-400/35 dark:bg-sky-500/12 dark:text-sky-50',
          loading:
            'border-primary/35 bg-background/85 text-foreground backdrop-blur-xl dark:bg-card/90',
          default:
            'border-border/80 bg-background/90 text-foreground backdrop-blur-xl dark:bg-card/90',
          closeButton:
            'right-2 top-2 rounded-lg border border-border/60 bg-background/70 p-1 text-foreground opacity-70 transition hover:opacity-100 dark:bg-background/40',
        },
      }}
    />
  )
}
