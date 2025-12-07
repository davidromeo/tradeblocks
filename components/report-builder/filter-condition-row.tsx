"use client"

/**
 * Filter Condition Row
 *
 * A single filter condition editor with field, operator, and value inputs.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  FilterCondition,
  FilterOperator,
  FILTER_OPERATOR_LABELS,
  getFieldsByCategory
} from '@/lib/models/report-config'

interface FilterConditionRowProps {
  condition: FilterCondition
  onChange: (condition: FilterCondition) => void
  onRemove: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  market: 'Market Conditions',
  performance: 'Performance',
  timing: 'Timing'
}

export function FilterConditionRow({
  condition,
  onChange,
  onRemove
}: FilterConditionRowProps) {
  const [valueInput, setValueInput] = useState(condition.value.toString())
  const [value2Input, setValue2Input] = useState(condition.value2?.toString() ?? '')

  const fieldsByCategory = getFieldsByCategory()

  const handleFieldChange = (field: string) => {
    onChange({ ...condition, field })
  }

  const handleOperatorChange = (operator: string) => {
    onChange({ ...condition, operator: operator as FilterOperator })
  }

  const handleValueBlur = () => {
    const val = parseFloat(valueInput)
    if (!isNaN(val)) {
      onChange({ ...condition, value: val })
    } else {
      setValueInput(condition.value.toString())
    }
  }

  const handleValue2Blur = () => {
    if (value2Input === '') {
      onChange({ ...condition, value2: undefined })
      return
    }
    const val = parseFloat(value2Input)
    if (!isNaN(val)) {
      onChange({ ...condition, value2: val })
    } else {
      setValue2Input(condition.value2?.toString() ?? '')
    }
  }

  const handleEnabledChange = (enabled: boolean) => {
    onChange({ ...condition, enabled })
  }

  const isBetween = condition.operator === 'between'

  return (
    <div className={`p-2 rounded-md border space-y-2 ${
      condition.enabled ? 'bg-background' : 'bg-muted/50 opacity-60'
    }`}>
      {/* Row 1: Toggle, Field selector, Remove button */}
      <div className="flex items-center gap-2">
        <Switch
          checked={condition.enabled}
          onCheckedChange={handleEnabledChange}
          className="data-[state=checked]:bg-primary shrink-0"
        />

        <Select value={condition.field} onValueChange={handleFieldChange}>
          <SelectTrigger className="flex-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(fieldsByCategory).map(([category, fields]) => (
              <SelectGroup key={category}>
                <SelectLabel>{CATEGORY_LABELS[category] ?? category}</SelectLabel>
                {fields.map(field => (
                  <SelectItem key={field.field} value={field.field}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>

      {/* Row 2: Operator and Value(s) */}
      <div className="flex items-center gap-2 pl-12">
        <Select value={condition.operator} onValueChange={handleOperatorChange}>
          <SelectTrigger className="w-[70px] h-8 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTER_OPERATOR_LABELS).map(([op, label]) => (
              <SelectItem key={op} value={op}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          onBlur={handleValueBlur}
          onKeyDown={(e) => e.key === 'Enter' && handleValueBlur()}
          className="flex-1 h-8 text-sm bg-background"
          placeholder="0"
        />

        {isBetween && (
          <>
            <span className="text-xs text-muted-foreground shrink-0">to</span>
            <Input
              type="number"
              value={value2Input}
              onChange={(e) => setValue2Input(e.target.value)}
              onBlur={handleValue2Blur}
              onKeyDown={(e) => e.key === 'Enter' && handleValue2Blur()}
              className="flex-1 h-8 text-sm bg-background"
              placeholder="0"
            />
          </>
        )}
      </div>
    </div>
  )
}

export default FilterConditionRow
