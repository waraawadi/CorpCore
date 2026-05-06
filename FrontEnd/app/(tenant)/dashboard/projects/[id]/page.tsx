'use client'

import { useStore } from '@/lib/store'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  LayoutDashboard,
  LayoutGrid,
  List,
  BarChart3,
  Calendar,
  CalendarDays,
  Plus,
  TrendingUp,
  ListChecks,
  Users,
  CalendarRange,
  Paperclip,
  Upload,
  FolderOpen,
  Link2,
  Eye,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { KanbanBoard } from '@/components/kanban-board'
import { TaskList } from '@/components/task-list'
import { GanttChart } from '@/components/gantt-chart'
import { TimelineView } from '@/components/timeline-view'
import { ProjectCalendarView } from '@/components/project-calendar-view'
import { TaskPanel } from '@/components/task-panel'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  taskDateInputBounds,
  validateTaskDatesAgainstProject,
  taskDateValidationMessage,
} from '@/lib/project-dates'
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
import { DateTimeField } from '@/components/ui/date-time-field'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { getApiBaseUrl, formatApiErrorBody } from '@/lib/api'
import { FilePreviewDialog, type PreviewableFile } from '@/components/file-preview-dialog'

const RequiredMark = () => <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Obligatoire</span>

const statusColors = {
  planning: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const projectStatusLabelFr: Record<string, string> = {
  planning: 'Planification',
  active: 'Actif',
  on_hold: 'En pause',
  completed: 'Terminé',
}

type TaskCreateForm = {
  title: string
  description: string
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigneeId: string
  startDate: string
  dueDate: string
}

type ProjectAttachment = {
  id: string
  projectId: string
  name: string
  url: string
  type: string
  size: number
  source?: 'upload' | 'ged' | 'link'
}

type GedDocOption = {
  id: string
  title: string
  original_filename: string
}

type TeamMemberOption = {
  id: string
  name: string
  email: string
  role?: 'owner' | 'lead' | 'member'
}

const API_BASE = getApiBaseUrl()
const ACCESS_TOKEN_KEY = 'corpcore_access_token'

export default function ProjectDetailPage() {
  const { id } = useParams() as { id: string }
  const {
    projects,
    uiState,
    setViewMode,
    getProjectTasks,
    isHydrating,
    apiError,
    createTask,
    isAuthenticated,
    authUser,
    hydrateFromApi,
  } = useStore()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskSubmitting, setTaskSubmitting] = useState(false)
  const [taskFormError, setTaskFormError] = useState('')
  const [projectAttachments, setProjectAttachments] = useState<ProjectAttachment[]>([])
  const [projectFilesLoading, setProjectFilesLoading] = useState(false)
  const [projectAttachMode, setProjectAttachMode] = useState<'upload' | 'ged' | 'link'>('upload')
  const [projectAttachName, setProjectAttachName] = useState('')
  const [projectAttachUrl, setProjectAttachUrl] = useState('')
  const [projectAttachFile, setProjectAttachFile] = useState<File | null>(null)
  const [projectAttachSubmitting, setProjectAttachSubmitting] = useState(false)
  const [gedDocs, setGedDocs] = useState<GedDocOption[]>([])
  const [gedLoading, setGedLoading] = useState(false)
  const [selectedGedDocId, setSelectedGedDocId] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<PreviewableFile | null>(null)
  const [projectFilesDialogOpen, setProjectFilesDialogOpen] = useState(false)
  const [teamDialogOpen, setTeamDialogOpen] = useState(false)
  const [allTeamMembers, setAllTeamMembers] = useState<TeamMemberOption[]>([])
  const [teamMembersLoading, setTeamMembersLoading] = useState(false)
  const [teamMemberToAdd, setTeamMemberToAdd] = useState('')
  const [teamMembersSaving, setTeamMembersSaving] = useState(false)
  const [teamMembersError, setTeamMembersError] = useState('')
  const [taskForm, setTaskForm] = useState<TaskCreateForm>({
    title: '',
    description: '',
    status: 'todo' as const,
    priority: 'medium' as const,
    assigneeId: '',
    startDate: '',
    dueDate: '',
  })

  const routeKey = id.startsWith('proj-') ? id.replace('proj-', '') : id
  const project = projects.find((p) => p.id === id || p.id === routeKey)
  const projectTasks = getProjectTasks(project?.id || id)

  const projectDateBounds = useMemo(
    () =>
      taskDateInputBounds(
        (project?.startDate ?? '').slice(0, 10),
        (project?.endDate ?? '').slice(0, 10)
      ),
    [project?.startDate, project?.endDate]
  )

  const gedDocOptions = useMemo<SearchableOption[]>(
    () =>
      gedDocs.map((d) => ({
        value: d.id,
        label: d.title || d.original_filename || d.id,
        keywords: d.original_filename,
      })),
    [gedDocs]
  )

  const myProjectRole = useMemo<'owner' | 'lead' | 'member' | null>(() => {
    if (!authUser || !project) return null
    const me = project.team.find((m) => String(m.id) === String(authUser.id))
    return me?.role ?? null
  }, [authUser, project])

  const canManageProjectMembers = Boolean(
    authUser?.is_superuser || authUser?.is_staff || myProjectRole === 'owner' || myProjectRole === 'lead'
  )

  const projectMemberIds = useMemo(() => new Set((project?.team ?? []).map((m) => String(m.id))), [project?.team])

  const addableMemberOptions = useMemo<SearchableOption[]>(
    () =>
      allTeamMembers
        .filter((m) => !projectMemberIds.has(String(m.id)))
        .map((m) => ({
          value: String(m.id),
          label: m.name || m.email || `Utilisateur ${m.id}`,
          keywords: [m.email, m.role].filter(Boolean).join(' '),
        })),
    [allTeamMembers, projectMemberIds]
  )

  if (!project && isHydrating) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Chargement du projet…</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Projet introuvable.</p>
      </div>
    )
  }

  const viewModes = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
    { id: 'list', label: 'Liste', icon: List },
    { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
    { id: 'gantt', label: 'Gantt', icon: BarChart3 },
    { id: 'timeline', label: 'Chronologie', icon: Calendar },
  ] as const

  const doneCount = projectTasks.filter((t) => t.status === 'done').length
  /** Aligné sur les tâches du store (même logique que l’API : terminées / total). */
  const progressPercent = useMemo(() => {
    if (projectTasks.length > 0) {
      return Math.min(100, Math.round((doneCount / projectTasks.length) * 100))
    }
    const p = Number(project.progress)
    return Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0
  }, [projectTasks, project.progress, doneCount])
  const teamCount = (project.team ?? []).length
  const durationDays =
    project.startDate && project.endDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0

  const canCreateTask = taskForm.title.trim().length > 0

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canCreateTask || !project) {
      return
    }
    const ps = (project.startDate ?? '').slice(0, 10)
    const pe = (project.endDate ?? '').slice(0, 10)
    const issue = validateTaskDatesAgainstProject(ps, pe, taskForm.startDate || undefined, taskForm.dueDate || undefined)
    if (issue) {
      setTaskFormError(taskDateValidationMessage(issue))
      return
    }
    setTaskFormError('')
    setTaskSubmitting(true)
    const ok = await createTask({
      projectId: project.id,
      title: taskForm.title,
      description: taskForm.description,
      status: taskForm.status,
      priority: taskForm.priority,
      assigneeId: taskForm.assigneeId ? Number(taskForm.assigneeId) : null,
      startDate: taskForm.startDate || undefined,
      dueDate: taskForm.dueDate || undefined,
    })
    setTaskSubmitting(false)
    if (ok) {
      setTaskDialogOpen(false)
      setTaskForm({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        assigneeId: '',
        startDate: '',
        dueDate: '',
      })
    }
  }

  const projectApiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers || {}),
      },
    })
    if (!response.ok) {
      let detail = ''
      try {
        const body = await response.json()
        detail = formatApiErrorBody(body)
      } catch {
        detail = ''
      }
      throw new Error(detail || `Requete echouee (${response.status})`)
    }
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  const loadProjectAttachments = async (projectId: string) => {
    setProjectFilesLoading(true)
    try {
      const list = await projectApiRequest<ProjectAttachment[]>(`/project-attachments/?project=${projectId}`)
      setProjectAttachments(list)
    } finally {
      setProjectFilesLoading(false)
    }
  }

  const loadGedDocs = async () => {
    setGedLoading(true)
    try {
      const list = await projectApiRequest<GedDocOption[]>('/ged/documents/')
      setGedDocs(list)
    } finally {
      setGedLoading(false)
    }
  }

  const loadTeamMembersOptions = async () => {
    setTeamMembersLoading(true)
    setTeamMembersError('')
    try {
      const users = await projectApiRequest<
        Array<{
          id: string | number
          username?: string
          email?: string
          first_name?: string
          last_name?: string
          full_name?: string
        }>
      >('/hr/users/')
      setAllTeamMembers(
        users.map((user) => {
          const id = String(user.id)
          const fullName = (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`).trim()
          return {
            id,
            name: fullName || user.username || user.email || `Utilisateur ${id}`,
            email: user.email || '',
            role: 'member' as const,
          }
        })
      )
    } catch (e) {
      setAllTeamMembers([])
      setTeamMembersError(e instanceof Error ? e.message : 'Impossible de charger les membres.')
    } finally {
      setTeamMembersLoading(false)
    }
  }

  const patchProjectMembers = async (memberIds: string[]) => {
    if (!project) return false
    setTeamMembersSaving(true)
    setTeamMembersError('')
    try {
      await projectApiRequest(`/projects/${project.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          memberIds: memberIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0),
        }),
      })
      await hydrateFromApi()
      return true
    } catch (e) {
      setTeamMembersError(e instanceof Error ? e.message : 'Mise a jour des membres impossible.')
      return false
    } finally {
      setTeamMembersSaving(false)
    }
  }

  const handleAddProjectMember = async () => {
    if (!project || !teamMemberToAdd) return
    const nextIds = Array.from(new Set([...(project.team ?? []).map((m) => String(m.id)), teamMemberToAdd]))
    const ok = await patchProjectMembers(nextIds)
    if (ok) setTeamMemberToAdd('')
  }

  const handleRemoveProjectMember = async (memberId: string) => {
    if (!project) return
    const meId = String(authUser?.id ?? '')
    if (memberId === meId && !(authUser?.is_superuser || authUser?.is_staff)) {
      setTeamMembersError('Vous ne pouvez pas vous retirer vous-meme du projet.')
      return
    }
    const nextIds = (project.team ?? []).map((m) => String(m.id)).filter((id) => id !== String(memberId))
    await patchProjectMembers(nextIds)
  }

  const submitProjectAttachment = async () => {
    if (!project) return
    setProjectAttachSubmitting(true)
    try {
      if (projectAttachMode === 'upload') {
        if (!projectAttachFile) return
        const fd = new FormData()
        fd.append('project', project.id)
        fd.append('file', projectAttachFile)
        if (projectAttachName.trim()) fd.append('name', projectAttachName.trim())
        await projectApiRequest('/project-attachments/upload/', { method: 'POST', body: fd })
      } else if (projectAttachMode === 'ged') {
        if (!selectedGedDocId) return
        await projectApiRequest('/project-attachments/import-ged/', {
          method: 'POST',
          body: JSON.stringify({
            project: project.id,
            gedDocumentId: selectedGedDocId,
            name: projectAttachName.trim() || undefined,
          }),
        })
      } else {
        if (!projectAttachUrl.trim()) return
        const fallbackName = projectAttachUrl.split('/').pop() || 'fichier-lien'
        await projectApiRequest('/project-attachments/', {
          method: 'POST',
          body: JSON.stringify({
            project: project.id,
            name: projectAttachName.trim() || fallbackName,
            url: projectAttachUrl.trim(),
            type: '',
            size: 0,
          }),
        })
      }
      setProjectAttachName('')
      setProjectAttachUrl('')
      setProjectAttachFile(null)
      setSelectedGedDocId('')
      await loadProjectAttachments(project.id)
    } finally {
      setProjectAttachSubmitting(false)
    }
  }

  const deleteProjectAttachment = async (attachmentId: string) => {
    if (!project) return
    await projectApiRequest(`/project-attachments/${attachmentId}/`, { method: 'DELETE' })
    await loadProjectAttachments(project.id)
  }

  const openProjectAttachmentPreview = (attachment: ProjectAttachment) => {
    setPreviewAttachment({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.type || '',
      source: attachment.source,
      url: attachment.url,
    })
    setPreviewOpen(true)
  }

  const fetchProjectAttachmentPreviewUrl = useMemo(
    () => async (attachmentId: string) => {
      const data = await projectApiRequest<{ url: string }>(`/project-attachments/${attachmentId}/preview-url/`)
      return data.url
    },
    [projectApiRequest]
  )

  const fetchProjectAttachmentOnlyofficeConfig = useMemo(
    () => async (attachmentId: string) => {
      return projectApiRequest<{ documentServerUrl: string; token: string; config?: Record<string, unknown> }>(
        `/project-attachments/${attachmentId}/onlyoffice-config/`
      )
    },
    [projectApiRequest]
  )

  useEffect(() => {
    if (!project) return
    void loadProjectAttachments(project.id)
    void loadGedDocs()
  }, [project?.id])

  useEffect(() => {
    if (!teamDialogOpen) return
    void loadTeamMembersOptions()
  }, [teamDialogOpen])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto flex h-full min-h-0 min-w-0 w-full max-w-[1600px] flex-col gap-5 overflow-x-hidden overflow-y-hidden p-3 sm:p-4 md:gap-6 md:p-8"
    >
      {/* Breadcrumb & Header */}
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="mb-0 flex min-w-0 shrink-0 flex-col gap-3 md:gap-4"
      >
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto md:justify-end">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2 sm:flex-none"
              onClick={() => setTeamDialogOpen(true)}
            >
              <Users className="h-4 w-4" />
              Equipe
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2 sm:flex-none"
              onClick={() => setProjectFilesDialogOpen(true)}
            >
              <Paperclip className="h-4 w-4" />
              Fichiers du projet
            </Button>
            <Dialog
              open={taskDialogOpen}
              onOpenChange={(open) => {
                setTaskDialogOpen(open)
                setTaskFormError('')
                if (open) {
                  setTaskForm({
                    title: '',
                    description: '',
                    status: 'todo',
                    priority: 'medium',
                    assigneeId: '',
                    startDate: '',
                    dueDate: '',
                  })
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="flex-1 gap-2 sm:flex-none" disabled={!isAuthenticated}>
                  <Plus className="w-4 h-4" />
                  Nouvelle tâche
                </Button>
              </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
              <DialogHeader>
                <DialogTitle>Créer une tâche</DialogTitle>
                <DialogDescription>
                  Renseignez les informations de la tâche. Les dates doivent rester dans la période du projet.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Titre<RequiredMark /></Label>
                  <Input
                    id="task-title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Configurer les permissions RH"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-desc">Description</Label>
                  <Textarea
                    id="task-desc"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Ajoute le contexte, les etapes, et le resultat attendu."
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-status">Statut</Label>
                    <select
                      id="task-status"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={taskForm.status}
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          status: e.target.value as 'backlog' | 'todo' | 'in_progress' | 'review' | 'done',
                        }))
                      }
                    >
                      <option value="backlog">Backlog</option>
                      <option value="todo">À faire</option>
                      <option value="in_progress">En cours</option>
                      <option value="review">Revue</option>
                      <option value="done">Terminé</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-priority">Priorité</Label>
                    <select
                      id="task-priority"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={taskForm.priority}
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent',
                        }))
                      }
                    >
                      <option value="low">Basse</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-assignee">Membre assigné</Label>
                  <select
                    id="task-assignee"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={taskForm.assigneeId}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        assigneeId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Non assigné</option>
                    {(project.team ?? []).map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DateTimeField
                    id="task-start"
                    label="Début"
                    value={taskForm.startDate}
                    min={projectDateBounds.min}
                    max={projectDateBounds.max}
                    onChange={(value) => setTaskForm((prev) => ({ ...prev, startDate: value }))}
                  />
                  <DateTimeField
                    id="task-due"
                    label="Échéance"
                    value={taskForm.dueDate}
                    min={projectDateBounds.min}
                    max={projectDateBounds.max}
                    onChange={(value) => setTaskForm((prev) => ({ ...prev, dueDate: value }))}
                  />
                </div>
                {(taskFormError || apiError) && (
                  <p className="text-sm text-destructive">{taskFormError || apiError}</p>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={!canCreateTask || taskSubmitting || !isAuthenticated}>
                    {taskSubmitting ? 'Création…' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* View Mode Selector */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="min-w-0 shrink-0 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1.5"
      >
        <div className="flex w-max min-w-full gap-2">
          {viewModes.map((mode) => {
            const Icon = mode.icon
            const active = uiState.viewMode === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/80'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {mode.label}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* View Content */}
      {uiState.viewMode === 'dashboard' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="min-h-0 min-w-0 flex-1 overflow-auto pr-1"
        >
          <div className="space-y-3">
            <div className="min-w-0 rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-4 shadow-sm md:p-5">
              <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 md:gap-3">
                <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground md:text-3xl">{project.name}</h1>
                <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                  {projectStatusLabelFr[project.status] ?? project.status.replace('_', ' ')}
                </Badge>
                {project.workTeamName ? <Badge variant="outline">{project.workTeamName}</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground md:text-base">{project.description}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-5 shadow-sm ring-1 ring-border/30 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/12 p-2.5 text-primary">
                    <TrendingUp className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{progressPercent}%</span>
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Avancement</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-5 shadow-sm ring-1 ring-border/30 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-emerald-500/12 p-2.5 text-emerald-600 dark:text-emerald-400">
                    <ListChecks className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{projectTasks.length}</span>
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tâches</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{doneCount}</span> terminée{doneCount !== 1 ? 's' : ''} sur {projectTasks.length}
                </p>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-5 shadow-sm ring-1 ring-border/30 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-violet-500/12 p-2.5 text-violet-600 dark:text-violet-400">
                    <Users className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{teamCount}</span>
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Équipe</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {teamCount === 0 ? 'Aucun membre' : teamCount === 1 ? '1 membre' : `${teamCount} membres`}
                </p>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-5 shadow-sm ring-1 ring-border/30 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-sky-500/12 p-2.5 text-sky-600 dark:text-sky-400">
                    <CalendarRange className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {durationDays}
                    <span className="ml-0.5 text-lg font-medium text-muted-foreground">j</span>
                  </span>
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Durée prévue</p>
                <p className="mt-2 text-xs text-muted-foreground">Du début à la fin du projet</p>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {apiError && (
            <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Alerte : {apiError}
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                {uiState.viewMode === 'kanban' && (
                  <KanbanBoard
                    className="min-h-0 flex-1"
                    projectId={project.id}
                    onSelectTask={setSelectedTaskId}
                    onCreateTaskRequest={() => setTaskDialogOpen(true)}
                  />
                )}
                {uiState.viewMode === 'list' && (
                  <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <TaskList projectId={project.id} onSelectTask={setSelectedTaskId} />
                  </div>
                )}
                {uiState.viewMode === 'gantt' && (
                  <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <GanttChart projectId={project.id} onSelectTask={setSelectedTaskId} />
                  </div>
                )}
                {uiState.viewMode === 'calendar' && (
                  <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                    <ProjectCalendarView projectId={project.id} onSelectTask={setSelectedTaskId} />
                  </div>
                )}
                {uiState.viewMode === 'timeline' && (
                  <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <TimelineView projectId={project.id} onSelectTask={setSelectedTaskId} />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Task Panel — même hauteur utile que la zone Kanban (md+) */}
            {selectedTaskId && uiState.viewMode !== 'gantt' && (
              <>
                <div className="md:hidden">
                  <TaskPanel
                    taskId={selectedTaskId}
                    projectId={project.id}
                    onClose={() => setSelectedTaskId(null)}
                  />
                </div>
                <div className="hidden h-full min-h-0 w-96 shrink-0 flex-col border-l border-border md:flex">
                  <TaskPanel
                    taskId={selectedTaskId}
                    projectId={project.id}
                    onClose={() => setSelectedTaskId(null)}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={previewAttachment}
        fetchPreviewUrl={fetchProjectAttachmentPreviewUrl}
        fetchOnlyofficeConfig={fetchProjectAttachmentOnlyofficeConfig}
      />

      <Dialog
        open={teamDialogOpen}
        onOpenChange={(open) => {
          setTeamDialogOpen(open)
          if (!open) {
            setTeamMembersError('')
            setTeamMemberToAdd('')
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Equipe du projet</DialogTitle>
            <DialogDescription>
              Consultez les membres du projet et gerez les acces selon votre role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!canManageProjectMembers ? (
              <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Acces en lecture seule : vous n&apos;avez pas les droits pour ajouter ou retirer des membres.
              </p>
            ) : null}
            {canManageProjectMembers ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <SearchableSelect
                  value={teamMemberToAdd}
                  onChange={setTeamMemberToAdd}
                  options={addableMemberOptions}
                  placeholder={teamMembersLoading ? 'Chargement des membres...' : 'Selectionner un membre a ajouter'}
                  emptyMessage="Aucun membre disponible"
                  disabled={teamMembersLoading || teamMembersSaving}
                />
                <Button
                  type="button"
                  onClick={() => void handleAddProjectMember()}
                  disabled={!teamMemberToAdd || teamMembersSaving}
                >
                  Ajouter
                </Button>
              </div>
            ) : null}
            {teamMembersError ? <p className="text-sm text-destructive">{teamMembersError}</p> : null}
            <div className="space-y-2">
              {project.team.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun membre sur ce projet.</p>
              ) : null}
              {project.team.map((member) => {
                const cannotRemoveOwner = member.role === 'owner' && !(authUser?.is_superuser || authUser?.is_staff)
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.name || member.email || `Utilisateur ${member.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email || '-'} -{' '}
                        {member.role === 'owner' ? 'Owner' : member.role === 'lead' ? 'Lead' : 'Membre'}
                      </p>
                    </div>
                    {canManageProjectMembers ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={teamMembersSaving || cannotRemoveOwner}
                        onClick={() => void handleRemoveProjectMember(String(member.id))}
                      >
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={projectFilesDialogOpen} onOpenChange={setProjectFilesDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-4xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Fichiers du projet</DialogTitle>
            <DialogDescription>
              Ajoutez et consultez les fichiers du projet sans réduire l’espace de travail des tâches.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
              {(
                [
                  { id: 'upload' as const, label: 'Importer', icon: Upload },
                  { id: 'ged' as const, label: 'Depuis GED', icon: FolderOpen },
                  { id: 'link' as const, label: 'Lien', icon: Link2 },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setProjectAttachMode(opt.id)}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium transition-colors ${
                      projectAttachMode === opt.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                value={projectAttachName}
                onChange={(e) => setProjectAttachName(e.target.value)}
                placeholder="Nom (optionnel)"
              />
              {projectAttachMode === 'upload' ? (
                <Input type="file" onChange={(e) => setProjectAttachFile(e.target.files?.[0] ?? null)} />
              ) : null}
              {projectAttachMode === 'ged' ? (
                <SearchableSelect
                  value={selectedGedDocId}
                  onChange={setSelectedGedDocId}
                  options={gedDocOptions}
                  placeholder={gedLoading ? 'Chargement…' : 'Document GED'}
                  emptyMessage="Aucun document GED"
                  disabled={gedLoading}
                />
              ) : null}
              {projectAttachMode === 'link' ? (
                <Input
                  value={projectAttachUrl}
                  onChange={(e) => setProjectAttachUrl(e.target.value)}
                  placeholder="https://..."
                />
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitProjectAttachment()}
              disabled={
                projectAttachSubmitting ||
                (projectAttachMode === 'upload' && !projectAttachFile) ||
                (projectAttachMode === 'ged' && !selectedGedDocId) ||
                (projectAttachMode === 'link' && !projectAttachUrl.trim())
              }
            >
              Ajouter le fichier
            </Button>
            <div className="space-y-2">
              {projectFilesLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
              {!projectFilesLoading && projectAttachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun fichier projet.</p>
              ) : null}
              {projectAttachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.source || 'link'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => openProjectAttachmentPreview(a)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteProjectAttachment(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
