import { useEffect, useState } from "react";

import {
  PLCalendarSettings,
  PL_CALENDAR_STORAGE_KEY,
  defaultPLCalendarSettings,
} from "@/lib/settings/pl-calendar-settings";

export function usePLCalendarSettings() {
  const [settings, setSettings] = useState<PLCalendarSettings>(defaultPLCalendarSettings);

  // Load from localStorage once
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PL_CALENDAR_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PLCalendarSettings>;
      const merged: PLCalendarSettings = { ...defaultPLCalendarSettings, ...parsed };
      setSettings(merged);
    } catch (e) {
      console.warn("[PLCalendar] Failed to read settings from localStorage:", e);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PL_CALENDAR_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("[PLCalendar] Failed to persist settings:", e);
    }
  }, [settings]);

  const updateSetting = <K extends keyof PLCalendarSettings>(
    key: K,
    value: PLCalendarSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return { settings, setSettings, updateSetting };
}
