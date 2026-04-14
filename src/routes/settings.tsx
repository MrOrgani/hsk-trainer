import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadOrInitSettings, updateSettings } from "@/state/settings-store";
import type { Settings, HskLevel } from "@/db/schema";
import { chunky } from "@/components/Button";
import { useTranslation } from "@/lib/i18n";
import { db } from "@/db/dexie";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const { t } = useTranslation();

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
        {t("common.loading")}
      </p>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-ink-200 bg-paper px-4 py-3 sm:py-2.5 text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-vermillion-300";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-5 pt-6 sm:pt-10 pb-20 sm:pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-ink-800 mb-6 sm:mb-8">
        {t("settings.title")}
      </h1>
      <div className="space-y-6">
        <div className="rounded-xl card p-5">
          <label className="block text-sm font-semibold text-ink-500 mb-3">
            {t("settings.hskLevel")}
          </label>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5, 6, 7] as const).map((level) => (
              <button
                key={level}
                onClick={() =>
                  setSettings({ ...settings, hskLevel: level as HskLevel })
                }
                className={`h-10 w-10 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  settings.hskLevel === level
                    ? "bg-vermillion-500 text-white shadow-sm"
                    : "bg-ink-50 text-ink-500 hover:bg-ink-100"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl card p-5">
          <label
            htmlFor="newPerDay"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            {t("settings.newCardsPerDay")}
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
            htmlFor="uiLanguage"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            {t("settings.interfaceLanguage")}
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
            <option value="fr">Fran\u00e7ais</option>
          </select>
        </div>
        <div className="rounded-xl card p-5">
          <label
            htmlFor="leniency"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            {t("settings.strokeOrderLeniency")}
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
            <option value="strict">{t("settings.strict")}</option>
            <option value="lenient-order">{t("settings.lenientOrder")}</option>
          </select>
        </div>
        <button onClick={handleSave} className={chunky("primary", "w-full")}>
          {saved ? t("settings.saved") : t("settings.saveSettings")}
        </button>
      </div>

      {/* Danger zone */}
      <div className="mt-12 rounded-xl border border-vermillion-200 bg-vermillion-50/40 p-5">
        <h2 className="font-display text-lg text-vermillion-700 mb-1">
          {t("settings.resetTitle")}
        </h2>
        <p className="text-sm text-ink-500 mb-4">
          {t("settings.resetDescription")}
        </p>
        <button
          onClick={async () => {
            if (!window.confirm(t("settings.resetConfirm"))) return;
            await Promise.all([
              db.words.clear(),
              db.srsCards.clear(),
              db.settings.clear(),
              db.dailyState.clear(),
            ]);
            window.location.reload();
          }}
          className="rounded-lg bg-vermillion-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-vermillion-700 active:scale-[.97] transition-all"
        >
          {t("settings.resetButton")}
        </button>
      </div>
    </div>
  );
}
