/**
 * UI utility functions for common operations
 */

import { notify } from '@/lib/notify'

export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  _duration?: number
) {
  if (typeof window === 'undefined') return
  if (type === 'success') notify.success(message)
  else if (type === 'error') notify.error(message)
  else if (type === 'warning') notify.warning(message)
  else notify.info(message)
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function getDaysSince(date: string | Date): number {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function getProgressColor(progress: number): string {
  if (progress < 25) return 'bg-red-500'
  if (progress < 50) return 'bg-orange-500'
  if (progress < 75) return 'bg-yellow-500'
  return 'bg-green-500'
}

export function getPriorityColor(
  priority: 'low' | 'medium' | 'high'
): string {
  switch (priority) {
    case 'low':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'medium':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'in-progress':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    case 'in_review':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}
