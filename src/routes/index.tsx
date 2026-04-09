import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { db } from "@/db/dexie";
import { seedHskLevel } from "@/lib/seed";
import { getDueCards, introduceNewCard, getTodayState, incrementDailyNew } from "@/engines/srs";
import { useSettings } from "@/state/settings-store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const settings = useSettings();
  const queryClient = useQueryClient();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    seedHskLevel(1).then(() => setSeeded(true));
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

  async function introduceTenNew() {
    if (!settings) return;
    const words = await db.words.where("hskLevel").equals(1).toArray();
    const existing = new Set((await db.srsCards.toArray()).map((c) => c.wordId));
    const today = await getTodayState(Date.now());
    const remaining = Math.max(0, settings.newPerDay - today.newCardsIntroduced);
    const batch = words.filter((w) => !existing.has(w.id)).slice(0, remaining);
    for (const w of batch) {
      await introduceNewCard(w.id, settings, Date.now());
      await incrementDailyNew(Date.now());
    }
    await queryClient.invalidateQueries({ queryKey: ["due"] });
    await queryClient.invalidateQueries({ queryKey: ["today"] });
  }

  const dueCount = dueQuery.data?.length ?? 0;
  const canReview = dueCount > 0;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-semibold">Today</h2>
      <p className="text-slate-600">Due cards: <span className="font-mono">{dueCount}</span></p>
      <p className="text-slate-600">
        New today: <span className="font-mono">{todayQuery.data?.newCardsIntroduced ?? 0}</span> / {settings?.newPerDay ?? 0}
      </p>

      <div className="flex flex-col gap-2">
        {canReview ? (
          <Link
            to="/review"
            className="inline-block rounded bg-sky-600 px-4 py-2 text-white text-center font-medium hover:bg-sky-700"
          >
            Start review ({dueCount})
          </Link>
        ) : (
          <span className="inline-block rounded bg-slate-300 px-4 py-2 text-white text-center font-medium cursor-not-allowed">
            No cards due
          </span>
        )}
        <button
          onClick={introduceTenNew}
          className="rounded border border-slate-300 px-4 py-2 text-slate-700"
        >
          Introduce new words
        </button>
      </div>
    </div>
  );
}
