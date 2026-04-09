import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { db } from "@/db/dexie";
import { getDueCards, schedule, incrementDailyReviews } from "@/engines/srs";
import { buildSessionQueue, computeBucketTargets } from "@/engines/session";
import { useSessionStore } from "@/state/session-store";
import { useSettings } from "@/state/settings-store";
import type { Grade, SrsCard, Word } from "@/db/schema";
import { RecognitionPrompt } from "@/components/RecognitionPrompt";
import { MultipleChoicePrompt } from "@/components/MultipleChoicePrompt";

export const Route = createFileRoute("/review")({
  component: Review,
});

function Review() {
  const settings = useSettings();
  const { queue, index, start, advance, clear } = useSessionStore();

  useEffect(() => {
    if (!settings) return;
    (async () => {
      const due = await getDueCards(Date.now());
      const targets = computeBucketTargets(settings.sessionMix, settings.sessionSize);
      const selected = buildSessionQueue(due, targets);
      const words = await db.words.bulkGet(selected.map((c) => c.wordId));
      const pairs = selected
        .map((card, i) => ({ card, word: words[i] }))
        .filter((p): p is { card: SrsCard; word: Word } => !!p.word);
      start(pairs);
    })();
    return () => clear();
  }, [settings, start, clear]);

  if (!settings) return <p>Loading…</p>;
  if (queue.length === 0) {
    return (
      <div className="max-w-md mx-auto space-y-4 text-center">
        <p>No cards due right now.</p>
        <Link to="/" className="text-sky-600 underline">Back home</Link>
      </div>
    );
  }
  if (index >= queue.length) {
    return (
      <div className="max-w-md mx-auto space-y-4 text-center">
        <p className="text-lg">Session complete — {queue.length} cards reviewed.</p>
        <Link to="/" className="text-sky-600 underline">Back home</Link>
      </div>
    );
  }

  const current = queue[index];

  async function handleGrade(grade: Grade) {
    const now = Date.now();
    const updated = schedule(current.card, grade, now, settings!);
    await db.srsCards.put(updated);
    await db.reviewLog.add({
      cardId: current.card.id,
      wordId: current.card.wordId,
      promptType: current.card.promptType,
      timestamp: now,
      grade,
      timeTakenMs: 0,
    });
    await incrementDailyReviews(now);
    advance();
  }

  const progress = `${index + 1} / ${queue.length}`;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex justify-between text-sm text-slate-500">
        <span>{progress}</span>
        <span>{current.card.promptType}</span>
      </div>
      {current.card.promptType === "recognition" ? (
        <RecognitionPrompt word={current.word} onGrade={handleGrade} />
      ) : (
        <MultipleChoicePrompt
          word={current.word}
          promptType={current.card.promptType}
          onGrade={handleGrade}
        />
      )}
    </div>
  );
}
