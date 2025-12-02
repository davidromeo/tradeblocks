"use client";

import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  PLCalendarSettings,
  PLCalendarSettingKey,
  plCalendarPresets,
} from "@/lib/settings/pl-calendar-settings";

interface PLCalendarSettingsMenuProps {
  settings: PLCalendarSettings;
  onChange: (next: PLCalendarSettings) => void;
}

export function PLCalendarSettingsMenu({ settings, onChange }: PLCalendarSettingsMenuProps) {
  const toggle = (key: PLCalendarSettingKey) => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">Display Settings</p>
          <p className="text-xs text-muted-foreground">Toggle calendar overlays to A/B test readability.</p>

          <div className="space-y-2 border-b pb-3">
            <p className="text-xs font-semibold text-muted-foreground">Presets</p>
            <div className="flex flex-wrap gap-2">
              <PresetButton label="Minimal" onSelect={() => onChange(plCalendarPresets.minimal)} />
              <PresetButton label="Focus" onSelect={() => onChange(plCalendarPresets.focus)} />
              <PresetButton label="Full Nerd" onSelect={() => onChange(plCalendarPresets.fullNerd)} />
            </div>
          </div>

          <Section
            title="Visual"
            items={[
              { key: "showWeeklyBands", label: "Weekly regime bands" },
              { key: "showHeatmap", label: "P/L heatmap intensity" },
              { key: "showStreaks", label: "Win / loss streak tags" },
              { key: "showWeeklyStrategies", label: "Weekly strategy breakdown" },
              { key: "showWeeklySparkline", label: "Weekly drawdown sparkline" },
            ]}
            settings={settings}
            toggle={toggle}
          />

          <Section
            title="Analytics"
            items={[
              { key: "showConsistencyScore", label: "Consistency score" },
              { key: "showVolatilityView", label: "Volatility view" },
              { key: "showEVScoring", label: "EV scoring" },
            ]}
            settings={settings}
            toggle={toggle}
          />

          <Section
            title="Annotations"
            items={[
              { key: "showTradeTypeIcons", label: "Trade type icons" },
              { key: "showNLPNotes", label: "NLP notes" },
              { key: "showTimeOfDayHeatmap", label: "Time-of-day heatmap" },
            ]}
            settings={settings}
            toggle={toggle}
          />

          <Section
            title="Export"
            items={[{ key: "enablePDFWeeklyExport", label: "Weekly PDF export" }]}
            settings={settings}
            toggle={toggle}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  title,
  items,
  settings,
  toggle,
}: {
  title: string;
  items: { key: PLCalendarSettingKey; label: string }[];
  settings: PLCalendarSettings;
  toggle: (k: PLCalendarSettingKey) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm">{item.label}</span>
            <Switch checked={settings[item.key]} onCheckedChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PresetButton({
  label,
  onSelect,
}: {
  label: string;
  onSelect: () => void;
}) {
  return (
    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onSelect}>
      {label}
    </Button>
  );
}
