export interface PLCalendarSettings {
  showWeeklyBands: boolean;
  showHeatmap: boolean;
  showStreaks: boolean;
  showWeeklyStrategies: boolean;
  showWeeklySparkline: boolean;
  // Analytics / insights
  showConsistencyScore: boolean;
  showVolatilityView: boolean;
  showEVScoring: boolean;
  // UX / annotations
  showTradeTypeIcons: boolean;
  showNLPNotes: boolean;
  showTimeOfDayHeatmap: boolean;
  // Export
  enablePDFWeeklyExport: boolean;
}

export const defaultPLCalendarSettings: PLCalendarSettings = {
  showWeeklyBands: true,
  showHeatmap: true,
  showStreaks: true,
  showWeeklyStrategies: true,
  showWeeklySparkline: false,
  showConsistencyScore: true,
  showVolatilityView: false,
  showEVScoring: false,
  showTradeTypeIcons: true,
  showNLPNotes: false,
  showTimeOfDayHeatmap: false,
  enablePDFWeeklyExport: false,
};

export type PLCalendarSettingKey = keyof PLCalendarSettings;

export type PLCalendarPresetKey = "minimal" | "focus" | "fullNerd";

export const PL_CALENDAR_STORAGE_KEY = "pl-calendar-settings:v1";

export const plCalendarPresets: Record<PLCalendarPresetKey, PLCalendarSettings> = {
  minimal: {
    showWeeklyBands: false,
    showHeatmap: true,
    showStreaks: false,
    showWeeklyStrategies: false,
    showWeeklySparkline: false,
    showConsistencyScore: false,
    showVolatilityView: false,
    showEVScoring: false,
    showTradeTypeIcons: false,
    showNLPNotes: false,
    showTimeOfDayHeatmap: false,
    enablePDFWeeklyExport: false,
  },
  focus: {
    showWeeklyBands: true,
    showHeatmap: true,
    showStreaks: true,
    showWeeklyStrategies: true,
    showWeeklySparkline: false,
    showConsistencyScore: true,
    showVolatilityView: false,
    showEVScoring: false,
    showTradeTypeIcons: true,
    showNLPNotes: false,
    showTimeOfDayHeatmap: false,
    enablePDFWeeklyExport: false,
  },
  fullNerd: {
    showWeeklyBands: true,
    showHeatmap: true,
    showStreaks: true,
    showWeeklyStrategies: true,
    showWeeklySparkline: true,
    showConsistencyScore: true,
    showVolatilityView: true,
    showEVScoring: true,
    showTradeTypeIcons: true,
    showNLPNotes: true,
    showTimeOfDayHeatmap: true,
    enablePDFWeeklyExport: true,
  },
};
