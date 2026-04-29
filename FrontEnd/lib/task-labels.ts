/** Libellés français pour statuts / priorités de tâches (UI). */

export const TASK_STATUS_LABELS_FR: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'À faire',
  in_progress: 'En cours',
  review: 'Revue',
  done: 'Terminé',
}

export const TASK_PRIORITY_LABELS_FR: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
}

export function taskStatusLabelFr(status: string): string {
  return TASK_STATUS_LABELS_FR[status] ?? status.replace(/_/g, ' ')
}

export function taskPriorityLabelFr(priority: string): string {
  return TASK_PRIORITY_LABELS_FR[priority] ?? priority
}
