'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { fetchCrmActivities, type CrmActivity } from '../_lib/crm-api'
import { CrmActivitiesNavIcon } from '@/components/crm-animate-icons'
import { DataPagination } from '@/components/ui/data-pagination'

export default function CrmActivitiesPage() {
  const [rows, setRows] = useState<CrmActivity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchCrmActivities()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  )

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CrmActivitiesNavIcon className="text-primary" />
          <h1 className="text-xl font-semibold">Activités</h1>
        </div>
        <Link href="/dashboard/crm" className="text-sm text-muted-foreground hover:text-foreground">
          Retour CRM
        </Link>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Sujet</th>
              <th className="p-2 text-left font-medium">Type</th>
              <th className="p-2 text-left font-medium">Créée</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.subject}</td>
                <td className="p-2 capitalize text-muted-foreground">{a.activity_type}</td>
                <td className="p-2 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error && <p className="p-4 text-sm text-muted-foreground">Aucune activité.</p>}
      </div>
      {!!rows.length ? (
        <DataPagination
          totalItems={rows.length}
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
