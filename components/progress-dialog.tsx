"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface ProgressDialogProps {
  open: boolean
  title: string
  step: string
  percent: number
  onCancel: () => void
}

export function ProgressDialog({
  open,
  title,
  step,
  percent,
  onCancel,
}: ProgressDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{step}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Progress value={percent} />
          <p className="text-sm text-muted-foreground text-center">
            {percent}%
          </p>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
