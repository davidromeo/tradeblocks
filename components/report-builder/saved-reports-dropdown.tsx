"use client"

/**
 * Saved Reports Dropdown
 *
 * Dropdown to select and load saved report configurations.
 */

import { useEffect } from 'react'
import { ChevronDown, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { ReportConfig } from '@/lib/models/report-config'

interface SavedReportsDropdownProps {
  onSelect: (report: ReportConfig) => void
}

export function SavedReportsDropdown({ onSelect }: SavedReportsDropdownProps) {
  const savedReports = useSettingsStore((state) => state.savedReports)
  const deleteReport = useSettingsStore((state) => state.deleteReport)
  const initialize = useSettingsStore((state) => state.initialize)

  // Initialize store to load built-in reports
  useEffect(() => {
    initialize()
  }, [initialize])

  const builtInReports = savedReports.filter(r => r.isBuiltIn)
  const userReports = savedReports.filter(r => !r.isBuiltIn)

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteReport(id)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          Load Report
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {builtInReports.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Presets
            </div>
            {builtInReports.map((report) => (
              <DropdownMenuItem
                key={report.id}
                onClick={() => onSelect(report)}
                className="gap-2"
              >
                <Star className="h-3 w-3 text-yellow-500" />
                {report.name}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {userReports.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              My Reports
            </div>
            {userReports.map((report) => (
              <DropdownMenuItem
                key={report.id}
                onClick={() => onSelect(report)}
                className="group flex justify-between"
              >
                <span>{report.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={(e) => handleDelete(e, report.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {savedReports.length === 0 && (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No saved reports
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SavedReportsDropdown
