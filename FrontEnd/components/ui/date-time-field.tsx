'use client'

import * as React from 'react'
import { CalendarDays, Clock3, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type DateTimeMode = 'date' | 'time' | 'datetime-local'

type DateTimeFieldProps = {
  label: React.ReactNode
  value: string
  onChange: (value: string) => void
  mode?: DateTimeMode
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  step?: number | string
  id?: string
  name?: string
  placeholder?: string
  hint?: React.ReactNode
  rightAddon?: React.ReactNode
  className?: string
  inputClassName?: string
}

function DateTimeField({
  label,
  value,
  onChange,
  mode = 'date',
  required,
  disabled,
  min,
  max,
  step,
  id,
  name,
  placeholder,
  hint,
  rightAddon,
  className,
  inputClassName,
}: DateTimeFieldProps) {
  const autoId = React.useId()
  const inputId = id || autoId
  const Icon = mode === 'time' ? Clock3 : CalendarDays
  const [open, setOpen] = React.useState(false)

  const selectedDate = React.useMemo(() => {
    if (!value || mode !== 'date') return undefined
    const [year, month, day] = value.split('-').map((chunk) => Number(chunk))
    if (!year || !month || !day) return undefined
    const parsedDate = new Date(year, month - 1, day)
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate
  }, [value, mode])

  const displayDate = React.useMemo(() => {
    if (!selectedDate) return ''
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(selectedDate)
  }, [selectedDate])

  const setDateValue = (date: Date | undefined) => {
    if (!date) {
      onChange('')
      return
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    onChange(`${year}-${month}-${day}`)
  }

  if (mode === 'date') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={inputId}>{label}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={inputId}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                'h-10 w-full justify-between rounded-lg border-border/70 bg-background px-3 text-left font-normal hover:bg-accent/40',
                !value && 'text-muted-foreground',
                inputClassName
              )}
            >
              <span className="inline-flex items-center gap-2 truncate">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {displayDate || placeholder || 'Selectionner une date'}
              </span>
              <span className="flex items-center gap-1">
                {value && !required ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onChange('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onChange('')
                      }
                    }}
                    aria-label="Effacer la date"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-xl border-border/80 p-0 shadow-xl" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setDateValue(date)
                setOpen(false)
              }}
              captionLayout="dropdown"
              disabled={(date) => {
                if (min) {
                  const minDate = new Date(`${min}T00:00:00`)
                  if (date < minDate) return true
                }
                if (max) {
                  const maxDate = new Date(`${max}T23:59:59`)
                  if (date > maxDate) return true
                }
                return false
              }}
            />
          </PopoverContent>
        </Popover>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          name={name}
          type={mode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={cn('h-10 rounded-lg border-border/70 bg-background pr-10 pl-9', inputClassName)}
        />
        {rightAddon && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {rightAddon}
          </div>
        )}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export { DateTimeField, type DateTimeFieldProps, type DateTimeMode }
