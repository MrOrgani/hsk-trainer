import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getWeeklyStats,
  getOverallStats,
  type OverallStats,
} from "@/lib/stats";
import type { DailyState } from "@/db/schema";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});

export function StatsPage() {
  const [weekly, setWeekly] = useState<DailyState[]>([]);
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const { t, lang } = useTranslation();

  useEffect(() => {
    const now = Date.now();
    getWeeklyStats(now).then(setWeekly);
    getOverallStats().then(setOverall);
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
    </div>
  );
}
