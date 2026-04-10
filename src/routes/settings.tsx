import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadOrInitSettings, updateSettings } from "@/state/settings-store";
import type { Settings } from "@/db/schema";
import { chunky } from "@/components/Button";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadOrInitSettings().then(setSettings);
  }, []);

  async function handleSave() {
    if (!settings) return;
    const { id, ...rest } = settings;
    await updateSettings(rest);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) {
    return (
      <p className="text-center py-20 text-ink-300 font-semibold uppercase tracking-wider text-sm">
        Loading...
      </p>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-ink-200 bg-paper px-4 py-2.5 text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-vermillion-300";

  return (
    <div className="max-w-xl mx-auto px-5 pt-10 pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-ink-800 mb-8">
        Settings
      </h1>
      <div className="space-y-6">
        <div className="rounded-xl card p-5">
          <label
            htmlFor="newPerDay"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            New cards per day
          </label>
          <input
            id="newPerDay"
            type="number"
            min={0}
            max={50}
            value={settings.newPerDay}
            onChange={(e) =>
              setSettings({
                ...settings,
                newPerDay: parseInt(e.target.value) || 0,
              })
            }
            className={inputCls}
          />
        </div>
        <div className="rounded-xl card p-5">
          <label
            htmlFor="sessionSize"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            Session size
          </label>
          <input
            id="sessionSize"
            type="number"
            min={5}
            max={50}
            value={settings.sessionSize}
            onChange={(e) =>
              setSettings({
                ...settings,
                sessionSize: parseInt(e.target.value) || 5,
              })
            }
            className={inputCls}
          />
        </div>
        <div className="rounded-xl card p-5">
          <label
            htmlFor="uiLanguage"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            Interface language
          </label>
          <select
            id="uiLanguage"
            value={settings.uiLanguage}
            onChange={(e) =>
              setSettings({
                ...settings,
                uiLanguage: e.target.value as "en" | "fr",
              })
            }
            className={inputCls}
          >
            <option value="en">English</option>
            <option value="fr">French</option>
          </select>
        </div>
        <div className="rounded-xl card p-5">
          <label
            htmlFor="leniency"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            Stroke order leniency
          </label>
          <select
            id="leniency"
            value={settings.leniency}
            onChange={(e) =>
              setSettings({
                ...settings,
                leniency: e.target.value as "strict" | "lenient-order",
              })
            }
            className={inputCls}
          >
            <option value="strict">Strict</option>
            <option value="lenient-order">Lenient (order)</option>
          </select>
        </div>
        <button onClick={handleSave} className={chunky("primary", "w-full")}>
          {saved ? "Saved!" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
