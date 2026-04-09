import { useEffect, useState } from "react";
import { db } from "@/db/dexie";
import { DEFAULT_SETTINGS, type Settings } from "@/db/schema";

export async function loadOrInitSettings(): Promise<Settings> {
  const existing = await db.settings.get("default");
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    loadOrInitSettings().then(setSettings);
  }, []);
  return settings;
}
