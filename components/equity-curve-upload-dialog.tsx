"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EquityCurveColumnMapper } from "./equity-curve-column-mapper";
import { EquityCurveProcessor } from "@/lib/processing/equity-curve-processor";
import {
  EquityCurveUploadConfig,
  EquityCurveProcessingResult,
  EquityCurve,
} from "@/lib/models/equity-curve";
import { GenericBlock } from "@/lib/models/block";
import { createBlock, addEquityCurveEntries } from "@/lib/db";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface EquityCurveUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (blockId: string) => void;
}

type UploadStage = "select-file" | "map-columns" | "processing" | "completed";

interface FileState {
  file: File;
  config?: EquityCurveUploadConfig;
  result?: EquityCurveProcessingResult;
}

export function EquityCurveUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: EquityCurveUploadDialogProps) {
  const [blockName, setBlockName] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<UploadStage>("select-file");
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && !processing) {
        setBlockName("");
        setDescription("");
        setStage("select-file");
        setFileState(null);
        setProgress(0);
        setErrors([]);
      }
      onOpenChange(newOpen);
    },
    [processing, onOpenChange]
  );

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFileState({ file });
    setStage("map-columns");
    toast.success("CSV file loaded. Map columns to continue.");
  }, []);

  // Handle column mapping completion
  const handleMappingComplete = useCallback(
    async (config: EquityCurveUploadConfig) => {
      if (!fileState) return;

      setFileState((prev) => (prev ? { ...prev, config } : null));
      setStage("processing");
      setProcessing(true);
      setProgress(0);
      setErrors([]);

      try {
        // Process the equity curve
        const processor = new EquityCurveProcessor({
          progressCallback: (progressData) => {
            setProgress(progressData.progress);
          },
        });

        const result = await processor.processFile(fileState.file, config);

        if (result.errors.length > 0) {
          const errorMessages = result.errors.map((e) => `Row ${e.row}: ${e.message}`);
          setErrors(errorMessages);
        }

        setFileState((prev) => (prev ? { ...prev, result } : null));
        setStage("completed");
        toast.success(
          `Processed ${result.validEntries} entries for strategy "${config.strategyName}"`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setErrors([errorMsg]);
        toast.error(`Processing failed: ${errorMsg}`);
        setStage("select-file");
      } finally {
        setProcessing(false);
      }
    },
    [fileState]
  );

  // Handle saving the generic block
  const handleSave = useCallback(async () => {
    if (!fileState?.result || !fileState.config) return;

    setProcessing(true);
    setProgress(0);

    try {
      const now = new Date();
      const timestamp = Date.now();

      // Create Generic Block
      const genericBlock: Omit<GenericBlock, "id" | "created" | "lastModified"> = {
        type: "equity-curve",
        name: blockName.trim(),
        description: description.trim() || undefined,
        isActive: false,
        equityCurves: [
          {
            strategyName: fileState.config.strategyName,
            fileName: fileState.file.name,
            fileSize: fileState.file.size,
            originalRowCount: fileState.result.totalRows,
            processedRowCount: fileState.result.validEntries,
            uploadedAt: now,
            startingCapital: fileState.config.startingCapital,
          },
        ],
        processingStatus: "completed",
        dataReferences: {
          equityCurveStorageKeys: {
            [fileState.config.strategyName]: `block_${timestamp}_equity_${fileState.config.strategyName}`,
          },
        },
        analysisConfig: {
          riskFreeRate: 0.05,
          useBusinessDaysOnly: false,
          annualizationFactor: 252,
          confidenceLevel: 0.95,
        },
      };

      // Save to IndexedDB
      const savedBlock = (await createBlock(
        genericBlock as any
      )) as unknown as GenericBlock;

      // Add equity curve entries
      await addEquityCurveEntries(savedBlock.id, fileState.result.curve.entries);

      toast.success(`Generic block "${blockName}" created successfully!`);

      if (onSuccess) {
        onSuccess(savedBlock.id);
      }

      handleOpenChange(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save block: ${errorMsg}`);
      setErrors([errorMsg]);
    } finally {
      setProcessing(false);
    }
  }, [fileState, blockName, description, handleOpenChange, onSuccess]);

  // Remove file and start over
  const handleRemoveFile = useCallback(() => {
    setFileState(null);
    setStage("select-file");
    setErrors([]);
  }, []);

  const canSave = blockName.trim() && fileState?.result && !processing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Create Generic Block from Equity Curve
          </DialogTitle>
          <DialogDescription>
            Upload an equity curve CSV to create a generic block for portfolio analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Block Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="block-name">
                Block Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="block-name"
                placeholder="e.g., Combined Strategies 2025"
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                disabled={processing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="block-description">Description (Optional)</Label>
              <Textarea
                id="block-description"
                placeholder="Brief description of this block..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={processing}
              />
            </div>
          </div>

          <Separator />

          {/* Stage: File Selection */}
          {stage === "select-file" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Upload Equity Curve CSV</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a CSV file containing equity curve data (Date, Daily Return %, Margin Req
                  %)
                </p>
              </div>

              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-muted rounded-full">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Upload CSV File</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click to browse or drag and drop
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stage: Column Mapping */}
          {stage === "map-columns" && fileState && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Map CSV Columns</h3>
                  <p className="text-sm text-muted-foreground">
                    Selected file: {fileState.file.name}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
                  <X className="h-4 w-4 mr-2" />
                  Remove File
                </Button>
              </div>

              <EquityCurveColumnMapper
                file={fileState.file}
                onMappingComplete={handleMappingComplete}
                onCancel={handleRemoveFile}
              />
            </div>
          )}

          {/* Stage: Processing */}
          {stage === "processing" && (
            <div className="space-y-4">
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Processing equity curve...</p>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{progress}% complete</p>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Stage: Completed */}
          {stage === "completed" && fileState?.result && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Processing Complete
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Valid Entries:</span>
                        <Badge variant="secondary" className="ml-2">
                          {fileState.result.validEntries}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Skipped Rows:</span>
                        <Badge variant="secondary" className="ml-2">
                          {fileState.result.curve.skippedRows}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date Range:</span>
                        <p className="text-xs mt-1">
                          {fileState.result.curve.dateRangeStart.toLocaleDateString()} -{" "}
                          {fileState.result.curve.dateRangeEnd.toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Return:</span>
                        <Badge
                          variant={
                            fileState.result.curve.totalReturn >= 0 ? "default" : "destructive"
                          }
                          className="ml-2"
                        >
                          {(fileState.result.curve.totalReturn * 100).toFixed(2)}%
                        </Badge>
                      </div>
                    </div>
                    {fileState.result.stats.sharpeRatio !== undefined && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Sharpe Ratio:</span>
                        <span className="ml-2 font-medium">
                          {fileState.result.stats.sharpeRatio.toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              <Button variant="outline" size="sm" onClick={handleRemoveFile} className="w-full">
                <X className="h-4 w-4 mr-2" />
                Start Over
              </Button>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Processing Errors:</p>
                <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li className="text-xs text-muted-foreground">
                      ... and {errors.length - 10} more errors
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Block
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
