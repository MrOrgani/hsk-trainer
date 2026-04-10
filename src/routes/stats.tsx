import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getWeeklyStats,
  getOverallStats,
  getCharacterProgress,
  type OverallStats,
  type LevelProgress,
} from "@/lib/stats";
import type { DailyState } from "@/db/schema";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});

export function StatsPage() {
  const [weekly, setWeekly] = useState<DailyState[]>([]);
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [progress, setProgress] = useState<LevelProgress[]>([]);
  const { t, lang } = useTranslation();

  useEffect(() => {
    const now = Date.now();
    getWeeklyStats(now).then(setWeekly);
    getOverallStats().then(setOverall);
    getCharacterProgress().then(setProgress);
  }, []);

  const maxReviews = Math.max(1, ...weekly.map((d) => d.reviewsCompleted));
  const weekdayLocale = lang === "fr" ? "fr" : "en";

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-ink-800 mb-8">
        {t("stats.title")}
      </h1>

      {overall && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl card p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              {t("stats.totalCards")}
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-ink-800">
              {overall.total}
            </p>
          </div>
          <div className="rounded-xl card p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              {t("stats.learning")}
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-gold-500">
              {overall.learning}
            </p>
          </div>
          <div className="rounded-xl card p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              {t("stats.reviewing")}
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-jade-500">
              {overall.review}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 mb-4">
          {t("stats.reviewsThisWeek")}
        </h2>
        <div className="flex items-end gap-2 h-32">
          {weekly.map((day) => {
            const height =
              day.reviewsCompleted > 0
                ? Math.max(8, (day.reviewsCompleted / maxReviews) * 100)
                : 4;
            const dayLabel = new Date(
              day.date + "T00:00:00",
            ).toLocaleDateString(weekdayLocale, { weekday: "short" });
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] font-bold tabular-nums text-ink-400">
                  {day.reviewsCompleted > 0 ? day.reviewsCompleted : ""}
                </span>
                <div
                  className={`w-full rounded-t-md transition-all ${day.reviewsCompleted > 0 ? "bg-gradient-to-t from-jade-500 to-jade-400" : "bg-ink-100"}`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] font-semibold text-ink-300">
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const maxNew = Math.max(
          1,
          ...weekly.map((d) => d.newCardsIntroduced),
        );
        return (
          <div className="rounded-xl card p-5 mt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 mb-4">
              {t("stats.newCardsThisWeek")}
            </h2>
            <div className="flex items-end gap-2 h-32">
              {weekly.map((day) => {
                const height =
                  day.newCardsIntroduced > 0
                    ? Math.max(8, (day.newCardsIntroduced / maxNew) * 100)
                    : 4;
                const dayLabel = new Date(
                  day.date + "T00:00:00",
                ).toLocaleDateString(weekdayLocale, { weekday: "short" });
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] font-bold tabular-nums text-ink-400">
                      {day.newCardsIntroduced > 0
                        ? day.newCardsIntroduced
                        : ""}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${day.newCardsIntroduced > 0 ? "bg-gradient-to-t from-gold-500 to-gold-400" : "bg-ink-100"}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] font-semibold text-ink-300">
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {progress.length > 0 && (
        <div className="rounded-xl card p-5 mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 mb-5">
            {t("stats.progressByLevel")}
          </h2>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ink-200" />
              {t("stats.maturityNew")}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-vermillion-400" />
              {t("stats.maturityLearning")}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gold-400" />
              {t("stats.maturityYoung")}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-jade-400" />
              {t("stats.maturityMature")}
            </span>
          </div>

          <div className="space-y-3">
            {progress.map((level) => {
              const pctNew = level.total > 0 ? (level.new / level.total) * 100 : 0;
              const pctLearning = level.total > 0 ? (level.learning / level.total) * 100 : 0;
              const pctYoung = level.total > 0 ? (level.young / level.total) * 100 : 0;
              const pctMature = level.total > 0 ? (level.mature / level.total) * 100 : 0;
              const studied = level.learning + level.young + level.mature;

              return (
                <div key={level.hskLevel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink-600">
                      HSK {level.hskLevel}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-ink-400">
                      {studied}/{level.total} {t("stats.characters")}
                      {level.total > 0 && (
                        <span className="ml-1 text-ink-300">
                          ({Math.round((studied / level.total) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex h-3 w-full rounded-full overflow-hidden bg-ink-100">
                    {pctMature > 0 && (
                      <div
                        className="bg-jade-400 transition-all"
                        style={{ width: `${pctMature}%` }}
                      />
                    )}
                    {pctYoung > 0 && (
                      <div
                        className="bg-gold-400 transition-all"
                        style={{ width: `${pctYoung}%` }}
                      />
                    )}
                    {pctLearning > 0 && (
                      <div
                        className="bg-vermillion-400 transition-all"
                        style={{ width: `${pctLearning}%` }}
                      />
                    )}
                    {pctNew > 0 && (
                      <div
                        className="bg-ink-200 transition-all"
                        style={{ width: `${pctNew}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
