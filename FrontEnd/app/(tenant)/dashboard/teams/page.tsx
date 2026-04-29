'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getApiBaseUrl, formatApiErrorBody } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { DataPagination } from '@/components/ui/data-pagination'

type UserOption = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
}

type TeamMember = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
}

type Team = {
  id: string
  name: string
  description: string
  is_active: boolean
  leaderId: number | null
  leaderName: string
  members: TeamMember[]
  projectsCount: number
}

type TeamForm = {
  name: string
  description: string
  is_active: boolean
  leaderId: string
  memberIds: number[]
}

const API_BASE = getApiBaseUrl()

const emptyForm: TeamForm = {
  name: '',
  description: '',
  is_active: true,
  leaderId: '',
  memberIds: [],
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('corpcore_access_token') : null
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

const displayUser = (user: UserOption) => user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.username

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TeamForm>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const leaderOptions = useMemo<SearchableOption[]>(
    () => [
      { value: '', label: 'Aucun responsable' },
      ...users.map((user) => ({
        value: String(user.id),
        label: displayUser(user),
        keywords: `${user.email} ${user.username}`,
      })),
    ],
    [users]
  )
  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) => {
      const text = `${displayUser(user)} ${user.email} ${user.username}`.toLowerCase()
      return text.includes(q)
    })
  }, [users, memberQuery])
  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((team) => {
      const text = `${team.name} ${team.leaderName} ${team.description}`.toLowerCase()
      return text.includes(q)
    })
  }, [teams, query])
  const totalPages = Math.max(1, Math.ceil(filteredTeams.length / pageSize))
  const paginatedTeams = useMemo(
    () => filteredTeams.slice((page - 1) * pageSize, page * pageSize),
    [filteredTeams, page, pageSize]
  )

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [teamsData, usersData] = await Promise.all([
        apiRequest<Team[]>('/teams/'),
        apiRequest<UserOption[]>('/hr/users/'),
      ])
      setTeams(teamsData)
      setUsers(usersData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement equipes'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query])

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setMemberQuery('')
    setDialogOpen(true)
  }

  const openEdit = (team: Team) => {
    setEditingId(team.id)
    setForm({
      name: team.name,
      description: team.description || '',
      is_active: team.is_active,
      leaderId: team.leaderId != null ? String(team.leaderId) : '',
      memberIds: team.members.map((member) => member.id),
    })
    setMemberQuery('')
    setDialogOpen(true)
  }

  const toggleMember = (id: number, checked: boolean) => {
    setForm((prev) => {
      if (checked) {
        if (prev.memberIds.includes(id)) return prev
        return { ...prev, memberIds: [...prev.memberIds, id] }
      }
      return {
        ...prev,
        memberIds: prev.memberIds.filter((memberId) => memberId !== id),
        leaderId: prev.leaderId === String(id) ? '' : prev.leaderId,
      }
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(editingId ? `/teams/${editingId}/` : '/teams/', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description,
          is_active: form.is_active,
          leaderId: form.leaderId ? Number(form.leaderId) : null,
          memberIds: form.memberIds,
        }),
      })
      const wasTeamUpdate = Boolean(editingId)
      await loadData()
      setDialogOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      notify.success(wasTeamUpdate ? 'Equipe mise a jour' : 'Equipe creee')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement equipe'
      setError(msg)
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const removeTeam = async (id: string) => {
    try {
      await apiRequest(`/teams/${id}/`, { method: 'DELETE' })
      await loadData()
      notify.success('Equipe supprimee')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur suppression equipe'
      setError(msg)
      notify.error(msg)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:gap-6 md:p-8">
      <h1 className="shrink-0 text-3xl font-bold tracking-tight text-foreground">Equipes de travail</h1>
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une equipe..."
          className="sm:max-w-md"
        />
        <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
          Nouvelle equipe
        </Button>
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden border border-border/80 shadow-sm">
        <CardContent className="flex h-full min-h-0 flex-col pt-3">
          <div className="min-h-0 flex-1 overflow-auto md:hidden">
            <div className="space-y-2 pr-1">
              {paginatedTeams.map((team) => (
                <div key={team.id} className="rounded-lg border border-border/70 bg-card p-3">
                  <div className="mb-2">
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.description || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>Responsable: {team.leaderName || '—'}</p>
                    <p>Membres: {team.members.length}</p>
                    <p>Projets: {team.projectsCount || 0}</p>
                    <p>Statut: {team.is_active ? 'Actif' : 'Inactif'}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => openEdit(team)}>
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setDeleteTarget({ id: team.id, name: team.name })}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden min-h-0 flex-1 overflow-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Nom</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Membres</TableHead>
                  <TableHead>Projets</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTeams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-xs text-muted-foreground">{team.description || '—'}</p>
                    </TableCell>
                    <TableCell>{team.leaderName || '—'}</TableCell>
                    <TableCell>{team.members.length}</TableCell>
                    <TableCell>{team.projectsCount || 0}</TableCell>
                    <TableCell>{team.is_active ? 'Actif' : 'Inactif'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(team)}>
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget({ id: team.id, name: team.name })}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredTeams.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune equipe trouvee.</p>
          )}
          {!!filteredTeams.length ? (
            <DataPagination
              totalItems={filteredTeams.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          ) : null}
          {loading && <p className="py-4 text-sm text-muted-foreground">Chargement des equipes...</p>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-4xl sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier equipe' : 'Nouvelle equipe'}</DialogTitle>
            <DialogDescription>Definir le responsable, les membres et l'etat de l'equipe.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nom de l'equipe</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Equipe Produit"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Responsable</Label>
                <SearchableSelect
                  value={form.leaderId}
                  onChange={(value) => setForm((prev) => ({ ...prev, leaderId: value }))}
                  options={leaderOptions}
                  placeholder="Selectionner un responsable"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Objectif et perimetre de l'equipe"
              />
            </div>

            <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Equipe active
            </label>

            <div className="rounded-lg border border-input/80 p-4">
              <p className="mb-3 text-sm font-medium">Membres de l'equipe</p>
              <Input
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="Rechercher un collaborateur..."
                className="mb-3"
              />
              <div className="grid max-h-64 gap-2 overflow-y-auto md:grid-cols-2">
                {filteredMembers.map((user) => {
                  const checked = form.memberIds.includes(user.id)
                  return (
                    <label key={user.id} className="flex items-start gap-2 rounded border border-input/70 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleMember(user.id, event.target.checked)}
                      />
                      <span>
                        <span className="block font-medium">{displayUser(user)}</span>
                        <span className="block text-xs text-muted-foreground">{user.email}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'equipe ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `L'equipe "${deleteTarget.name}" sera supprimee. Cette action est irreversible.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                if (!deleteTarget) return
                setDeleteLoading(true)
                void removeTeam(deleteTarget.id).finally(() => {
                  setDeleteLoading(false)
                  setDeleteTarget(null)
                })
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

