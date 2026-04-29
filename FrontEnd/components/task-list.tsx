'use client'

import type { Task } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { taskPriorityLabelFr, taskStatusLabelFr } from '@/lib/task-labels'
import { DataPagination } from '@/components/ui/data-pagination'

interface TaskListProps {
  projectId: string
  onSelectTask?: (taskId: string) => void
}

const priorityIcons = {
  low: <Circle className="w-4 h-4 text-blue-500" />,
  medium: <Clock className="w-4 h-4 text-amber-500" />,
  high: <AlertCircle className="w-4 h-4 text-orange-500" />,
  urgent: <AlertCircle className="w-4 h-4 text-red-500" />,
}

const statusIcons = {
  backlog: <Circle className="w-5 h-5 text-slate-400" />,
  todo: <Circle className="w-5 h-5 text-blue-400" />,
  in_progress: <Clock className="w-5 h-5 text-amber-400" />,
  review: <AlertCircle className="w-5 h-5 text-purple-400" />,
  done: <CheckCircle2 className="w-5 h-5 text-green-500" />,
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export function TaskList({ projectId, onSelectTask }: TaskListProps) {
  const { getProjectTasks } = useStore()
  const tasks = getProjectTasks(projectId)
  const [sortBy, setSortBy] = useState<'status' | 'priority' | 'dueDate'>('status')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'status') {
      const statusOrder = { backlog: 0, todo: 1, in_progress: 2, review: 3, done: 4 }
      return (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0)
    }
    if (sortBy === 'priority') {
      const priorityOrder = { low: 4, medium: 3, high: 2, urgent: 1 }
      return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99)
    }
    if (sortBy === 'dueDate') {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
    return 0
  })
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize))
  const paginatedTasks = useMemo(
    () => sortedTasks.slice((page - 1) * pageSize, page * pageSize),
    [sortedTasks, page, pageSize]
  )

  useEffect(() => {
    setPage(1)
  }, [sortBy, tasks.length])

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Sort Controls */}
      <div className="flex gap-2 flex-wrap">
        {(['status', 'priority', 'dueDate'] as const).map((sort) => (
          <button
            key={sort}
            onClick={() => setSortBy(sort)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              sortBy === sort
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {sort === 'status'
              ? 'Statut'
              : sort === 'priority'
                ? 'Priorité'
                : 'Échéance'}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-border/50">
        <div className="h-full overflow-auto">
          <table className="w-full min-w-0 text-sm">
          <thead className="bg-muted/50 border-b border-border/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Tâche</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground hidden md:table-cell">Statut</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground hidden lg:table-cell">Priorité</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground hidden lg:table-cell">Assigné</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground hidden xl:table-cell">Échéance</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground hidden xl:table-cell">Heures</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paginatedTasks.map((task, index) => (
              <motion.tr
                key={task.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectTask?.(task.id)}
                className="hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                {/* Task Name */}
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {statusIcons[task.status as keyof typeof statusIcons]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium text-foreground transition-colors group-hover:text-primary">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs font-medium text-muted-foreground">
                    {taskStatusLabelFr(task.status)}
                  </span>
                </td>

                {/* Priority */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  <Badge
                    className={priorityColors[task.priority as keyof typeof priorityColors]}
                    variant="outline"
                  >
                    {taskPriorityLabelFr(task.priority)}
                  </Badge>
                </td>

                {/* Assignee */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-semibold">
                        {task.assigneeAvatar}
                      </div>
                      <span className="text-xs text-muted-foreground">{task.assignee}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Non assigné</span>
                  )}
                </td>

                {/* Due Date */}
                <td className="px-4 py-3 hidden xl:table-cell">
                  {task.dueDate ? (
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>

                {/* Hours */}
                <td className="px-4 py-3 hidden xl:table-cell">
                  {task.estimatedHours && (
                    <span className="text-xs text-muted-foreground">
                      {task.actualHours || 0} / {task.estimatedHours}h
                    </span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {tasks.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Aucune tâche pour l’instant. Créez-en une pour commencer.</p>
          </CardContent>
        </Card>
      )}
      {!!tasks.length ? (
        <DataPagination
          totalItems={sortedTasks.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      ) : null}
    </div>
  )
}
