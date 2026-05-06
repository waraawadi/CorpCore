'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const DEFAULT_COLORS = [
  '#185FA5',
  '#0F6E56',
  '#BA7517',
  '#B91C1C',
  '#7C3AED',
  '#EC4899',
  '#14B8A6',
  '#F59E0B',
  '#64748B',
  '#111827',
]

type ColorPickerProps = {
  value: string
  onChange: (color: string) => void
  label?: string
  presetColors?: string[]
  className?: string
}

function normalizeHexColor(input: string): string {
  const value = (input || '').trim().toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(value)) return value
  return '#185FA5'
}

export function ColorPicker({
  value,
  onChange,
  label = 'Couleur',
  presetColors = DEFAULT_COLORS,
  className,
}: ColorPickerProps) {
  const selected = normalizeHexColor(value)

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-11 cursor-pointer rounded border bg-background p-1"
          value={selected}
          onChange={(e) => onChange(normalizeHexColor(e.target.value))}
          aria-label={label}
        />
        <Input
          value={selected}
          onChange={(e) => onChange(normalizeHexColor(e.target.value))}
          className="h-9 w-28 font-mono text-xs"
          aria-label={`${label} code hex`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {presetColors.map((color) => {
          const normalized = normalizeHexColor(color)
          const active = selected === normalized
          return (
            <button
              key={normalized}
              type="button"
              onClick={() => onChange(normalized)}
              className={cn(
                'h-6 w-6 rounded-full border transition-transform hover:scale-105',
                active ? 'ring-2 ring-primary ring-offset-2' : 'ring-0'
              )}
              style={{ backgroundColor: normalized }}
              aria-label={`Choisir ${normalized}`}
              title={normalized}
            />
          )
        })}
      </div>
    </div>
  )
}

