'use client'

import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface KPICardProps {
  title: string
  value: string | number
  change?: {
    value: number
    isPositive: boolean
  }
  icon?: LucideIcon
  trend?: ReactNode
  delay?: number
}

export function KPICard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  delay = 0,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4 }}
    >
      <Card className="p-6 border-border/50 backdrop-blur-sm hover:border-border transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {value}
              </p>
              {change && (
                <span
                  className={`text-sm font-semibold ${
                    change.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {change.isPositive ? '+' : '-'}
                  {Math.abs(change.value)}%
                </span>
              )}
            </div>
          </div>
          {Icon && (
            <div className="p-3 rounded-lg bg-primary/10">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          )}
        </div>
        {trend && <div className="mt-4">{trend}</div>}
      </Card>
    </motion.div>
  )
}
