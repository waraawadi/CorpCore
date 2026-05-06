'use client'

import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock3, Sparkles, CalendarCheck2, CircleDot } from 'lucide-react'

import { useStore } from '@/lib/store'
import type { Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { taskPriorityLabelFr, taskStatusLabelFr } from '@/lib/task-labels'

type ProjectCalendarViewProps = {
  projectId: string
  onSelectTask?: (taskId: string) => void
}

type CalendarMode = 'day' | 'week' | 'month'

type TaskRange = {
  task: Task
  start: Date
  end: Date
}

function normalizeProjectKey(value: string): string {
  return value.startsWith('proj-') ? value.replace('proj-', '') : value
}

function parseTaskRange(task: Task): TaskRange | null {
  const rawStart = (task.startDate || '').trim()
  const rawEnd = (task.dueDate || '').trim()
  if (!rawStart && !rawEnd) return null
  const start = rawStart ? parseISO(rawStart) : parseISO(rawEnd)
  const end = rawEnd ? parseISO(rawEnd) : parseISO(rawStart)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return {
    task,
    start: startOfDay(start <= end ? start : end),
    end: endOfDay(start <= end ? end : start),
  }
}

function statusClass(status: Task['status']): string {
  switch (status) {
    case 'done':
      return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'in_progress':
      return 'border border-primary/30 bg-primary/15 text-primary'
    case 'review':
      return 'border border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300'
    case 'todo':
      return 'border border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300'
    default:
      return 'border border-border/70 bg-muted text-muted-foreground'
  }
}

function statusDotClass(status: Task['status']): string {
  switch (status) {
    case 'done':
      return 'bg-emerald-500'
    case 'in_progress':
      return 'bg-primary'
    case 'review':
      return 'bg-purple-500'
    case 'todo':
      return 'bg-blue-500'
    default:
      return 'bg-slate-400'
  }
}

export function ProjectCalendarView({ projectId, onSelectTask }: ProjectCalendarViewProps) {
  const tasks = useStore((s) => s.tasks)
  const [mode, setMode] = useState<CalendarMode>('month')
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()))
  const [dayDialogOpen, setDayDialogOpen] = useState(false)

  const projectKey = normalizeProjectKey(projectId)
  const projectTasks = useMemo(
    () => tasks.filter((t) => normalizeProjectKey(t.projectId) === projectKey),
    [tasks, projectKey]
  )

  const taskRanges = useMemo(() => {
    return projectTasks
      .map(parseTaskRange)
      .filter((r): r is TaskRange => Boolean(r))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [projectTasks])

  const navigate = (direction: -1 | 1) => {
    if (mode === 'day') {
      setFocusDate((d) => addDays(d, direction))
      return
    }
    if (mode === 'week') {
      setFocusDate((d) => addWeeks(d, direction))
      return
    }
    setFocusDate((d) => addMonths(d, direction))
  }

  const currentMonth = startOfMonth(focusDate)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const monthDays = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd])
  const weekStart = startOfWeek(focusDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: 1 })
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskRange[]>()
    const allDays = mode === 'month' ? monthDays : mode === 'week' ? weekDays : [selectedDay]
    for (const day of allDays) {
      const key = format(day, 'yyyy-MM-dd')
      const entries = taskRanges.filter((entry) => day >= entry.start && day <= entry.end)
      map.set(key, entries)
    }
    return map
  }, [mode, monthDays, weekDays, selectedDay, taskRanges])

  const selectedEntries = tasksByDay.get(format(selectedDay, 'yyyy-MM-dd')) || []
  const visibleMonthTaskCount = useMemo(
    () =>
      taskRanges.filter(
        (entry) =>
          !(entry.end < startOfDay(monthStart)) &&
          !(entry.start > endOfDay(monthEnd))
      ).length,
    [taskRanges, monthStart, monthEnd]
  )

  const headerLabel = useMemo(() => {
    if (mode === 'day') return format(focusDate, "EEEE d MMMM yyyy", { locale: fr })
    if (mode === 'week') {
      return `${format(weekStart, 'd MMM', { locale: fr })} - ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`
    }
    return format(currentMonth, 'MMMM yyyy', { locale: fr })
  }, [mode, focusDate, weekStart, weekEnd, currentMonth])

  const monthTaskCount = visibleMonthTaskCount
  const weekTaskCount = useMemo(() => {
    return taskRanges.filter((entry) => !(entry.end < startOfDay(weekStart)) && !(entry.start > endOfDay(weekEnd))).length
  }, [taskRanges, weekStart, weekEnd])
  const dayTaskCount = useMemo(
    () => taskRanges.filter((entry) => focusDate >= entry.start && focusDate <= entry.end).length,
    [taskRanges, focusDate]
  )

  const activeRangeTaskCount = mode === 'day' ? dayTaskCount : mode === 'week' ? weekTaskCount : monthTaskCount

  const displayedDayEntries =
    mode === 'day'
      ? taskRanges.filter((entry) => focusDate >= entry.start && focusDate <= entry.end)
      : selectedEntries

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-3 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                const today = startOfDay(new Date())
                setFocusDate(today)
                setSelectedDay(today)
              }}
            >
              Aujourd&apos;hui
            </Button>
          </div>
          <div className="inline-flex w-full rounded-full border border-border/70 bg-background/70 p-0.5 text-xs sm:w-auto">
            {(
              [
                { id: 'day' as const, label: 'Jour' },
                { id: 'week' as const, label: 'Semaine' },
                { id: 'month' as const, label: 'Mois' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={cn(
                  'flex-1 rounded-full px-2.5 py-1 font-medium transition-colors sm:flex-none',
                  mode === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
          <p className="text-sm font-semibold capitalize">{headerLabel}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <Sparkles className="h-3 w-3" />
            {activeRangeTaskCount} tâche{activeRangeTaskCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {(mode === 'month' || mode === 'week') && (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="grid grid-cols-7 gap-1 px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label) => (
              <div key={label} className="rounded-md bg-muted/30 py-1">
                {label}
              </div>
            ))}
          </div>

          <div
            className={cn(
              'grid min-h-0 flex-1 grid-cols-7 gap-1 overflow-auto rounded-2xl border border-border/60 bg-background/70 p-1.5 pb-3 shadow-inner'
            )}
            style={mode === 'week' ? { gridTemplateRows: 'minmax(0, 1fr)' } : undefined}
          >
            {(mode === 'month' ? monthDays : weekDays).map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const entries = tasksByDay.get(key) || []
              const visibleLimit = mode === 'week' ? 8 : 3
              const overflow = Math.max(0, entries.length - visibleLimit)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDay(startOfDay(day))
                    setDayDialogOpen(true)
                  }}
                  className={cn(
                    'flex h-auto min-h-[96px] flex-col justify-start rounded-xl border border-border/50 bg-card/80 p-1.5 text-left align-top shadow-sm transition-all hover:-translate-y-[1px] hover:bg-card hover:shadow-md',
                    mode === 'week' && 'h-full min-h-[180px] sm:min-h-[220px]',
                    mode === 'month' && !isSameMonth(day, currentMonth) && 'bg-muted/25 opacity-55',
                    isSameDay(day, selectedDay) && 'border-primary bg-primary/5 ring-1 ring-primary/25'
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn('text-xs font-semibold', isSameDay(day, startOfDay(new Date())) && 'text-primary')}>
                      {mode === 'week' ? format(day, 'EEE d', { locale: fr }) : format(day, 'd')}
                    </span>
                    {entries.length > 0 ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {entries.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {entries.slice(0, visibleLimit).map((entry) => (
                      <div
                        key={`${entry.task.id}-${key}`}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectTask?.(entry.task.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            onSelectTask?.(entry.task.id)
                          }
                        }}
                        className={cn('truncate rounded px-1.5 py-0.5 text-[11px] font-medium', statusClass(entry.task.status))}
                        title={entry.task.title}
                      >
                        {entry.task.title}
                      </div>
                    ))}
                    {entries.length > 0 ? (
                      <div className="mt-1 flex items-center gap-1">
                        {Array.from(new Set(entries.slice(0, 4).map((entry) => entry.task.status))).map((status) => (
                          <span key={status} className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(status))} />
                        ))}
                      </div>
                    ) : null}
                    {overflow > 0 ? <div className="text-[11px] text-muted-foreground">+{overflow} autre(s)</div> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'day' && (
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/60 bg-background/70 p-3 shadow-inner">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold capitalize">{format(focusDate, "EEEE d MMMM yyyy", { locale: fr })}</h3>
            <span className="text-xs text-muted-foreground">
              {dayTaskCount} tâche{dayTaskCount > 1 ? 's' : ''}
            </span>
          </div>
          {!dayTaskCount ? (
            <p className="text-sm text-muted-foreground">Aucune tâche planifiée ce jour.</p>
          ) : (
            <div className="space-y-2">
              {displayedDayEntries.map((entry) => (
                <button
                  key={`${entry.task.id}-day-detail`}
                  type="button"
                  onClick={() => onSelectTask?.(entry.task.id)}
                  className="group flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/80 px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-[1px] hover:border-primary/40 hover:bg-card hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-primary">{entry.task.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CircleDot className={cn('h-3.5 w-3.5', statusDotClass(entry.task.status))} />
                      {taskStatusLabelFr(entry.task.status)} - {taskPriorityLabelFr(entry.task.priority)}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>
                      {format(entry.start, 'dd/MM')} - {format(entry.end, 'dd/MM')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-h-[82vh] max-w-[calc(100%-1rem)] overflow-y-auto border-border/60 bg-gradient-to-b from-card via-card to-background p-0 sm:max-w-2xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 capitalize text-base">
                  <CalendarCheck2 className="h-4 w-4 text-primary" />
                  {format(selectedDay, "EEEE d MMMM yyyy", { locale: fr })}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  {selectedEntries.length} tâche{selectedEntries.length > 1 ? 's' : ''} planifiée
                  {selectedEntries.length > 1 ? 's' : ''} ce jour.
                </DialogDescription>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                Focus jour
              </span>
            </div>
          </DialogHeader>
          {!selectedEntries.length ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucune tâche planifiée ce jour.</p>
            </div>
          ) : (
            <div className="space-y-3 px-5 py-4">
              {selectedEntries.map((entry) => (
                <button
                  key={`${entry.task.id}-detail`}
                  type="button"
                  onClick={() => {
                    onSelectTask?.(entry.task.id)
                    setDayDialogOpen(false)
                  }}
                  className="group flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/80 px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-[1px] hover:border-primary/40 hover:bg-card hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-primary">{entry.task.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CircleDot className={cn('h-3.5 w-3.5', statusDotClass(entry.task.status))} />
                      {taskStatusLabelFr(entry.task.status)} - {taskPriorityLabelFr(entry.task.priority)}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>
                      {format(entry.start, 'dd/MM')} - {format(entry.end, 'dd/MM')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
