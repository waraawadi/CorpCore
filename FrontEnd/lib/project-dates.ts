/** Bornes min/max pour champs date HTML (YYYY-MM-DD), alignées sur la période projet. */
export function taskDateInputBounds(projectStartDate: string, projectEndDate: string) {
  const min = projectStartDate?.trim() || undefined
  const max = projectEndDate?.trim() || undefined
  return { min, max }
}

export type TaskDateValidationIssue =
  | 'start_before_project'
  | 'start_after_project'
  | 'due_before_project'
  | 'due_after_project'
  | 'start_after_due'

export function validateTaskDatesAgainstProject(
  projectStartDate: string,
  projectEndDate: string,
  startDate: string | undefined,
  dueDate: string | undefined
): TaskDateValidationIssue | null {
  const ps = projectStartDate?.trim()
  const pe = projectEndDate?.trim()
  const sd = startDate?.trim()
  const dd = dueDate?.trim()

  if (sd && ps && sd < ps) return 'start_before_project'
  if (sd && pe && sd > pe) return 'start_after_project'
  if (dd && ps && dd < ps) return 'due_before_project'
  if (dd && pe && dd > pe) return 'due_after_project'
  if (sd && dd && sd > dd) return 'start_after_due'
  return null
}

export function taskDateValidationMessage(issue: TaskDateValidationIssue): string {
  switch (issue) {
    case 'start_before_project':
      return 'La date de début ne peut pas être avant le début du projet.'
    case 'start_after_project':
      return 'La date de début ne peut pas être après la fin du projet.'
    case 'due_before_project':
      return "L'échéance ne peut pas être avant le début du projet."
    case 'due_after_project':
      return "L'échéance ne peut pas être après la fin du projet."
    case 'start_after_due':
      return 'La date de début doit être antérieure ou égale à l’échéance.'
    default:
      return 'Dates invalides.'
  }
}
