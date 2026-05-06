'use client'

import { useStore } from '@/lib/store'
import type { Project } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { DateTimeField } from '@/components/ui/date-time-field'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { getApiBaseUrl } from '@/lib/api'
import { DataPagination } from '@/components/ui/data-pagination'

const RequiredMark = () => (
  <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
    Obligatoire
  </span>
)

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

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

type ProjectForm = {
  name: string
  description: string
  status: 'planning' | 'active' | 'on_hold' | 'completed'
  startDate: string
  endDate: string
  workTeamId: string
  color: string
}

type WorkTeamSummary = {
  id: string
  name: string
  leaderName?: string
}

const API_BASE = getApiBaseUrl()

function projectToForm(p: Project): ProjectForm {
  return {
    name: p.name,
    description: p.description ?? '',
    status: p.status,
    startDate: (p.startDate || '').slice(0, 10),
    endDate: (p.endDate || '').slice(0, 10),
    workTeamId: p.workTeamId || '',
    color: p.color?.trim() || '#185FA5',
  }
}

export default function ProjectsPage() {
  const { projects, createProject, updateProject, deleteProject, getProjectTasks, apiError, isAuthenticated } = useStore()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    description: '',
    status: 'planning' as const,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    workTeamId: '',
    color: '#185FA5',
  })

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProjectForm | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>('all')
  const [workTeams, setWorkTeams] = useState<WorkTeamSummary[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const canSubmit = form.name.trim().length > 0 && form.startDate && form.endDate
  const canEditSubmit =
    editForm && editId && editForm.name.trim().length > 0 && editForm.startDate && editForm.endDate
  const visibleProjects = useMemo(
    () => (statusFilter === 'all' ? projects : projects.filter((project) => project.status === statusFilter)),
    [projects, statusFilter]
  )
  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / pageSize))
  const paginatedProjects = useMemo(
    () => visibleProjects.slice((page - 1) * pageSize, page * pageSize),
    [visibleProjects, page, pageSize]
  )
  const workTeamOptions = useMemo<SearchableOption[]>(
    () => [
      { value: '', label: 'Aucune equipe' },
      ...workTeams.map((team) => ({
        value: team.id,
        label: team.name,
        keywords: team.leaderName || '',
      })),
    ],
    [workTeams]
  )

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    const ok = await createProject({
      ...form,
      workTeamId: form.workTeamId || null,
    })
    setIsSubmitting(false)
    if (ok) {
      setOpen(false)
      setForm((prev) => ({
        ...prev,
        name: '',
        description: '',
        workTeamId: '',
      }))
    }
  }

  const openEdit = (p: Project) => {
    setEditId(p.id)
    setEditForm(projectToForm(p))
    setEditOpen(true)
  }

  const handleUpdateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEditSubmit || !editId || !editForm) return
    setEditSubmitting(true)
    const ok = await updateProject(editId, {
      ...editForm,
      workTeamId: editForm.workTeamId || null,
    })
    setEditSubmitting(false)
    if (ok) {
      setEditOpen(false)
      setEditId(null)
      setEditForm(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    const ok = await deleteProject(deleteTarget.id)
    setDeleteSubmitting(false)
    if (ok) {
      setDeleteOpen(false)
      setDeleteTarget(null)
    }
  }

  useEffect(() => {
    const loadWorkTeams = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('corpcore_access_token') : null
        if (!token) return
        const response = await fetch(`${API_BASE}/teams/`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return
        const payload = (await response.json()) as WorkTeamSummary[]
        setWorkTeams(payload)
      } catch {
        setWorkTeams([])
      }
    }
    void loadWorkTeams()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:gap-6 md:p-8"
    >
      <motion.div variants={itemVariants} className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Projets</h1>
          <p className="text-muted-foreground">
            Pilotez vos projets et suivez l’avancement de vos équipes au même endroit.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nouveau projet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un projet</DialogTitle>
              <DialogDescription>
                Toutes les actions CRUD doivent passer par un dialogue.
              </DialogDescription>
            </DialogHeader>

            {!isAuthenticated && (
              <p className="text-sm text-amber-600">Connecte-toi d’abord pour créer un projet via l’API.</p>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Nom<RequiredMark /></Label>
                <Input
                  id="project-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Lancement ERP filiale Benin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Objectif, livrables, contexte du projet..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateTimeField
                  id="project-start"
                  label={<><span>Début</span><RequiredMark /></>}
                  value={form.startDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))}
                  required
                />
                <DateTimeField
                  id="project-end"
                  label={<><span>Fin</span><RequiredMark /></>}
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-team">Equipe de travail</Label>
                <SearchableSelect
                  value={form.workTeamId}
                  onChange={(value) => setForm((prev) => ({ ...prev, workTeamId: value }))}
                  options={workTeamOptions}
                  placeholder="Selectionner une equipe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-color">Couleur du projet</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="project-color"
                    type="color"
                    className="h-10 w-14 cursor-pointer border p-1"
                    value={form.color}
                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                  />
                  <Input
                    aria-label="Code couleur hex"
                    value={form.color}
                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-status">Statut</Label>
                <select
                  id="project-status"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as 'planning' | 'active' | 'on_hold' | 'completed',
                    }))
                  }
                >
                  <option value="planning">Planification</option>
                  <option value="active">Actif</option>
                  <option value="on_hold">En pause</option>
                  <option value="completed">Terminé</option>
                </select>
              </div>

              {apiError && <p className="text-sm text-destructive">{apiError}</p>}

              <DialogFooter>
                <Button type="submit" disabled={!isAuthenticated || !canSubmit || isSubmitting}>
                  {isSubmitting ? 'Création...' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditId(null)
            setEditForm(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
            <DialogDescription>Mettre à jour les informations et la couleur du projet.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-project-name">Nom<RequiredMark /></Label>
                <Input
                  id="edit-project-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-project-description">Description</Label>
                <Textarea
                  id="edit-project-description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateTimeField
                  id="edit-project-start"
                  label={<><span>Début</span><RequiredMark /></>}
                  value={editForm.startDate}
                  onChange={(value) =>
                    setEditForm((prev) => (prev ? { ...prev, startDate: value } : prev))
                  }
                  required
                />
                <DateTimeField
                  id="edit-project-end"
                  label={<><span>Fin</span><RequiredMark /></>}
                  value={editForm.endDate}
                  min={editForm.startDate || undefined}
                  onChange={(value) =>
                    setEditForm((prev) => (prev ? { ...prev, endDate: value } : prev))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-project-team">Equipe de travail</Label>
                <SearchableSelect
                  value={editForm.workTeamId}
                  onChange={(value) => setEditForm((prev) => (prev ? { ...prev, workTeamId: value } : prev))}
                  options={workTeamOptions}
                  placeholder="Selectionner une equipe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-project-color">Couleur</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="edit-project-color"
                    type="color"
                    className="h-10 w-14 cursor-pointer border p-1"
                    value={editForm.color}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, color: e.target.value } : prev))
                    }
                  />
                  <Input
                    value={editForm.color}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, color: e.target.value } : prev))
                    }
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-project-status">Statut</Label>
                <select
                  id="edit-project-status"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: e.target.value as 'planning' | 'active' | 'on_hold' | 'completed',
                          }
                        : prev
                    )
                  }
                >
                  <option value="planning">Planification</option>
                  <option value="active">Actif</option>
                  <option value="on_hold">En pause</option>
                  <option value="completed">Terminé</option>
                </select>
              </div>
              {apiError && <p className="text-sm text-destructive">{apiError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={!isAuthenticated || !canEditSubmit || editSubmitting}>
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le projet ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Le projet « ${deleteTarget.name} » et toutes ses tâches seront supprimés définitivement.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteConfirm()
              }}
              disabled={deleteSubmitting || !isAuthenticated}
            >
              {deleteSubmitting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <motion.div variants={itemVariants} className="flex shrink-0 flex-wrap gap-2">
        {(
          [
            { id: 'all', label: 'Tous' },
            { id: 'active', label: 'Actifs' },
            { id: 'planning', label: 'Planification' },
            { id: 'on_hold', label: 'En pause' },
            { id: 'completed', label: 'Terminés' },
          ] as const
        ).map((filter) => (
          <Button
            key={filter.id}
            type="button"
            onClick={() => setStatusFilter(filter.id)}
            variant={filter.id === statusFilter ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
          >
            {filter.label}
          </Button>
        ))}
      </motion.div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <motion.div
          variants={containerVariants}
          className="grid h-full min-h-0 grid-cols-1 content-start gap-6 overflow-auto pr-1 md:grid-cols-2 lg:grid-cols-3"
        >
          {paginatedProjects.map((project) => {
          const team = project.team ?? []
          const tasks = getProjectTasks(project.id)
          const doneCount = tasks.filter((task) => task.status === 'done').length
          const progressWidth =
            tasks.length > 0
              ? Math.min(100, Math.round((doneCount / tasks.length) * 100))
              : Math.min(100, Math.max(0, Number.isFinite(Number(project.progress)) ? Number(project.progress) : 0))
          return (
            <motion.div key={project.id} variants={itemVariants}>
              <Card className="relative h-full overflow-hidden border-border/60 shadow-sm ring-1 ring-border/30 transition-all hover:shadow-md">
                <div
                  className="h-1.5"
                  style={{ backgroundColor: project.color || '#185FA5' }}
                />
                <div className="absolute right-2 top-10 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!isAuthenticated}
                        aria-label="Actions projet"
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => openEdit(project)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeleteTarget({ id: project.id, name: project.name })
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Link href={`/dashboard/projects/${project.id}`} className="block cursor-pointer">
                  <CardHeader>
                    <div className="mb-2 flex items-start justify-between pr-10">
                      <h3 className="line-clamp-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                        {project.name}
                      </h3>
                    </div>
                    <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                      {projectStatusLabelFr[project.status] ?? project.status.replace('_', ' ')}
                    </Badge>
                    {project.workTeamName ? (
                      <Badge variant="outline" className="ml-2">
                        {project.workTeamName}
                      </Badge>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Avancement
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {progressWidth}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-accent transition-[width] duration-700 ease-out"
                          style={{ width: `${progressWidth}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Équipe
                      </p>
                      <div className="flex -space-x-2">
                        {team.slice(0, 3).map((member) => (
                          <div
                            key={member.id}
                            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-gradient-to-br from-primary to-accent text-xs font-semibold text-white"
                            title={member.name}
                          >
                            {member.avatar}
                          </div>
                        ))}
                        {team.length > 3 && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-semibold text-muted-foreground">
                            +{team.length - 3}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      <div>
                        <p className="mb-1 font-medium text-foreground">Début</p>
                        <p className="tabular-nums">
                          {project.startDate ? new Date(project.startDate).toLocaleDateString('fr-FR') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 font-medium text-foreground">Fin</p>
                        <p className="tabular-nums">
                          {project.endDate ? new Date(project.endDate).toLocaleDateString('fr-FR') : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            </motion.div>
          )
          })}
          {!visibleProjects.length ? (
            <div className="col-span-full rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
              Aucun projet pour ce filtre.
            </div>
          ) : null}
        </motion.div>
      </div>
      {!!visibleProjects.length ? (
        <DataPagination
          totalItems={visibleProjects.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      ) : null}
    </motion.div>
  )
}
