'use client';

import React, { useMemo, useState } from 'react';
import { format, startOfDay, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  X,
  MessageSquare,
  Paperclip,
  Clock,
  User,
  Plus,
  Download,
  History,
  ListTodo,
  Eye,
  Trash2,
  Pencil,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStore } from '@/lib/store';
import {
  taskDateInputBounds,
  validateTaskDatesAgainstProject,
  taskDateValidationMessage,
} from '@/lib/project-dates';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { getApiBaseUrl, formatApiErrorBody } from '@/lib/api';
import { FilePreviewDialog, type PreviewableFile } from '@/components/file-preview-dialog';

interface TaskPanelProps {
  taskId: string | null;
  projectId: string;
  onClose: () => void;
}

type HistoryFilter = 'today' | '7d' | 'all';
type HistorySortOrder = 'desc' | 'asc';
type TaskDialog = 'details' | 'subtasks' | 'comments' | 'attachments' | null;
type InlineDeleteTarget =
  | { kind: 'subtask'; id: string; label: string }
  | { kind: 'comment'; id: string; label: string }
  | { kind: 'attachment'; id: string; label: string }
  | null;

type GedDocOption = {
  id: string
  title: string
  original_filename: string
  mime_type: string
}

const API_BASE = getApiBaseUrl()
const ACCESS_TOKEN_KEY = 'corpcore_access_token'

const STATUS_OPTIONS: { id: Task['status']; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'À faire' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'review', label: 'Revue' },
  { id: 'done', label: 'Terminé' },
];

const PRIORITY_OPTIONS: { id: Task['priority']; label: string }[] = [
  { id: 'low', label: 'Basse' },
  { id: 'medium', label: 'Moyenne' },
  { id: 'high', label: 'Haute' },
  { id: 'urgent', label: 'Urgente' },
];

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function normProjectRouteKey(value: string): string {
  return value.startsWith('proj-') ? value.replace('proj-', '') : value;
}

export function TaskPanel({ taskId, projectId, onClose }: TaskPanelProps) {
  const {
    getProjectTasks,
    projects,
    authUser,
    updateTaskStatus,
    updateTaskPriority,
    createSubtask,
    toggleSubtask,
    updateSubtask,
    deleteSubtask,
    addTaskComment,
    updateTaskComment,
    deleteTaskComment,
    addTaskAttachment,
    addTaskAttachmentFromGed,
    uploadTaskAttachment,
    deleteTaskAttachment,
    patchTask,
    deleteTask,
    taskTimeEntries,
    loadTaskTimeEntries,
    startTaskTimer,
    stopTaskTimer,
  } = useStore();
  const task = getProjectTasks(projectId).find((t) => t.id === taskId);
  const project = projects.find(
    (p) => p.id === projectId || normProjectRouteKey(p.id) === normProjectRouteKey(projectId)
  );
  const dateBounds = useMemo(
    () =>
      taskDateInputBounds(
        (project?.startDate ?? '').slice(0, 10),
        (project?.endDate ?? '').slice(0, 10)
      ),
    [project?.startDate, project?.endDate]
  );

  const [comment, setComment] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [attachName, setAttachName] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [attachMode, setAttachMode] = useState<'link' | 'upload' | 'ged'>('upload');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [gedDocs, setGedDocs] = useState<GedDocOption[]>([]);
  const [gedLoading, setGedLoading] = useState(false);
  const [selectedGedDocId, setSelectedGedDocId] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [subtaskSubmitting, setSubtaskSubmitting] = useState(false);
  const [attachSubmitting, setAttachSubmitting] = useState(false);
  const [timerActionLoading, setTimerActionLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historySortOrder, setHistorySortOrder] = useState<HistorySortOrder>('desc');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState<TaskDialog>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editDialogSaving, setEditDialogSaving] = useState(false);
  const [startDraft, setStartDraft] = useState('');
  const [dueDraft, setDueDraft] = useState('');
  const [dateFieldError, setDateFieldError] = useState('');
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [deleteTaskLoading, setDeleteTaskLoading] = useState(false);
  const [subtaskEditingId, setSubtaskEditingId] = useState<string | null>(null);
  const [subtaskEditTitle, setSubtaskEditTitle] = useState('');
  const [subtaskEditSaving, setSubtaskEditSaving] = useState(false);
  const [commentEditingId, setCommentEditingId] = useState<string | null>(null);
  const [commentEditText, setCommentEditText] = useState('');
  const [commentEditSaving, setCommentEditSaving] = useState(false);
  const [inlineDeleteTarget, setInlineDeleteTarget] = useState<InlineDeleteTarget>(null);
  const [inlineDeleteLoading, setInlineDeleteLoading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<PreviewableFile | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const gedDocOptions = useMemo<SearchableOption[]>(
    () =>
      gedDocs.map((d) => ({
        value: d.id,
        label: d.title || d.original_filename || d.id,
        keywords: d.original_filename,
      })),
    [gedDocs]
  );

  const currentTaskId = task?.id ?? null;
  const entries = currentTaskId ? (taskTimeEntries[currentTaskId] ?? []) : [];
  const runningEntry = entries.find((entry) => !entry.endedAt) ?? null;
  const getEntrySeconds = (entry: (typeof entries)[number]) => {
    if (entry.endedAt) {
      return Number(entry.secondsSpent || 0);
    }
    const startedAtMs = new Date(entry.startedAt).getTime();
    return Math.max(Math.floor((nowTick - startedAtMs) / 1000), 0);
  };
  const trackedSeconds = useMemo(() => {
    return entries.reduce((sum, entry) => sum + getEntrySeconds(entry), 0);
  }, [entries, runningEntry, nowTick]);

  const filteredEntries = useMemo(() => {
    if (historyFilter === 'all') return entries;
    const now = new Date();
    if (historyFilter === 'today') {
      const start = startOfDay(now);
      return entries.filter((e) => new Date(e.startedAt) >= start);
    }
    const start7 = startOfDay(subDays(now, 6));
    return entries.filter((e) => new Date(e.startedAt) >= start7);
  }, [entries, historyFilter]);

  const groupedEntries = useMemo(() => {
    const cmp = (a: (typeof entries)[number], b: (typeof entries)[number]) => {
      const ta = new Date(a.startedAt).getTime();
      const tb = new Date(b.startedAt).getTime();
      return historySortOrder === 'desc' ? tb - ta : ta - tb;
    };
    const groups = new Map<string, typeof entries>();
    const ordered = [...filteredEntries].sort(cmp);
    ordered.forEach((entry) => {
      const dayKey = format(new Date(entry.startedAt), 'yyyy-MM-dd');
      const current = groups.get(dayKey) ?? [];
      current.push(entry);
      groups.set(dayKey, current);
    });
    const list = Array.from(groups.entries()).map(([dayKey, dayEntries]) => {
      const sortedDay = [...dayEntries].sort(cmp);
      return {
        dayKey,
        label: format(new Date(dayKey), 'd MMM yyyy', { locale: fr }),
        totalSeconds: sortedDay.reduce((sum, entry) => sum + getEntrySeconds(entry), 0),
        entries: sortedDay,
      };
    });
    list.sort((a, b) =>
      historySortOrder === 'desc' ? b.dayKey.localeCompare(a.dayKey) : a.dayKey.localeCompare(b.dayKey)
    );
    return list;
  }, [filteredEntries, nowTick, historySortOrder]);

  React.useEffect(() => {
    if (!currentTaskId) return;
    loadTaskTimeEntries(currentTaskId).catch(() => undefined);
  }, [loadTaskTimeEntries, currentTaskId]);

  React.useEffect(() => {
    if (!runningEntry) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningEntry]);

  React.useEffect(() => {
    if (!task) return;
    setStartDraft(task.startDate ?? '');
    setDueDraft(task.dueDate ?? '');
    setDateFieldError('');
  }, [task?.id, task?.startDate, task?.dueDate]);

  const taskApiRequest = React.useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
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
    },
    []
  )

  React.useEffect(() => {
    if (taskDialog !== 'attachments') return
    let cancelled = false
    const run = async () => {
      setGedLoading(true)
      try {
        const docs = await taskApiRequest<GedDocOption[]>('/ged/documents/')
        if (!cancelled) setGedDocs(docs)
      } catch {
        if (!cancelled) setGedDocs([])
      } finally {
        if (!cancelled) setGedLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [taskDialog, taskApiRequest])

  const openEditDialog = () => {
    if (!task) return;
    setTitleDraft(task.title ?? '');
    setDescriptionDraft(task.description ?? '');
    setStartDraft(task.startDate ?? '');
    setDueDraft(task.dueDate ?? '');
    setDateFieldError('');
    setTaskDialog('details');
  };

  const handleSaveTaskEdit = async () => {
    if (!task) return;
    const name = titleDraft.trim();
    if (!name) return;
    const ps = (project?.startDate ?? '').slice(0, 10);
    const pe = (project?.endDate ?? '').slice(0, 10);
    const issue = validateTaskDatesAgainstProject(
      ps,
      pe,
      startDraft.trim() || undefined,
      dueDraft.trim() || undefined
    );
    if (issue) {
      setDateFieldError(taskDateValidationMessage(issue));
      return;
    }
    setDateFieldError('');
    setEditDialogSaving(true);
    const ok = await patchTask(task.id, {
      title: name,
      description: descriptionDraft,
      startDate: startDraft.trim() === '' ? null : startDraft.trim(),
      dueDate: dueDraft.trim() === '' ? null : dueDraft.trim(),
    });
    setEditDialogSaving(false);
    if (ok) {
      setTaskDialog(null);
    } else {
      setStartDraft(task.startDate ?? '');
      setDueDraft(task.dueDate ?? '');
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!task) return;
    setDeleteTaskLoading(true);
    const ok = await deleteTask(task.id);
    setDeleteTaskLoading(false);
    if (ok) {
      setDeleteTaskOpen(false);
      onClose();
    }
  };

  const handleConfirmInlineDelete = async () => {
    if (!inlineDeleteTarget || !task) return;
    setInlineDeleteLoading(true);
    if (inlineDeleteTarget.kind === 'subtask') {
      await deleteSubtask(task.id, inlineDeleteTarget.id);
    } else if (inlineDeleteTarget.kind === 'comment') {
      await deleteTaskComment(task.id, inlineDeleteTarget.id);
    } else {
      await deleteTaskAttachment(task.id, inlineDeleteTarget.id);
    }
    setInlineDeleteLoading(false);
    setInlineDeleteTarget(null);
  };

  if (!task) return null;

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleAssigneeChange = async (value: string) => {
    if (!task) return
    const assigneeId = value ? Number(value) : null
    await patchTask(task.id, { assigneeId })
  }

  const handleAddSubtask = async () => {
    if (!task || !subtaskTitle.trim()) return;
    setSubtaskSubmitting(true);
    const ok = await createSubtask(task.id, subtaskTitle);
    setSubtaskSubmitting(false);
    if (ok) {
      setSubtaskTitle('');
    }
  };

  const handleAddComment = async () => {
    if (!task || !comment.trim()) return;
    setCommentSubmitting(true);
    const ok = await addTaskComment(task.id, comment);
    setCommentSubmitting(false);
    if (ok) {
      setComment('');
    }
  };

  const handleAddAttachment = async () => {
    if (!task) return;
    setAttachSubmitting(true);
    let ok = false
    if (attachMode === 'upload') {
      ok = await uploadTaskAttachment(task.id, attachFile as File, attachName)
    } else if (attachMode === 'ged') {
      ok = await addTaskAttachmentFromGed(task.id, selectedGedDocId, attachName)
    } else {
      const fallbackName = attachUrl.split('/').pop() || 'fichier-lien'
      ok = await addTaskAttachment(task.id, { name: attachName.trim() || fallbackName, url: attachUrl });
    }
    setAttachSubmitting(false);
    if (ok) {
      setAttachName('');
      setAttachUrl('');
      setAttachFile(null);
      setSelectedGedDocId('');
    }
  };

  const handleToggleTimer = async () => {
    if (!task) return;
    setTimerActionLoading(true);
    const ok = runningEntry
      ? await stopTaskTimer(task.id)
      : await startTaskTimer(task.id, 'Suivi du temps depuis le panneau tâche');
    setTimerActionLoading(false);
    if (ok) {
      setNowTick(Date.now());
    }
  };

  const handleExportTimeCsv = () => {
    if (!task) return;
    const sorted = [...filteredEntries].sort((a, b) => {
      const ta = new Date(a.startedAt).getTime();
      const tb = new Date(b.startedAt).getTime();
      return historySortOrder === 'desc' ? tb - ta : ta - tb;
    });
    const header = ['Tache', 'ID session', 'Debut', 'Fin', 'Secondes', 'Duree', 'Note'].map(escapeCsvCell).join(',');
    const lines = [header];
    for (const entry of sorted) {
      const secs = getEntrySeconds(entry);
      const row = [
        task.title,
        entry.id,
        entry.startedAt,
        entry.endedAt ?? '',
        String(secs),
        formatTime(secs),
        entry.note ?? '',
      ].map((v) => escapeCsvCell(String(v)));
      lines.push(row.join(','));
    }
    const filterLabel =
      historyFilter === 'today' ? 'aujourdhui' : historyFilter === '7d' ? '7j' : 'tout';
    const safeTitle = task.title.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'tache';
    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temps-${safeTitle}-${filterLabel}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAttachmentPreview = (attachment: { id: string; name: string; type?: string; source?: 'upload' | 'ged' | 'link'; url?: string }) => {
    setPreviewAttachment({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.type || '',
      source: attachment.source,
      url: attachment.url,
    })
    setPreviewOpen(true)
  }

  const fetchAttachmentPreviewUrl = React.useCallback(
    async (attachmentId: string) => {
      const data = await taskApiRequest<{ url: string }>(`/task-attachments/${attachmentId}/preview-url/`)
      return data.url
    },
    [taskApiRequest]
  )

  const fetchAttachmentOnlyofficeConfig = React.useCallback(
    async (attachmentId: string) => {
      return taskApiRequest<{ documentServerUrl: string; token: string; config?: Record<string, unknown> }>(
        `/task-attachments/${attachmentId}/onlyoffice-config/`
      )
    },
    [taskApiRequest]
  )

  const subCount = task.subtasks.length;
  const commentCount = task.comments.length;
  const attachCount = task.attachments.length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-black/50 md:relative md:inset-auto md:h-full md:min-h-0 md:bg-transparent md:border-l md:border-border">
      <div className="flex-1 bg-card overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-lg truncate flex-1">{task.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openEditDialog}
              aria-label="Modifier la tâche"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTaskOpen(true)}
              aria-label="Supprimer la tâche"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Statut & priorité — disposition claire */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Statut
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateTaskStatus(projectId, task.id, opt.id)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      task.status === opt.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-transparent bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px bg-border" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Priorité
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateTaskPriority(projectId, task.id, opt.id)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      task.priority === opt.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-transparent bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 text-sm">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-muted-foreground">Assigné à</span>
                <p className="font-medium">{task.assignee || 'Non assigné'}</p>
                <select
                  className="mt-2 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                  value={task.assigneeId != null ? String(task.assigneeId) : ''}
                  onChange={(e) => {
                    void handleAssigneeChange(e.target.value)
                  }}
                >
                  <option value="">Non assigné</option>
                  {(project?.team ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-muted-foreground">Échéance</span>
                <p className="font-medium">
                  {task.dueDate
                    ? format(new Date(task.dueDate), 'd MMM yyyy', { locale: fr })
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Accès rapides : sous-tâches, commentaires, pièces jointes (colonne) */}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-between py-2.5 px-3"
              onClick={() => setTaskDialog('subtasks')}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ListTodo className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-medium">Sous-tâches</span>
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{subCount}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-between py-2.5 px-3"
              onClick={() => setTaskDialog('comments')}
            >
              <span className="flex min-w-0 items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-medium">Commentaires</span>
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{commentCount}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-between py-2.5 px-3"
              onClick={() => setTaskDialog('attachments')}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-medium">Pièces jointes</span>
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{attachCount}</span>
            </Button>
          </div>

          {/* Chronomètre */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chronomètre</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="font-mono text-2xl font-semibold tabular-nums">{formatTime(trackedSeconds)}</div>
              <Button
                size="sm"
                variant={runningEntry ? 'default' : 'outline'}
                onClick={handleToggleTimer}
                disabled={timerActionLoading}
              >
                {runningEntry ? 'Arrêter' : 'Démarrer'}
              </Button>
            </div>
            {runningEntry && (
              <p className="mt-2 text-xs text-muted-foreground">
                Session active depuis{' '}
                {format(new Date(runningEntry.startedAt), "d MMM yyyy à HH:mm", { locale: fr })}
              </p>
            )}
          </div>

          {/* Historique : accès compact (détail dans un dialogue) */}
          <div className="rounded-lg border border-border/80 bg-muted/15 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Historique des sessions
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {filteredEntries.length === 0
                    ? 'Aucune session'
                    : `${filteredEntries.length} session${filteredEntries.length > 1 ? 's' : ''}`}
                  {historyFilter !== 'all' && filteredEntries.length > 0 ? ' — période filtrée' : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full shrink-0 gap-2 sm:w-auto"
                onClick={() => setHistoryDialogOpen(true)}
              >
                <History className="h-4 w-4" />
                Voir l&apos;historique
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogue historique des sessions (filtres, tri, CSV, liste scrollable) */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent
          showCloseButton
          className="flex h-[min(88vh,720px)] w-[min(96vw,40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
            <DialogTitle>Historique des sessions</DialogTitle>
            <DialogDescription>
              Filtrez par période, triez chronologiquement et exportez au format CSV. La liste défile à
              l&apos;intérieur de cette fenêtre.
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 space-y-3 border-b border-border bg-muted/20 px-6 py-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Période</span>
              <div className="inline-flex flex-wrap rounded-md border border-border bg-background p-0.5 text-xs">
                {(
                  [
                    { id: 'today' as const, label: "Aujourd'hui" },
                    { id: '7d' as const, label: '7 jours' },
                    { id: 'all' as const, label: 'Tout' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setHistoryFilter(opt.id)}
                    className={cn(
                      'rounded px-2.5 py-1.5 font-medium transition-colors',
                      historyFilter === opt.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Ordre chronologique</span>
                <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistorySortOrder('desc')}
                    className={cn(
                      'rounded px-2.5 py-1.5 font-medium transition-colors',
                      historySortOrder === 'desc'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Plus récent
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistorySortOrder('asc')}
                    className={cn(
                      'rounded px-2.5 py-1.5 font-medium transition-colors',
                      historySortOrder === 'asc'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Plus ancien
                  </button>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportTimeCsv}
                disabled={!filteredEntries.length}
              >
                <Download className="h-4 w-4" />
                Exporter CSV
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {!groupedEntries.length && (
              <p className="text-sm text-muted-foreground">
                {entries.length > 0 && historyFilter !== 'all'
                  ? 'Aucune session pour cette période.'
                  : 'Aucune session enregistrée pour le moment.'}
              </p>
            )}
            <div className="space-y-3">
              {groupedEntries.map((group) => (
                <div key={group.dayKey} className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium">{group.label}</span>
                    <span>Total : {formatTime(group.totalSeconds)}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs"
                      >
                        <span>
                          {format(new Date(entry.startedAt), 'HH:mm')} –{' '}
                          {entry.endedAt ? format(new Date(entry.endedAt), 'HH:mm') : '…'}
                        </span>
                        <span className="font-medium tabular-nums">{formatTime(getEntrySeconds(entry))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Édition : nom, description et période (bornes projet) */}
      <Dialog
        open={taskDialog === 'details'}
        onOpenChange={(open) => {
          if (!open) {
            setTaskDialog(null);
            setDateFieldError('');
          }
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,720px)] flex-col overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
            <DialogDescription>
              Nom, description et dates de la tâche dans les limites du projet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-1">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom et description</p>
              <div className="space-y-1.5">
                <Label htmlFor="dialog-task-title">Nom</Label>
                <Input
                  id="dialog-task-title"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Nom de la tâche"
                  className="text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dialog-task-description">Description</Label>
                <Textarea
                  id="dialog-task-description"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Contexte, critères d’acceptation…"
                  rows={4}
                  className="min-h-[96px] resize-y text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Période de la tâche (projet)
                </p>
              </div>
              {project?.startDate && project?.endDate && (
                <p className="text-xs text-muted-foreground">
                  Bornes du projet :{' '}
                  {format(new Date(project.startDate), 'd MMM yyyy', { locale: fr })} —{' '}
                  {format(new Date(project.endDate), 'd MMM yyyy', { locale: fr })}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <DateTimeField
                  id="dialog-task-start"
                  label={<span className="text-xs">Début</span>}
                  value={startDraft}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={setStartDraft}
                />
                <DateTimeField
                  id="dialog-task-due"
                  label={<span className="text-xs">Échéance</span>}
                  value={dueDraft}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={setDueDraft}
                />
              </div>
              {dateFieldError && <p className="text-xs text-destructive">{dateFieldError}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setTaskDialog(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveTaskEdit()}
              disabled={editDialogSaving || !titleDraft.trim()}
            >
              {editDialogSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue sous-tâches */}
      <Dialog open={taskDialog === 'subtasks'} onOpenChange={(open) => !open && setTaskDialog(null)}>
        <DialogContent className="max-h-[min(90vh,720px)] flex flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sous-tâches</DialogTitle>
            <DialogDescription>
              Ajoutez des sous-tâches et cochez-les lorsqu’elles sont terminées.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Titre de la sous-tâche"
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleAddSubtask}
              disabled={!subtaskTitle.trim() || subtaskSubmitting}
              aria-label="Ajouter une sous-tâche"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {!task.subtasks.length && (
              <p className="text-sm text-muted-foreground">Aucune sous-tâche pour le moment.</p>
            )}
            {task.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <label className="mt-0.5 flex shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={(e) => {
                        toggleSubtask(task.id, subtask.id, e.target.checked).catch(() => undefined);
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                  </label>
                  {subtaskEditingId === subtask.id ? (
                    <Input
                      value={subtaskEditTitle}
                      onChange={(e) => setSubtaskEditTitle(e.target.value)}
                      className="h-8 flex-1 text-sm"
                    />
                  ) : (
                    <span
                      className={cn(
                        'min-w-0 flex-1 cursor-default text-sm leading-snug',
                        subtask.completed && 'text-muted-foreground line-through'
                      )}
                    >
                      {subtask.title}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {subtaskEditingId === subtask.id ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={subtaskEditSaving || !subtaskEditTitle.trim()}
                        onClick={async () => {
                          setSubtaskEditSaving(true);
                          const ok = await updateSubtask(task.id, subtask.id, {
                            title: subtaskEditTitle.trim(),
                          });
                          setSubtaskEditSaving(false);
                          if (ok) {
                            setSubtaskEditingId(null);
                            setSubtaskEditTitle('');
                          }
                        }}
                      >
                        OK
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSubtaskEditingId(null);
                          setSubtaskEditTitle('');
                        }}
                      >
                        Annuler
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Renommer"
                        onClick={() => {
                          setSubtaskEditingId(subtask.id);
                          setSubtaskEditTitle(subtask.title);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label="Supprimer la sous-tâche"
                        onClick={() =>
                          setInlineDeleteTarget({
                            kind: 'subtask',
                            id: subtask.id,
                            label: 'cette sous-tâche',
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogue commentaires */}
      <Dialog open={taskDialog === 'comments'} onOpenChange={(open) => !open && setTaskDialog(null)}>
        <DialogContent className="max-h-[min(90vh,720px)] flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Commentaires</DialogTitle>
            <DialogDescription>Échanges et notes sur cette tâche.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {!task.comments.length && (
              <p className="text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>
            )}
            {task.comments.map((c) => {
              const isMine = authUser != null && c.authorId === authUser.id;
              return (
                <div key={c.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-foreground">{c.author}</div>
                    {isMine && commentEditingId !== c.id && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label="Modifier le commentaire"
                          onClick={() => {
                            setCommentEditingId(c.id);
                            setCommentEditText(c.content);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Supprimer le commentaire"
                          onClick={() =>
                            setInlineDeleteTarget({
                              kind: 'comment',
                              id: c.id,
                              label: 'ce commentaire',
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.createdAt
                      ? format(new Date(c.createdAt), "d MMM yyyy 'à' HH:mm", { locale: fr })
                      : '—'}
                  </div>
                  {commentEditingId === c.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        className="min-h-[80px] text-sm"
                        value={commentEditText}
                        onChange={(e) => setCommentEditText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={commentEditSaving || !commentEditText.trim()}
                          onClick={async () => {
                            setCommentEditSaving(true);
                            const ok = await updateTaskComment(task.id, c.id, commentEditText);
                            setCommentEditSaving(false);
                            if (ok) {
                              setCommentEditingId(null);
                              setCommentEditText('');
                            }
                          }}
                        >
                          Enregistrer
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCommentEditingId(null);
                            setCommentEditText('');
                          }}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-foreground">{c.content}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-border pt-3">
            <Input
              placeholder="Écrire un commentaire…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleAddComment}
              disabled={!comment.trim() || commentSubmitting}
              aria-label="Envoyer le commentaire"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogue pièces jointes */}
      <Dialog open={taskDialog === 'attachments'} onOpenChange={(open) => !open && setTaskDialog(null)}>
        <DialogContent className="max-h-[min(90vh,720px)] flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pièces jointes</DialogTitle>
            <DialogDescription>
              Ajoutez un fichier par import direct, depuis la GED, ou via un lien externe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3">
            <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
              {(
                [
                  { id: 'upload' as const, label: 'Importer' },
                  { id: 'ged' as const, label: 'Depuis GED' },
                  { id: 'link' as const, label: 'Lien URL' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAttachMode(opt.id)}
                  className={cn(
                    'rounded px-2.5 py-1.5 font-medium transition-colors',
                    attachMode === opt.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attach-name">Nom du fichier</Label>
              <Input
                id="attach-name"
                placeholder="Nom optionnel (sinon nom source)"
                value={attachName}
                onChange={(e) => setAttachName(e.target.value)}
              />
            </div>
            {attachMode === 'upload' ? (
              <div className="space-y-1.5">
                <Label htmlFor="attach-file">Fichier</Label>
                <Input
                  id="attach-file"
                  type="file"
                  onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}
            {attachMode === 'ged' ? (
              <div className="space-y-1.5">
                <Label htmlFor="attach-ged">Document GED</Label>
                <SearchableSelect
                  value={selectedGedDocId}
                  onChange={setSelectedGedDocId}
                  options={gedDocOptions}
                  placeholder={gedLoading ? 'Chargement…' : 'Selectionner un document'}
                  emptyMessage="Aucun document GED"
                  disabled={gedLoading}
                />
              </div>
            ) : null}
            {attachMode === 'link' ? (
              <div className="space-y-1.5">
                <Label htmlFor="attach-url">URL du fichier</Label>
                <Input
                  id="attach-url"
                  type="url"
                  placeholder="https://…"
                  value={attachUrl}
                  onChange={(e) => setAttachUrl(e.target.value)}
                />
              </div>
            ) : null}
            <Button
              type="button"
              className="w-full"
              onClick={handleAddAttachment}
              disabled={
                attachSubmitting ||
                (attachMode === 'upload' && !attachFile) ||
                (attachMode === 'ged' && !selectedGedDocId) ||
                (attachMode === 'link' && !attachUrl.trim())
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter la pièce jointe
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {!task.attachments.length && (
              <p className="text-sm text-muted-foreground">Aucune pièce jointe pour le moment.</p>
            )}
            {task.attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(a.size)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Aperçu"
                    onClick={() => openAttachmentPreview(a)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Supprimer"
                    onClick={() =>
                      setInlineDeleteTarget({
                        kind: 'attachment',
                        id: a.id,
                        label: 'cette pièce jointe',
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={previewAttachment}
        fetchPreviewUrl={fetchAttachmentPreviewUrl}
        fetchOnlyofficeConfig={fetchAttachmentOnlyofficeConfig}
      />

      <AlertDialog open={deleteTaskOpen} onOpenChange={setDeleteTaskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>
              La tâche sera retirée du projet. Les données liées (sous-tâches, commentaires, pièces jointes, temps)
              seront supprimées ou conservées selon les règles du serveur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTaskLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteTask();
              }}
              disabled={deleteTaskLoading}
            >
              {deleteTaskLoading ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={inlineDeleteTarget !== null} onOpenChange={(open) => !open && setInlineDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {inlineDeleteTarget
                ? `Voulez-vous vraiment supprimer ${inlineDeleteTarget.label} ?`
                : 'Confirmez la suppression.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inlineDeleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmInlineDelete();
              }}
              disabled={inlineDeleteLoading}
            >
              {inlineDeleteLoading ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
