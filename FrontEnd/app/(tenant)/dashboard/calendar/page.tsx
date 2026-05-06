'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'

import { useStore } from '@/lib/store'
import { ProjectCalendarView } from '@/components/project-calendar-view'
import { TaskPanel } from '@/components/task-panel'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'

export default function CalendarPage() {
  const { projects, isHydrating } = useStore()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId('')
      return
    }
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
      setSelectedTaskId(null)
    }
  }, [projects, selectedProjectId])

  useEffect(() => {
    setSelectedTaskId(null)
  }, [selectedProjectId])

  const projectOptions = useMemo<SearchableOption[]>(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
        keywords: `${project.status} ${project.workTeamName || ''}`,
      })),
    [projects]
  )

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null

  if (!projects.length && isHydrating) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Chargement du calendrier...
      </div>
    )
  }

  if (!projects.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Aucun projet disponible pour le calendrier.
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-4 overflow-hidden p-4 md:p-8">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Calendrier des projets</h1>
        </div>
        <div className="w-full max-w-sm">
          <SearchableSelect
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projectOptions}
            placeholder="Selectionner un projet"
            emptyMessage="Aucun projet"
          />
        </div>
      </div>

      {!selectedProject ? null : (
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
            <ProjectCalendarView projectId={selectedProject.id} onSelectTask={setSelectedTaskId} />
          </div>
          {selectedTaskId ? (
            <div className="contents">
              <div className="md:hidden">
                <TaskPanel
                  taskId={selectedTaskId}
                  projectId={selectedProject.id}
                  onClose={() => setSelectedTaskId(null)}
                />
              </div>
              <div className="hidden h-full min-h-0 w-96 shrink-0 border-l border-border md:flex">
                <TaskPanel
                  taskId={selectedTaskId}
                  projectId={selectedProject.id}
                  onClose={() => setSelectedTaskId(null)}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
