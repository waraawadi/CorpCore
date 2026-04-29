'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { taskPriorityLabelFr, taskStatusLabelFr } from '@/lib/task-labels';
import { DataPagination } from '@/components/ui/data-pagination';

type TimelineViewProps = {
  projectId: string
  onSelectTask?: (taskId: string) => void
}

export function TimelineView({ projectId, onSelectTask }: TimelineViewProps) {
  const allTasks = useStore((state) => state.tasks);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const sortedTasks = useMemo(() => {
    const key = projectId.startsWith('proj-') ? projectId.replace('proj-', '') : projectId;
    return allTasks
      .filter((task) => {
        const taskKey = task.projectId.startsWith('proj-') ? task.projectId.replace('proj-', '') : task.projectId;
        return task.projectId === projectId || taskKey === key;
      })
      .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
  }, [allTasks, projectId]);
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const paginatedTasks = useMemo(
    () => sortedTasks.slice((page - 1) * pageSize, page * pageSize),
    [sortedTasks, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [projectId, sortedTasks.length]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-5 h-5 text-accent" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-primary" />;
      case 'review':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900';
      case 'medium':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900';
      case 'low':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-900';
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        {paginatedTasks.map((task, index) => (
        <div key={task.id} className="flex min-w-0 gap-3">
          {/* Timeline dot and line */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="rounded-full border border-border bg-card p-1.5">
              {getStatusIcon(task.status)}
            </div>
            {index < paginatedTasks.length - 1 && (
              <div className="h-8 w-1 bg-border" />
            )}
          </div>

          {/* Task content */}
          <div className="min-w-0 flex-1 pb-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectTask?.(task.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectTask?.(task.id)
                }
              }}
              className="rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-md"
            >
              <div className="mb-1 flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{task.title}</h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {task.description}
                  </p>
                </div>
                <span
                  className={cn(
                    'max-w-full shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    getPriorityColor(task.priority)
                  )}
                >
                  {taskPriorityLabelFr(task.priority)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Échéance :</span>
                  {task.dueDate ? format(new Date(task.dueDate), 'd MMM yyyy', { locale: fr }) : '-'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Statut :</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      task.status === 'done' && 'bg-accent/20 text-accent',
                      task.status === 'in_progress' && 'bg-primary/20 text-primary',
                      task.status === 'review' && 'bg-amber-500/20 text-amber-600',
                      task.status === 'todo' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {taskStatusLabelFr(task.status)}
                  </span>
                </div>
                {task.assignee && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Assigné :</span>
                    {task.assignee}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        ))}

        {sortedTasks.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p>Aucune tâche pour le moment. Créez-en une pour commencer.</p>
          </div>
        )}
      </div>
      {!!sortedTasks.length ? (
        <DataPagination
          totalItems={sortedTasks.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
