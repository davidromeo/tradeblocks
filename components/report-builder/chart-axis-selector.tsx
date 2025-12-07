"use client"

/**
 * Chart Axis Selector
 *
 * Dropdown component for selecting a field to use as an axis in charts.
 */

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { getFieldsByCategory } from '@/lib/models/report-config'

interface ChartAxisSelectorProps {
  label: string
  value: string
  onChange: (value: string) => void
  allowNone?: boolean
  className?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  market: 'Market Conditions',
  performance: 'Performance',
  timing: 'Timing'
}

export function ChartAxisSelector({
  label,
  value,
  onChange,
  allowNone = false,
  className
}: ChartAxisSelectorProps) {
  const fieldsByCategory = getFieldsByCategory()

  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 mt-1">
          <SelectValue placeholder="Select field..." />
        </SelectTrigger>
        <SelectContent>
          {allowNone && (
            <SelectItem value="none">None</SelectItem>
          )}
          {Object.entries(fieldsByCategory).map(([category, fields]) => (
            <SelectGroup key={category}>
              <SelectLabel className="text-xs">{CATEGORY_LABELS[category] ?? category}</SelectLabel>
              {fields.map(field => (
                <SelectItem key={field.field} value={field.field}>
                  {field.label}
                  {field.unit && (
                    <span className="text-muted-foreground ml-1">({field.unit})</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default ChartAxisSelector
