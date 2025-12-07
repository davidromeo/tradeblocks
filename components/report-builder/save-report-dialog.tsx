"use client"

/**
 * Save Report Dialog
 *
 * Modal dialog to save the current report configuration.
 */

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/lib/stores/settings-store'
import {
  FilterConfig,
  ChartType,
  ChartAxisConfig
} from '@/lib/models/report-config'

interface SaveReportDialogProps {
  filterConfig: FilterConfig
  chartType: ChartType
  xAxis: ChartAxisConfig
  yAxis: ChartAxisConfig
  colorBy?: ChartAxisConfig
  sizeBy?: ChartAxisConfig
  tableBuckets?: number[]
  tableColumns?: string[]
}

export function SaveReportDialog({
  filterConfig,
  chartType,
  xAxis,
  yAxis,
  colorBy,
  sizeBy,
  tableBuckets,
  tableColumns
}: SaveReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const saveReport = useSettingsStore((state) => state.saveReport)

  const handleSave = () => {
    if (!name.trim()) return

    saveReport({
      name: name.trim(),
      filter: filterConfig,
      chartType,
      xAxis,
      yAxis,
      colorBy,
      sizeBy,
      tableBuckets,
      tableColumns
    })

    setName('')
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          Save Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save Report</DialogTitle>
          <DialogDescription>
            Save the current filter and chart configuration as a reusable report.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              placeholder="My Custom Report"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Chart Type:</strong> {chartType}</p>
            <p><strong>X Axis:</strong> {xAxis.label || xAxis.field}</p>
            <p><strong>Y Axis:</strong> {yAxis.label || yAxis.field}</p>
            {colorBy && colorBy.field !== 'none' && (
              <p><strong>Color By:</strong> {colorBy.label || colorBy.field}</p>
            )}
            {filterConfig.conditions.filter(c => c.enabled).length > 0 && (
              <p><strong>Filters:</strong> {filterConfig.conditions.filter(c => c.enabled).length} active</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SaveReportDialog
