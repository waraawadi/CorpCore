'use client'

import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

type DataPaginationProps = {
  totalItems: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function DataPagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DataPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(totalItems, page * pageSize)

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
      <p className="text-xs text-muted-foreground">
        {start}-{end} sur {totalItems}
      </p>

      <div className="flex items-center gap-1">
        {[10, 20, 50].map((size) => (
          <Button
            key={size}
            type="button"
            size="sm"
            variant={pageSize === size ? 'default' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => onPageSizeChange(size)}
          >
            {size}
          </Button>
        ))}
      </div>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              onClick={(e) => {
                e.preventDefault()
                if (page > 1) onPageChange(page - 1)
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-2 text-xs text-muted-foreground">
              {page}/{totalPages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
              onClick={(e) => {
                e.preventDefault()
                if (page < totalPages) onPageChange(page + 1)
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
