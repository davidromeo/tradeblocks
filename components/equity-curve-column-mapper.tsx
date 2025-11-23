"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateFormat } from "@/lib/models/equity-curve";
import { EquityCurveProcessor } from "@/lib/processing/equity-curve-processor";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Info } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface CSVPreview {
  headers: string[];
  preview: string[][];
  totalRows: number;
}

interface ColumnMapping {
  dateColumn: number | null;
  dailyReturnColumn: number | null;
  marginReqColumn: number | null;
  accountValueColumn: number | null; // Optional
}

interface EquityCurveColumnMapperProps {
  file: File | null;
  onMappingComplete: (config: {
    strategyName: string;
    startingCapital: number;
    columnMapping: Required<Omit<ColumnMapping, 'accountValueColumn'>> & { accountValueColumn?: number };
    dateFormat: DateFormat;
    skipHeaderRow: boolean;
  }) => void;
  onCancel: () => void;
}

const DATE_FORMATS: Array<{ value: DateFormat; label: string; example: string }> = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", example: "2025-01-15" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY", example: "01/15/2025" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", example: "15/01/2025" },
  { value: "MM-DD-YYYY", label: "MM-DD-YYYY", example: "01-15-2025" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY", example: "15-01-2025" },
  { value: "YYYY/MM/DD", label: "YYYY/MM/DD", example: "2025/01/15" },
];

const COLUMN_TYPES = [
  { value: "ignore", label: "(Ignore this column)" },
  { value: "date", label: "Date", required: true },
  { value: "dailyReturn", label: "Daily Return % (decimal)", required: true },
  { value: "marginReq", label: "Margin Req % (decimal)", required: true },
  { value: "accountValue", label: "Account Value (optional)" },
];

export function EquityCurveColumnMapper({
  file,
  onMappingComplete,
  onCancel,
}: EquityCurveColumnMapperProps) {
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User inputs
  const [strategyName, setStrategyName] = useState("");
  const [startingCapital, setStartingCapital] = useState("100000");
  const [dateFormat, setDateFormat] = useState<DateFormat>("YYYY-MM-DD");
  const [skipHeaderRow, setSkipHeaderRow] = useState(true);

  // Column mapping
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});

  // Load CSV preview when file changes
  useEffect(() => {
    const loadPreview = async () => {
      if (!file) return;

      setLoading(true);
      setError(null);
      try {
        const processor = new EquityCurveProcessor();
        const previewData = await processor.previewCSV(file, skipHeaderRow);
        setPreview(previewData);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        toast.error(`Failed to load CSV: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [file, skipHeaderRow]);

  const handleColumnMapping = useCallback((columnIndex: number, mappingType: string) => {
    setColumnMapping((prev) => {
      const newMapping = { ...prev };

      // Remove this mapping type from other columns
      Object.keys(newMapping).forEach((key) => {
        if (newMapping[parseInt(key)] === mappingType && mappingType !== "ignore") {
          delete newMapping[parseInt(key)];
        }
      });

      // Set new mapping
      if (mappingType === "ignore") {
        delete newMapping[columnIndex];
      } else {
        newMapping[columnIndex] = mappingType;
      }

      return newMapping;
    });
  }, []);

  const getMappedColumn = useCallback((mappingType: string): number | null => {
    const entry = Object.entries(columnMapping).find(([, type]) => type === mappingType);
    return entry ? parseInt(entry[0]) : null;
  }, [columnMapping]);

  const validateMapping = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!strategyName.trim()) {
      errors.push("Strategy name is required");
    }

    const capital = parseFloat(startingCapital);
    if (isNaN(capital) || capital <= 0) {
      errors.push("Starting capital must be a positive number");
    }

    if (getMappedColumn("date") === null) {
      errors.push("Date column must be mapped");
    }

    if (getMappedColumn("dailyReturn") === null) {
      errors.push("Daily Return % column must be mapped");
    }

    if (getMappedColumn("marginReq") === null) {
      errors.push("Margin Req % column must be mapped");
    }

    return { valid: errors.length === 0, errors };
  }, [strategyName, startingCapital, getMappedColumn]);

  const handleSubmit = useCallback(() => {
    const validation = validateMapping();

    if (!validation.valid) {
      validation.errors.forEach((err) => toast.error(err));
      return;
    }

    const dateCol = getMappedColumn("date");
    const dailyReturnCol = getMappedColumn("dailyReturn");
    const marginReqCol = getMappedColumn("marginReq");
    const accountValueCol = getMappedColumn("accountValue");

    if (dateCol === null || dailyReturnCol === null || marginReqCol === null) {
      toast.error("Required columns not mapped");
      return;
    }

    onMappingComplete({
      strategyName: strategyName.trim(),
      startingCapital: parseFloat(startingCapital),
      columnMapping: {
        dateColumn: dateCol,
        dailyReturnColumn: dailyReturnCol,
        marginReqColumn: marginReqCol,
        ...(accountValueCol !== null && { accountValueColumn: accountValueCol }),
      },
      dateFormat,
      skipHeaderRow,
    });
  }, [
    validateMapping,
    getMappedColumn,
    strategyName,
    startingCapital,
    dateFormat,
    skipHeaderRow,
    onMappingComplete,
  ]);

  const validation = validateMapping();
  const isValid = validation.valid;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading CSV Preview...</CardTitle>
          <CardDescription>Analyzing your file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!preview) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Upload a CSV file to begin</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Equity Curve Configuration
          </CardTitle>
          <CardDescription>
            Configure how to process your equity curve data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="strategy-name">
                Strategy Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="strategy-name"
                placeholder="e.g., Iron Condor Strategy"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="starting-capital">
                Starting Capital <span className="text-destructive">*</span>
              </Label>
              <Input
                id="starting-capital"
                type="number"
                placeholder="100000"
                value={startingCapital}
                onChange={(e) => setStartingCapital(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-format">
              Date Format <span className="text-destructive">*</span>
            </Label>
            <Select
              value={dateFormat}
              onValueChange={(value) => setDateFormat(value as DateFormat)}
            >
              <SelectTrigger id="date-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{format.label}</span>
                      <span className="text-xs text-muted-foreground">
                        (e.g., {format.example})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* CSV Preview & Column Mapping */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Column Mapping</CardTitle>
              <CardDescription>
                Map each column to its data type. Preview shows first 5 rows.
              </CardDescription>
            </div>
            <Badge variant="secondary">{preview.totalRows} total rows</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Required fields:</span> Date, Daily Return % (decimal
              format like 0.005 = 0.5%), Margin Req % (decimal format like 0.5 = 50%).{" "}
              <span className="font-medium">Optional:</span> Account Value (will be calculated if
              not provided).
            </AlertDescription>
          </Alert>

          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.headers.map((header, index) => (
                    <TableHead key={index} className="min-w-[200px]">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono">Column {index + 1}</span>
                          {columnMapping[index] && columnMapping[index] !== "ignore" && (
                            <Badge variant="default" className="text-xs">
                              Mapped
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm font-normal text-muted-foreground truncate">
                          {header}
                        </div>
                        <Select
                          value={columnMapping[index] || "ignore"}
                          onValueChange={(value) => handleColumnMapping(index, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLUMN_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <span className="flex items-center gap-2">
                                  {type.label}
                                  {type.required && (
                                    <span className="text-destructive">*</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.preview.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="font-mono text-xs">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {!isValid && validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!isValid}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Process Equity Curve
        </Button>
      </div>
    </div>
  );
}
