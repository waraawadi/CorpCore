'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { DataPagination } from '@/components/ui/data-pagination';

type ZoomLevel = 'week' | 'month' | 'quarter';

type GanttChartProps = {
  projectId: string
  onSelectTask?: (taskId: string) => void
}

export function GanttChart({ projectId, onSelectTask }: GanttChartProps) {
  const allTasks = useStore((state) => state.tasks);
  const tasks = useMemo(() => {
    const key = projectId.startsWith('proj-') ? projectId.replace('proj-', '') : projectId;
    return allTasks
      .filter((task) => {
        const taskKey = task.projectId.startsWith('proj-') ? task.projectId.replace('proj-', '') : task.projectId;
        return task.projectId === projectId || taskKey === key;
      })
      .sort((a, b) => a.order - b.order);
  }, [allTasks, projectId]);
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [startDate, setStartDate] = useState(new Date());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const dayWidth = zoom === 'week' ? 40 : zoom === 'month' ? 14 : 7;
  const daysToShow = zoom === 'week' ? 42 : zoom === 'month' ? 120 : 360;
  const taskColumnWidth = zoom === 'week' ? 136 : 124;
  const timelineWidth = daysToShow * dayWidth;
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const paginatedTasks = useMemo(
    () => tasks.slice((page - 1) * pageSize, page * pageSize),
    [tasks, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [projectId, tasks.length]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const getTaskBarStyle = (task: any) => {
    const taskStart = task.startDate ? new Date(task.startDate) : (task.dueDate ? new Date(task.dueDate) : startDate);
    const daysFromStart = differenceInDays(taskStart, startDate);
    const duration = task.dueDate && task.startDate
      ? differenceInDays(new Date(task.dueDate), new Date(task.startDate))
      : 1;

    return {
      left: `${Math.max(0, daysFromStart * dayWidth)}px`,
      width: `${Math.max(dayWidth, duration * dayWidth)}px`,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-accent';
      case 'in_progress':
        return 'bg-primary';
      case 'review':
        return 'bg-amber-500';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      <div className="min-w-0 shrink-0 grid gap-2 xl:grid-cols-[auto_1fr_auto] xl:items-center">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => setStartDate(addDays(startDate, -daysToShow / 4))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => setStartDate(addDays(startDate, daysToShow / 4))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="min-w-0 truncate text-xs text-muted-foreground xl:text-center xl:text-sm">
          {format(startDate, 'd MMM yyyy', { locale: fr })} -{' '}
          {format(addDays(startDate, daysToShow), 'd MMM yyyy', { locale: fr })}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 xl:justify-end">
          <Button
            variant={zoom === 'week' ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-2 text-xs sm:text-sm"
            onClick={() => setZoom('week')}
          >
            Semaine
          </Button>
          <Button
            variant={zoom === 'month' ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-2 text-xs sm:text-sm"
            onClick={() => setZoom('month')}
          >
            Mois
          </Button>
          <Button
            variant={zoom === 'quarter' ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-2 text-xs sm:text-sm"
            onClick={() => setZoom('quarter')}
          >
            Trimestre
          </Button>
        </div>
      </div>

      <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <div className="h-full overflow-auto">
          <div className="w-max min-w-full">
          {/* Header with dates */}
          <div className="flex border-b border-border">
            <div
                className="sticky left-0 z-10 border-r border-border bg-card p-2 text-xs font-medium sm:text-sm"
              style={{ width: `${taskColumnWidth}px` }}
            >
              Tâche
            </div>
            <div className="flex" style={{ width: `${timelineWidth}px` }}>
              {Array.from({ length: daysToShow }).map((_, i) => {
                const date = addDays(startDate, i);
                const isWeekStart = zoom !== 'week' && date.getDay() === 1;

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-shrink-0 border-r border-border p-1 text-center text-[11px] text-muted-foreground',
                      isWeekStart && 'border-l-2 border-primary'
                    )}
                    style={{ width: `${dayWidth}px` }}
                  >
                    {zoom === 'month' && date.getDate() === 1 && (
                      <div className="font-medium text-foreground">
                        {format(date, 'MMM', { locale: fr })}
                      </div>
                    )}
                    {zoom === 'week' && format(date, 'd')}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task bars */}
          {paginatedTasks.map((task) => (
            <div
              key={task.id}
              className="flex cursor-pointer border-b border-border transition-colors hover:bg-muted/50"
              onClick={() => onSelectTask?.(task.id)}
            >
              <div
                className="sticky left-0 z-10 truncate border-r border-border bg-card p-2 text-xs font-medium sm:text-sm"
                style={{ width: `${taskColumnWidth}px` }}
              >
                {task.title}
              </div>
              <div
                className="relative flex-shrink-0 bg-muted/30"
                style={{ width: `${timelineWidth}px`, minHeight: '36px' }}
              >
                <div
                  className={cn(
                    'absolute top-1 bottom-1 rounded transition-all',
                    getStatusColor(task.status)
                  )}
                  style={getTaskBarStyle(task)}
                  title={task.title}
                />
              </div>
            </div>
          ))}
          {!tasks.length ? (
            <div className="p-6 text-sm text-muted-foreground">Aucune tâche à afficher pour ce projet.</div>
          ) : null}
          </div>
        </div>
      </div>
      {!!tasks.length ? (
        <DataPagination
          totalItems={tasks.length}
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
