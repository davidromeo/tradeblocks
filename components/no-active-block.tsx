import { AlertTriangle } from "lucide-react";

interface NoActiveBlockProps {
  /** Context-specific description shown below the title */
  description?: string;
}

export function NoActiveBlock({
  description = "Please select a block from the sidebar to continue.",
}: NoActiveBlockProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Active Block Selected</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
