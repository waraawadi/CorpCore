import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  children?: ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      {Icon && (
        <div className="mb-6 p-4 rounded-full bg-muted">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      <h3 className="text-2xl font-semibold text-foreground mb-2 text-center">
        {title}
      </h3>

      {description && (
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          {description}
        </p>
      )}

      {action && (
        <Button
          onClick={action.onClick}
          className="mb-4"
        >
          {action.label}
        </Button>
      )}

      {children}
    </motion.div>
  )
}
