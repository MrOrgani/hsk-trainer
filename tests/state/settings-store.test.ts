import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/dexie";
import { DEFAULT_SETTINGS } from "@/db/schema";
import { loadOrInitSettings, updateSettings } from "@/state/settings-store";

beforeEach(async () => {
  await db.settings.clear();
});

describe("loadOrInitSettings", () => {
  it("returns defaults when no settings exist", async () => {
    const s = await loadOrInitSettings();
    expect(s.newPerDay).toBe(10);
    expect(s.uiLanguage).toBe("en");
  });

  it("returns existing settings if already stored", async () => {
    await db.settings.put({ ...DEFAULT_SETTINGS, newPerDay: 5 });
    const s = await loadOrInitSettings();
    expect(s.newPerDay).toBe(5);
  });
});

describe("updateSettings", () => {
  it("merges partial updates into stored settings", async () => {
    await loadOrInitSettings();
    const updated = await updateSettings({ newPerDay: 20, uiLanguage: "fr" });
    expect(updated.newPerDay).toBe(20);
    expect(updated.uiLanguage).toBe("fr");
    expect(updated.leniency).toBe("strict");
    const reloaded = await db.settings.get("default");
    expect(reloaded!.newPerDay).toBe(20);
  });

  it("initialises settings if none exist before updating", async () => {
    const updated = await updateSettings({ newPerDay: 3 });
    expect(updated.newPerDay).toBe(3);
    expect(updated.leniency).toBe("strict");
  });
});
