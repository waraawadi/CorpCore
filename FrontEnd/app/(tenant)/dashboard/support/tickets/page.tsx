'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPagination } from '@/components/ui/data-pagination'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { useStore } from '@/lib/store'
import { SupportPriorityBadge, SupportStatusBadge, SUPPORT_CATEGORY_LABEL, SUPPORT_PRIORITY_LABEL, SUPPORT_STATUS_LABEL } from '../_components/support-status'
import { SupportSubnav } from '../_components/support-subnav'
import {
  supportApiRequest,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../_lib/support-api'

type HrUser = { id: number; full_name: string; username: string; email: string }

const STATUS_OPTIONS: { value: SupportTicketStatus; label: string }[] = (
  ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const
).map((value) => ({ value, label: SUPPORT_STATUS_LABEL[value] }))

const PRIORITY_OPTIONS: { value: SupportTicketPriority; label: string }[] = (
  ['low', 'normal', 'high', 'urgent'] as const
).map((value) => ({ value, label: SUPPORT_PRIORITY_LABEL[value] }))

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = (
  ['general', 'access', 'billing', 'bug', 'feature', 'other'] as const
).map((value) => ({ value, label: SUPPORT_CATEGORY_LABEL[value] }))

export default function SupportTicketsPage() {
  const isCompanyAdmin = useStore((s) => Boolean(s.user?.is_company_admin))
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [users, setUsers] = useState<HrUser[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [createOpen, setCreateOpen] = useState(false)
  const [cTitle, setCTitle] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [cCategory, setCCategory] = useState<SupportTicketCategory>('general')
  const [cPriority, setCPriority] = useState<SupportTicketPriority>('normal')

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<SupportTicket | null>(null)
  const [dStatus, setDStatus] = useState<SupportTicketStatus>('open')
  const [dPriority, setDPriority] = useState<SupportTicketPriority>('normal')
  const [dAssignee, setDAssignee] = useState('')
  const [newComment, setNewComment] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const data = await supportApiRequest<HrUser[]>('/hr/users/')
      setUsers(data)
    } catch {
      setUsers([])
    }
  }, [])

  const loadTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      if (assigneeFilter) params.set('assignee', assigneeFilter)
      if (mineOnly) params.set('mine', '1')
      const q = params.toString()
      const data = await supportApiRequest<SupportTicket[]>(`/support/tickets/${q ? `?${q}` : ''}`)
      setTickets(data)
    } catch (error) {
      notify.error('Chargement tickets impossible', error instanceof Error ? error.message : undefined)
    }
  }, [statusFilter, priorityFilter, assigneeFilter, mineOnly])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  const assigneeSelectOptions = useMemo(
    () => [
      { value: '', label: 'Tous les assignes' },
      ...users.map((u) => ({ value: String(u.id), label: u.full_name || u.username })),
    ],
    [users]
  )

  const assigneeFormOptions = useMemo(
    () => [
      { value: '', label: 'Non assigne' },
      ...users.map((u) => ({ value: String(u.id), label: u.full_name || u.username })),
    ],
    [users]
  )

  const filteredLocal = useMemo(() => {
    const q = search.trim().toLowerCase()
    let base = tickets
    if (q) {
      base = base.filter(
        (t) =>
          `${t.reference} ${t.title} ${t.description} ${t.requester_name} ${t.assignee_name}`.toLowerCase().includes(q)
      )
    }
    return base
  }, [tickets, search])

  const totalItems = filteredLocal.length
  const paged = filteredLocal.slice((page - 1) * pageSize, page * pageSize)

  const openCreate = () => {
    setCTitle('')
    setCDesc('')
    setCCategory('general')
    setCPriority('normal')
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!cTitle.trim()) {
      notify.error('Le titre est obligatoire')
      return
    }
    try {
      await supportApiRequest<SupportTicket>('/support/tickets/', {
        method: 'POST',
        body: JSON.stringify({
          title: cTitle.trim(),
          description: cDesc.trim(),
          category: cCategory,
          priority: cPriority,
        }),
      })
      setCreateOpen(false)
      await loadTickets()
      notify.success('Ticket cree')
    } catch (error) {
      notify.error('Creation impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const openDetail = async (id: string) => {
    try {
      const data = await supportApiRequest<SupportTicket>(`/support/tickets/${id}/`)
      setDetail(data)
      setDStatus(data.status)
      setDPriority(data.priority)
      setDAssignee(data.assignee != null ? String(data.assignee) : '')
      setNewComment('')
      setDetailOpen(true)
    } catch (error) {
      notify.error('Chargement ticket impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const saveDetail = async () => {
    if (!detail) return
    try {
      const payload = {
        title: detail.title,
        description: detail.description,
        category: detail.category,
        status: dStatus,
        priority: dPriority,
        assignee: dAssignee ? Number(dAssignee) : null,
      }
      await supportApiRequest(`/support/tickets/${detail.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const refreshed = await supportApiRequest<SupportTicket>(`/support/tickets/${detail.id}/`)
      setDetail(refreshed)
      await loadTickets()
      notify.success('Ticket mis a jour')
    } catch (error) {
      notify.error('Mise a jour impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const addComment = async () => {
    if (!detail || !newComment.trim()) return
    try {
      await supportApiRequest('/support/comments/', {
        method: 'POST',
        body: JSON.stringify({ ticket: detail.id, body: newComment.trim() }),
      })
      setNewComment('')
      const refreshed = await supportApiRequest<SupportTicket>(`/support/tickets/${detail.id}/`)
      setDetail(refreshed)
      await loadTickets()
      notify.success('Message ajoute')
    } catch (error) {
      notify.error('Envoi impossible', error instanceof Error ? error.message : undefined)
    }
  }

  const confirmDelete = async () => {
    if (!detail) return
    try {
      await supportApiRequest(`/support/tickets/${detail.id}/`, { method: 'DELETE' })
      setDeleteOpen(false)
      setDetailOpen(false)
      setDetail(null)
      await loadTickets()
      notify.success('Ticket supprime')
    } catch (error) {
      notify.error('Suppression impossible', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 overflow-hidden p-3 md:gap-4 md:p-6">
      <SupportSubnav />

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 border-b border-border/50 px-6 pb-4 pt-6">
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Tickets support</CardTitle>
            <Button onClick={openCreate}>Nouveau ticket</Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 pb-6 pt-4">
          <div className="grid shrink-0 gap-2 md:grid-cols-2 xl:grid-cols-5">
            <Input
              placeholder="Rechercher (ref, titre, texte...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <SearchableSelect
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
              options={[{ value: '', label: 'Tous les statuts' }, ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
              placeholder="Statut"
            />
            <SearchableSelect
              value={priorityFilter}
              onChange={(v) => {
                setPriorityFilter(v)
                setPage(1)
              }}
              options={[{ value: '', label: 'Toutes les priorites' }, ...PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
              placeholder="Priorite"
            />
            <SearchableSelect
              value={assigneeFilter}
              onChange={(v) => {
                setAssigneeFilter(v)
                setPage(1)
              }}
              options={assigneeSelectOptions}
              placeholder="Assigne"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={mineOnly} onChange={(e) => { setMineOnly(e.target.checked); setPage(1) }} />
              Mes tickets seulement
            </label>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {paged.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex w-full flex-col gap-2 rounded-lg border bg-card/40 p-3 text-left transition-colors hover:bg-accent/40 md:flex-row md:items-center md:justify-between"
                onClick={() => void openDetail(t.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.reference} — {t.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.requester_name}
                    {t.assignee_name ? ` • Assigne : ${t.assignee_name}` : ' • Non assigne'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant="outline">{SUPPORT_CATEGORY_LABEL[t.category]}</Badge>
                  <SupportPriorityBadge priority={t.priority} />
                  <SupportStatusBadge status={t.status} />
                  {typeof t.comments_count === 'number' ? (
                    <span className="text-xs text-muted-foreground">{t.comments_count} msg</span>
                  ) : null}
                </div>
              </button>
            ))}
            {!paged.length && <p className="text-sm text-muted-foreground">Aucun ticket.</p>}
          </div>
          <div className="shrink-0 border-t border-border/60 bg-card pt-3">
            <DataPagination
              className="mt-0"
              totalItems={totalItems}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau ticket</DialogTitle>
            <DialogDescription>Decrivez votre demande. Les membres de l equipe pourront suivre et repondre.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Titre</Label>
              <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={cDesc} onChange={(e) => setCDesc(e.target.value)} rows={4} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Categorie</Label>
                <SearchableSelect
                  value={cCategory}
                  onChange={(v) => setCCategory(v as SupportTicketCategory)}
                  options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="Categorie"
                />
              </div>
              <div>
                <Label>Priorite</Label>
                <SearchableSelect
                  value={cPriority}
                  onChange={(v) => setCPriority(v as SupportTicketPriority)}
                  options={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="Priorite"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void submitCreate()}>Creer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-left">{detail.reference}</DialogTitle>
                  <SupportStatusBadge status={dStatus} />
                  <SupportPriorityBadge priority={dPriority} />
                </div>
                <DialogDescription className="text-left">{detail.title}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label>Statut</Label>
                    <SearchableSelect
                      value={dStatus}
                      onChange={(v) => setDStatus(v as SupportTicketStatus)}
                      options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      placeholder="Statut"
                    />
                  </div>
                  <div>
                    <Label>Priorite</Label>
                    <SearchableSelect
                      value={dPriority}
                      onChange={(v) => setDPriority(v as SupportTicketPriority)}
                      options={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      placeholder="Priorite"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Assigne</Label>
                    <SearchableSelect
                      value={dAssignee}
                      onChange={setDAssignee}
                      options={assigneeFormOptions}
                      placeholder="Choisir un membre"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Demandeur : {detail.requester_name} • Cree le {new Date(detail.created_at).toLocaleString('fr-FR')}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{detail.description || '—'}</p>
                </div>
                <DialogFooter className={`gap-2 ${isCompanyAdmin ? 'sm:justify-between' : 'sm:justify-end'}`}>
                  {isCompanyAdmin ? (
                    <Button type="button" variant="destructive" className="sm:mr-auto" onClick={() => setDeleteOpen(true)}>
                      Supprimer le ticket
                    </Button>
                  ) : null}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDetailOpen(false)}>
                      Fermer
                    </Button>
                    <Button onClick={() => void saveDetail()}>Enregistrer</Button>
                  </div>
                </DialogFooter>
                <div className="border-t pt-4">
                  <p className="mb-2 text-sm font-medium">Conversation</p>
                  <div className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                    {(detail.comments || []).map((c) => (
                      <div key={c.id} className="rounded border bg-muted/30 p-2 text-sm">
                        <p className="text-xs text-muted-foreground">
                          {c.author_name} — {new Date(c.created_at).toLocaleString('fr-FR')}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                    {!(detail.comments || []).length && <p className="text-xs text-muted-foreground">Aucun message.</p>}
                  </div>
                  <Label>Ajouter un message</Label>
                  <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={3} className="mt-1" />
                  <Button type="button" className="mt-2" variant="secondary" onClick={() => void addComment()}>
                    Envoyer
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce ticket ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est reservee aux administrateurs et supprime definitivement le ticket et ses messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
