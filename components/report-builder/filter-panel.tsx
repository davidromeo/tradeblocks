"use client"

/**
 * Filter Panel
 *
 * Left panel of the Report Builder with flexible filter conditions.
 */

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  FilterConfig,
  FilterCondition,
  createFilterCondition
} from '@/lib/models/report-config'
import { FlexibleFilterResult } from '@/lib/calculations/flexible-filter'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { FilterConditionRow } from './filter-condition-row'

interface FilterPanelProps {
  filterConfig: FilterConfig
  onFilterChange: (config: FilterConfig) => void
  filterResult: FlexibleFilterResult | null
  /** Enriched trades to extract custom fields from */
  trades?: EnrichedTrade[]
}

export function FilterPanel({
  filterConfig,
  onFilterChange,
  filterResult,
  trades = []
}: FilterPanelProps) {
  // Add a new filter condition
  const handleAddCondition = () => {
    const newCondition = createFilterCondition()
    onFilterChange({
      ...filterConfig,
      conditions: [...filterConfig.conditions, newCondition]
    })
  }

  // Update an existing condition
  const handleConditionChange = (updatedCondition: FilterCondition) => {
    onFilterChange({
      ...filterConfig,
      conditions: filterConfig.conditions.map(c =>
        c.id === updatedCondition.id ? updatedCondition : c
      )
    })
  }

  // Remove a condition
  const handleRemoveCondition = (conditionId: string) => {
    onFilterChange({
      ...filterConfig,
      conditions: filterConfig.conditions.filter(c => c.id !== conditionId)
    })
  }

  // Clear all conditions
  const handleClearAll = () => {
    onFilterChange({
      ...filterConfig,
      conditions: []
    })
  }

  const hasConditions = filterConfig.conditions.length > 0
  const activeConditions = filterConfig.conditions.filter(c => c.enabled)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filter conditions */}
        {filterConfig.conditions.length > 0 ? (
          <div className="space-y-2">
            {filterConfig.conditions.map(condition => (
              <FilterConditionRow
                key={condition.id}
                condition={condition}
                onChange={handleConditionChange}
                onRemove={() => handleRemoveCondition(condition.id)}
                trades={trades}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No filters applied - showing all trades
          </div>
        )}

        {/* Add filter button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleAddCondition}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>

        <Separator />

        {/* Filter summary */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Results</div>
          {filterResult && (
            <div className="text-sm">
              <span className="font-medium">{filterResult.matchCount}</span>
              <span className="text-muted-foreground">
                {' '}of {filterResult.totalCount} trades ({filterResult.matchPercent.toFixed(1)}%)
              </span>
            </div>
          )}
          {activeConditions.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {activeConditions.length} active filter{activeConditions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Clear button */}
        {hasConditions && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleClearAll}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Filters
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default FilterPanel
