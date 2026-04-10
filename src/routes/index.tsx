import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { seedHskLevel } from "@/lib/seed";
import { getDueCards, getTodayState } from "@/engines/srs";
import { useSettings } from "@/state/settings-store";
import { chunky } from "@/components/Button";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const settings = useSettings();
  const { t } = useTranslation();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    Promise.all([
      seedHskLevel(1),
      seedHskLevel(2),
      seedHskLevel(3),
      seedHskLevel(4),
      seedHskLevel(5),
      seedHskLevel(6),
      seedHskLevel(7),
    ]).then(() => setSeeded(true));
  }, []);

  const dueQuery = useQuery({
    queryKey: ["due"],
    queryFn: () => getDueCards(Date.now()),
    enabled: seeded,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const todayQuery = useQuery({
    queryKey: ["today"],
    queryFn: () => getTodayState(Date.now()),
    enabled: seeded,
  });

  const dueCount = dueQuery.data?.length ?? 0;
  const newToday = todayQuery.data?.newCardsIntroduced ?? 0;
  const newTarget = settings?.newPerDay ?? 0;
  const canReview = dueCount > 0;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 sm:pt-16 pb-16">
      {/* Hero */}
      <div className="text-center animate-pop-in">
        <div className="seal-stamp h-20 w-20 sm:h-24 sm:w-24 text-vermillion-500 mb-5 animate-stamp-in mx-auto">
          <span className="font-hanzi text-4xl sm:text-5xl font-black">
            學
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-800">
          {t("home.title")}
        </h1>
        <p className="mt-2 text-ink-400 font-medium">
          {t("home.subtitle")}
        </p>
      </div>

      {/* Stat pills */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl card p-4 sm:p-5 text-center">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-300">
            {t("home.dueNow")}
          </p>
          <p
            className={`mt-1 text-4xl sm:text-5xl font-black tabular-nums ${
              dueCount > 0 ? "text-vermillion-500" : "text-ink-200"
            }`}
          >
            {dueCount}
          </p>
          <p className="mt-1 text-xs font-medium text-ink-300">
            {dueCount === 1 ? t("home.character") : t("home.characters")}
          </p>
        </div>
        <div className="rounded-xl card p-4 sm:p-5 text-center">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-300">
            {t("home.newToday")}
          </p>
          <p className="mt-1 text-4xl sm:text-5xl font-black tabular-nums text-jade-500">
            {newToday}
            <span className="text-2xl sm:text-3xl text-ink-200"> / {newTarget}</span>
          </p>
          <p className="mt-1 text-xs font-medium text-ink-300">{t("home.introduced")}</p>
        </div>
      </div>

      {/* Big CTA card */}
      <div className="mt-8 rounded-2xl card p-6 sm:p-8 text-center">
        {canReview ? (
          <>
            <p className="font-display text-vermillion-500 text-3xl sm:text-4xl mb-2">
              加油！
            </p>
            <p className="text-ink-500 font-medium mb-5">
              {dueCount} {dueCount === 1 ? t("home.characterIs") : t("home.charactersAre")}
            </p>
            <Link to="/review" className={chunky("primary", "w-full")}>
              {t("home.startLesson")}
            </Link>
          </>
        ) : (
          <>
            <p className="font-display text-jade-500 text-3xl sm:text-4xl mb-2">
              开始吧
            </p>
            <p className="text-ink-500 font-medium mb-5">
              {t("home.noReviewsDue")}
            </p>
            <Link to="/study" className={chunky("info", "w-full")}>
              {t("home.addNewCharacters")}
            </Link>
          </>
        )}

        {canReview && (
          <Link
            to="/study"
            className="mt-3 block w-full text-center text-sm font-semibold text-ink-300 hover:text-jade-500 py-2 transition-colors"
          >
            {t("home.addNewCharactersLower")}
          </Link>
        )}
      </div>
    </div>
  );
}
