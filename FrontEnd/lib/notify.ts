import { toast as sonnerToast } from 'sonner'

export type ToastTone = 'success' | 'error' | 'warning' | 'info' | 'loading'

/**
 * Toasts centralisés (Sonner). Couleurs par type gérées dans `AppToaster`.
 */
export const notify = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, description ? { description } : undefined),

  error: (message: string, description?: string) =>
    sonnerToast.error(message, description ? { description } : undefined),

  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, description ? { description } : undefined),

  info: (message: string, description?: string) =>
    sonnerToast.info(message, description ? { description } : undefined),

  loading: (message: string) => sonnerToast.loading(message),

  promise: sonnerToast.promise,

  dismiss: sonnerToast.dismiss,

  /** Toast neutre (ex. action sans catégorie forte) */
  message: (message: string, description?: string) =>
    sonnerToast.message(message, description ? { description } : undefined),
}
