import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { db } from "@/db/dexie";
import { getDueCards, schedule, incrementDailyReviews } from "@/engines/srs";
import { buildSessionQueue, computeBucketTargets } from "@/engines/session";
import { useSessionStore } from "@/state/session-store";
import { useSettings } from "@/state/settings-store";
import type { Grade, SrsCard, Word } from "@/db/schema";
import { RecognitionPrompt } from "@/components/RecognitionPrompt";
import { MultipleChoicePrompt } from "@/components/MultipleChoicePrompt";
import { WritingPrompt } from "@/components/WritingPrompt";
import { chunky } from "@/components/Button";

export const Route = createFileRoute("/review")({
  component: Review,
});

function Review() {
  const settings = useSettings();
  const navigate = useNavigate();
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

  if (!settings) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-gray-400 font-bold uppercase tracking-wider text-sm">
          Loading…
        </p>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <p className="text-6xl mb-4">🌱</p>
        <p className="text-2xl sm:text-3xl font-extrabold text-gray-800">
          Nothing to review!
        </p>
        <p className="mt-2 text-gray-500 font-semibold">
          Come back later or add new characters.
        </p>
        <Link to="/" className={chunky("primary", "mt-8")}>
          ← Back to home
        </Link>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <p className="text-7xl mb-4">🎉</p>
        <p className="text-3xl sm:text-4xl font-extrabold text-green-600">
          Lesson complete!
        </p>
        <p className="mt-3 text-gray-600 font-bold">
          {queue.length} {queue.length === 1 ? "character" : "characters"} studied
        </p>
        <div className="mt-8 rounded-2xl bg-white border-2 border-b-4 border-gray-200 py-5 px-4">
          <p className="font-hanzi text-green-500 text-3xl font-black">太好了！</p>
          <p className="mt-1 text-sm font-bold text-gray-400 uppercase tracking-wider">
            Well done
          </p>
        </div>
        <Link to="/" className={chunky("primary", "mt-8 w-full")}>
          Finish
        </Link>
      </div>
    );
  }

  const current = queue[index];
  const progress = Math.round(((index) / queue.length) * 100);

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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-16">
      {/* Progress header: X exit + progress bar */}
      <header className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            clear();
            navigate({ to: "/" });
          }}
          aria-label="Exit lesson"
          className="grid place-items-center h-10 w-10 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-2xl font-black"
        >
          ✕
        </button>
        <div className="flex-1 h-4 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-green-500 border-b-[3px] border-green-700 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-extrabold tabular-nums text-gray-500 min-w-[3ch] text-right">
          {index + 1}/{queue.length}
        </span>
      </header>

      {/* Prompt stage */}
      <section className="mt-12 sm:mt-16 min-h-[24rem]">
        {current.card.promptType === "recognition" ? (
          <RecognitionPrompt word={current.word} onGrade={handleGrade} />
        ) : current.card.promptType === "audio-to-draw" ||
          current.card.promptType === "meaning-to-draw" ? (
          <WritingPrompt
            word={current.word}
            promptType={current.card.promptType}
            onGrade={handleGrade}
          />
        ) : (
          <MultipleChoicePrompt
            word={current.word}
            promptType={current.card.promptType}
            onGrade={handleGrade}
          />
        )}
      </section>
    </div>
  );
}
