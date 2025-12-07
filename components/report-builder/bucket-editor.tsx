"use client"

/**
 * Bucket Editor
 *
 * UI component for defining bucket thresholds for table output.
 * Accepts comma-separated numbers (e.g., "15, 20, 25, 30").
 */

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseBucketEdges, formatBucketEdges, getDefaultBucketEdges } from '@/lib/calculations/table-aggregation'

interface BucketEditorProps {
  field: string
  value: number[]
  onChange: (buckets: number[]) => void
  className?: string
}

export function BucketEditor({
  field,
  value,
  onChange,
  className
}: BucketEditorProps) {
  // Local input state for editing
  const [inputValue, setInputValue] = useState(() => formatBucketEdges(value))
  const [error, setError] = useState<string | null>(null)

  // Sync local state when prop value changes
  useEffect(() => {
    setInputValue(formatBucketEdges(value))
    setError(null)
  }, [value])

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setError(null)
  }

  // Validate and apply on blur
  const handleBlur = () => {
    if (!inputValue.trim()) {
      // Empty input - use defaults for the field
      const defaults = getDefaultBucketEdges(field)
      onChange(defaults)
      setInputValue(formatBucketEdges(defaults))
      setError(null)
      return
    }

    const parsed = parseBucketEdges(inputValue)
    if (parsed === null) {
      setError('Enter comma-separated numbers (e.g., 15, 20, 25, 30)')
      return
    }

    if (parsed.length < 1) {
      setError('Enter at least one threshold value')
      return
    }

    onChange(parsed)
    setInputValue(formatBucketEdges(parsed))
    setError(null)
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    }
  }

  // Load defaults for current field
  const handleLoadDefaults = () => {
    const defaults = getDefaultBucketEdges(field)
    onChange(defaults)
    setInputValue(formatBucketEdges(defaults))
    setError(null)
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-muted-foreground">Bucket Thresholds</Label>
        <button
          type="button"
          onClick={handleLoadDefaults}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Reset
        </button>
      </div>
      <Input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="e.g., 15, 20, 25, 30"
        className={`h-8 text-sm ${error ? 'border-destructive' : ''}`}
      />
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Creates buckets like: &lt; {value[0] ?? '?'}, {value[0] ?? '?'}-{value[1] ?? '?'}, ..., ≥ {value[value.length - 1] ?? '?'}
      </p>
    </div>
  )
}

export default BucketEditor
