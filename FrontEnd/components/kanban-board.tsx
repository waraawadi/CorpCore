'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '@/lib/store'
import type { Task } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GripVertical, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface KanbanBoardProps {
  projectId: string
  onSelectTask?: (taskId: string) => void
  /** Ouvre le formulaire de création de tâche (ex. dialogue sur la page projet). */
  onCreateTaskRequest?: () => void
  className?: string
}

const COLUMN_IDS = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const

type ColumnId = (typeof COLUMN_IDS)[number]

function isColumnId(s: string): s is ColumnId {
  return (COLUMN_IDS as readonly string[]).includes(s)
}

const columnConfig: { id: ColumnId; title: string; dotClass: string }[] = [
  { id: 'backlog', title: 'Backlog', dotClass: 'bg-slate-400' },
  { id: 'todo', title: 'À faire', dotClass: 'bg-blue-500' },
  { id: 'in_progress', title: 'En cours', dotClass: 'bg-amber-500' },
  { id: 'review', title: 'Revue', dotClass: 'bg-purple-500' },
  { id: 'done', title: 'Terminé', dotClass: 'bg-emerald-500' },
]

type ItemsByColumn = Record<ColumnId, string[]>

function normalizeProjectKey(value: string): string {
  if (value.startsWith('proj-')) {
    return value.replace('proj-', '')
  }
  return value
}

function effectiveColumn(task: Task): ColumnId {
  const s = task.status as string
  return isColumnId(s) ? s : 'backlog'
}

function buildColumnMap(tasks: Task[]): ItemsByColumn {
  const map = {} as ItemsByColumn
  for (const id of COLUMN_IDS) {
    map[id] = []
  }
  for (const t of tasks) {
    const col = effectiveColumn(t)
    map[col].push(t.id)
  }
  for (const id of COLUMN_IDS) {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    map[id].sort((a, b) => {
      const ta = byId.get(a)
      const tb = byId.get(b)
      if (!ta || !tb) return 0
      return ta.order - tb.order || ta.title.localeCompare(tb.title)
    })
  }
  return map
}

function findContainer(id: UniqueIdentifier | undefined, items: ItemsByColumn): ColumnId | undefined {
  if (id == null) return undefined
  const s = String(id)
  if (s.startsWith('column-')) {
    const col = s.slice('column-'.length)
    if (isColumnId(col)) return col
  }
  for (const col of COLUMN_IDS) {
    if (items[col].includes(s)) return col
  }
  return undefined
}

function SortableTaskCard({
  task,
  onOpen,
}: {
  task: Task
  onOpen: (t: Task) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn('touch-none', isDragging && 'z-10 opacity-60')}>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onOpen(task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(task)
          }
        }}
        className="cursor-pointer gap-0 border-border/50 bg-background py-0 shadow-sm transition-shadow hover:bg-muted/50 hover:shadow-md"
      >
        <CardContent className="px-2 py-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              ref={setActivatorNodeRef}
              className="-ml-0.5 shrink-0 rounded p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Glisser la tâche"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3 w-3" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium leading-tight text-foreground">{task.title}</p>
              {task.dueDate ? (
                <span className="shrink-0 text-[10px] leading-none text-muted-foreground tabular-nums">
                  {format(new Date(task.dueDate), 'dd/MM/yy', { locale: fr })}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ColumnDropZone({ columnId, children }: { columnId: ColumnId; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${columnId}`,
    data: { type: 'column', columnId },
  })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[48px] flex-1 overflow-y-auto rounded-md transition-colors',
        isOver && 'bg-primary/5 ring-1 ring-primary/20'
      )}
    >
      {children}
    </div>
  )
}

export function KanbanBoard({ projectId, onSelectTask, onCreateTaskRequest, className }: KanbanBoardProps) {
  const tasks = useStore((s) => s.tasks)
  const getProjectTasks = useStore((s) => s.getProjectTasks)
  const reconcileKanbanColumns = useStore((s) => s.reconcileKanbanColumns)

  const projectKey = normalizeProjectKey(projectId)

  const projectTasks = useMemo(
    () => tasks.filter((t) => normalizeProjectKey(t.projectId) === projectKey),
    [tasks, projectKey]
  )

  const taskById = useMemo(() => new Map(projectTasks.map((t) => [t.id, t])), [projectTasks])

  const [items, setItems] = useState<ItemsByColumn>(() => buildColumnMap(projectTasks))
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const draggingRef = useRef(false)

  const syncKey = useMemo(
    () =>
      projectTasks
        .map((t) => `${t.id}:${t.status}:${t.order}`)
        .sort()
        .join('|'),
    [projectTasks]
  )

  useEffect(() => {
    if (draggingRef.current) return
    setItems(buildColumnMap(projectTasks))
  }, [syncKey, projectTasks])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const onDragStart = useCallback((event: DragStartEvent) => {
    draggingRef.current = true
    setActiveId(event.active.id)
  }, [])

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    const overId = over?.id
    if (overId == null || active.id == null) return

    setItems((prev) => {
      const overContainer = findContainer(overId, prev)
      const activeContainer = findContainer(active.id, prev)

      if (!overContainer || !activeContainer) return prev
      if (activeContainer === overContainer) return prev

      const activeItems = [...prev[activeContainer]]
      const overItems = [...prev[overContainer]]
      const activeIndex = activeItems.indexOf(String(active.id))
      if (activeIndex === -1) return prev

      const overIndex = overItems.indexOf(String(overId))
      let newIndex: number
      if (String(overId).startsWith('column-')) {
        newIndex = overItems.length + 1
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height
        const modifier = isBelowOverItem ? 1 : 0
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== String(active.id)),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          String(active.id),
          ...prev[overContainer].slice(newIndex, prev[overContainer].length),
        ],
      }
    })
  }, [])

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) {
        draggingRef.current = false
        setItems(buildColumnMap(getProjectTasks(projectId)))
        return
      }

      setItems((prev) => {
        const activeContainer = findContainer(active.id, prev)
        const overContainer = findContainer(over.id, prev)
        let next = prev

        if (activeContainer && overContainer && activeContainer === overContainer) {
          const activeIndex = prev[activeContainer].indexOf(String(active.id))
          const overIndex = prev[overContainer].indexOf(String(over.id))
          if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
            next = {
              ...prev,
              [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex),
            }
          }
        }

        queueMicrotask(() => {
          void reconcileKanbanColumns(projectId, next)
        })
        return next
      })

      draggingRef.current = false
    },
    [projectId, reconcileKanbanColumns, getProjectTasks]
  )

  const onDragCancel = useCallback(() => {
    setActiveId(null)
    draggingRef.current = false
    setItems(buildColumnMap(getProjectTasks(projectId)))
  }, [getProjectTasks, projectId])

  const activeTask = activeId ? taskById.get(String(activeId)) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', className)}>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto md:grid-cols-2 md:items-stretch xl:grid-cols-5">
          {columnConfig.map((column) => {
            const ids = items[column.id] ?? []
            const columnTasks = ids.map((id) => taskById.get(id)).filter(Boolean) as Task[]

            return (
              <div
                key={column.id}
                className="flex h-full min-h-0 min-w-[168px] flex-shrink-0 flex-col sm:min-w-[190px] md:min-w-0 md:flex-1"
              >
                <Card className="flex min-h-0 flex-1 flex-col gap-0 border-border/50 bg-muted/25 py-0 shadow-sm">
                  <CardHeader className="shrink-0 space-y-0 border-b border-border/60 px-3 py-2 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', column.dotClass)} />
                      <CardTitle className="text-xs font-semibold text-foreground">{column.title}</CardTitle>
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">{ids.length}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pb-2 pt-0">
                    <ColumnDropZone columnId={column.id}>
                      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                        <div className="space-y-0.5">
                          {columnTasks.map((task) => (
                            <SortableTaskCard key={task.id} task={task} onOpen={(t) => onSelectTask?.(t.id)} />
                          ))}
                        </div>
                      </SortableContext>
                    </ColumnDropZone>

                    <button
                      type="button"
                      onClick={() => onCreateTaskRequest?.()}
                      className="mt-1 flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter
                    </button>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <Card className="w-[min(92vw,280px)] cursor-grabbing gap-0 border-border/50 bg-background py-0 shadow-lg">
            <CardContent className="px-2 py-1">
              <div className="flex items-center gap-1">
                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs font-medium leading-tight">{activeTask.title}</p>
                  {activeTask.dueDate ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {format(new Date(activeTask.dueDate), 'dd/MM/yy', { locale: fr })}
                    </span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
