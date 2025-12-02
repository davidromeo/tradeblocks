import { Badge } from "@/components/ui/badge"
import { ReactNode } from "react"

interface WorkspaceShellProps {
  title: string
  description: string
  label?: string
  children: ReactNode
}

export function WorkspaceShell({ title, description, label, children }: WorkspaceShellProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {label && <Badge variant="secondary">{label}</Badge>}
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
