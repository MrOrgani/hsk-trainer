import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/db/dexie";
import {
  introduceNewCardWithGrade,
  incrementDailyNew,
  incrementDailyReviews,
  getDueWords,
  getUpcomingReviews,
  reviewCard,
} from "@/engines/srs";
import { useSettings } from "@/state/settings-store";
import { useStudyStore, type QueueItem } from "@/state/study-store";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import type { CompletedChar } from "@/components/DrawingCanvas";
import { AudioButton } from "@/components/AudioButton";
import { playWordAudio, unlockAudio } from "@/lib/audio";
import { chunky } from "@/components/Button";
import type { Word, HskLevel, Grade } from "@/db/schema";
import { useTranslation, meaningFor } from "@/lib/i18n";
import { Button } from "@/components/Button";

export const Route = createFileRoute("/study")({
  component: Study,
});

const HSK_LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6, 7];
const BATCH_SIZE = 10;
const MAX_REVIEWS_PER_BATCH = 20;

function gradeFromMistakes(totalMistakes: number, allHintsUsed: boolean): Grade {
  if (allHintsUsed || totalMistakes >= 7) return "again";
  if (totalMistakes >= 4) return "hard";
  if (totalMistakes >= 1) return "good";
  return "easy";
}

// 2 reviews : 1 new while both available, drain the remainder.
function interleave(newItems: QueueItem[], reviewItems: QueueItem[]): QueueItem[] {
  const out: QueueItem[] = [];
  let ni = 0;
  let ri = 0;
  while (ni < newItems.length && ri < reviewItems.length) {
    out.push(reviewItems[ri++]);
    if (ri < reviewItems.length) out.push(reviewItems[ri++]);
    out.push(newItems[ni++]);
  }
  while (ri < reviewItems.length) out.push(reviewItems[ri++]);
  while (ni < newItems.length) out.push(newItems[ni++]);
  return out;
}

async function buildBatch(level: HskLevel): Promise<QueueItem[]> {
  const now = Date.now();
  const [dueForLevel, words, allCards] = await Promise.all([
    getDueWords(now, level),
    db.words.where("hskLevel").equals(level).sortBy("frequency"),
    db.srsCards.toArray(),
  ]);

  const reviews: QueueItem[] = dueForLevel
    .slice(0, MAX_REVIEWS_PER_BATCH)
    .map((word) => ({ word, kind: "review" as const }));

  const existing = new Set(allCards.map((c) => c.wordId));
  const newItems: QueueItem[] = words
    .filter((w) => !existing.has(w.id))
    .slice(0, BATCH_SIZE)
    .map((word) => ({ word, kind: "new" as const }));

  if (newItems.length === 0 && reviews.length === 0) {
    const upcoming = await getUpcomingReviews(now, level, BATCH_SIZE);
    return upcoming.map((word) => ({ word, kind: "review" as const }));
  }

  return interleave(newItems, reviews);
}

function Study() {
  const settings = useSettings();
  const { t, lang } = useTranslation();
  const {
    queue,
    index,
    start,
    commitCurrent,
    enterRelearnPhase,
    relearn,
    inRelearn,
    clear,
  } = useStudyStore();
  const [selectedLevel, setSelectedLevel] = useState<HskLevel | null>(null);

  const loadBatch = useCallback(
    async (level: HskLevel): Promise<number> => {
      if (!settings) return 0;
      const items = await buildBatch(level);
      start(items);
      return items.length;
    },
    [settings, start],
  );

  useEffect(() => {
    if (!settings || selectedLevel === null) return;
    void loadBatch(selectedLevel);
    return () => clear();
  }, [settings, selectedLevel, loadBatch, clear]);

  const atEnd = index >= queue.length;
  const needsRelearnTransition =
    queue.length > 0 && atEnd && !inRelearn && relearn.length > 0;

  useEffect(() => {
    if (needsRelearnTransition) enterRelearnPhase();
  }, [needsRelearnTransition, enterRelearnPhase]);

  if (!settings) {
    return (
      <p className="text-center py-20 text-ink-300 font-semibold uppercase tracking-wider text-sm">
        {t("common.loading")}
      </p>
    );
  }

  if (selectedLevel === null && queue.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-6 sm:py-20 text-center animate-pop-in">
        <Link
          to="/"
          aria-label="Exit study"
          className="absolute top-4 left-4 grid place-items-center h-10 w-10 rounded-lg text-ink-300 hover:text-ink-600 hover:bg-ink-50 text-2xl font-black"
        >
          ✕
        </Link>
        <p className="font-display text-4xl sm:text-5xl text-ink-300 mb-3 sm:mb-4">
          学
        </p>
        <p className="text-xl sm:text-2xl font-bold text-ink-800">
          {t("study.chooseLevel")}
        </p>
        <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {HSK_LEVELS.map((level) => (
            <Button
              key={level}
              variant={level === settings.hskLevel ? "primary" : "neutral"}
              className="text-lg py-4"
              onClick={() => {
                unlockAudio();
                setSelectedLevel(level);
              }}
            >
              HSK {level}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <p className="text-center py-20 text-ink-300 font-semibold uppercase tracking-wider text-sm">
        {t("common.loading")}
      </p>
    );
  }

  if (atEnd) {
    if (needsRelearnTransition) return null;
    return <DoneScreen level={selectedLevel} onContinue={loadBatch} completed={queue.length} />;
  }

  const item = queue[index];
  const word = item.word;

  async function handleCommitWithGrade(grade: Grade, hadAnyMistake: boolean) {
    const now = Date.now();
    if (item.kind === "new") {
      await introduceNewCardWithGrade(word.id, settings!, now, grade);
      await incrementDailyNew(now);
    } else {
      await reviewCard(word.id, grade, settings!, now);
      await incrementDailyReviews(now);
    }
    commitCurrent(hadAnyMistake);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 sm:pt-8 pb-8 sm:pb-16">
      <header className="flex items-center gap-3 mb-6 sm:mb-10">
        <Link
          to="/"
          aria-label="Exit study"
          className="grid place-items-center h-10 w-10 rounded-lg text-ink-300 hover:text-ink-600 hover:bg-ink-50 text-2xl font-black"
        >
          ✕
        </Link>
        <div className="flex-1 h-3.5 rounded-full bg-ink-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold-500 to-gold-400 rounded-full transition-all duration-300"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-bold tabular-nums text-ink-400 min-w-[3ch] text-right">
          {index + 1}/{queue.length}
        </span>
      </header>

      {inRelearn && (
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-vermillion-500">
          {t("study.relearnPass")}
        </p>
      )}

      <AttemptPhase
        key={`${item.kind}:${word.id}:${index}`}
        word={word}
        kind={item.kind}
        onDone={handleCommitWithGrade}
        leniency={settings?.leniency ?? "strict"}
        lang={lang}
      />
    </div>
  );
}

function DoneScreen({
  level,
  onContinue,
  completed,
}: {
  level: HskLevel | null;
  onContinue: (level: HskLevel) => Promise<number>;
  completed: number;
}) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);

  const onContinueClick = async () => {
    if (!level) return;
    setChecking(true);
    try {
      await onContinue(level);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-6 sm:py-20 text-center animate-pop-in">
      <div className="seal-stamp h-16 w-16 sm:h-20 sm:w-20 text-jade-500 mx-auto mb-3 sm:mb-4 animate-stamp-in">
        <span className="font-hanzi text-2xl sm:text-3xl font-black">好</span>
      </div>
      <p className="text-2xl sm:text-4xl font-bold text-jade-600">
        {t("study.allDone")}
      </p>
      <p className="mt-2 text-ink-400 font-medium">
        {t("study.newWordsAdded")
          .replace("{count}", String(completed))
          .replace("{unit}", completed === 1 ? t("study.word") : t("study.words"))}
      </p>
      <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-2 sm:gap-3">
        <Button
          variant="primary"
          onClick={onContinueClick}
          disabled={checking || !level}
          className="py-4"
        >
          {t("study.continue")}
        </Button>
        <Link to="/" className={chunky("neutral", "py-4")}>
          {t("common.backToHome")}
        </Link>
      </div>
    </div>
  );
}

const VIEWING_DELAY_MS = 1500;

function AttemptPhase({
  word,
  kind,
  onDone,
  leniency,
  lang,
}: {
  word: Word;
  kind: "new" | "review";
  onDone: (grade: Grade, hadAnyMistake: boolean) => void;
  leniency: "strict" | "lenient-order";
  lang: "en" | "fr";
}) {
  const { t } = useTranslation();
  const [charIndex, setCharIndex] = useState(0);
  const [redrawToken, setRedrawToken] = useState(0);
  const [showRedrawHint, setShowRedrawHint] = useState(false);
  const firstAttemptMistakesRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const total = word.characters.length;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    void playWordAudio(word.audioFile, word.id);
  }, [word.id, word.audioFile]);

  function handleCharComplete({ mistakes }: { mistakes: number; strokeMistakes: number[] }) {
    if (firstAttemptMistakesRef.current[charIndex] === undefined) {
      firstAttemptMistakesRef.current[charIndex] = mistakes;
    }

    if (mistakes > 0) {
      setShowRedrawHint(true);
      timerRef.current = setTimeout(() => {
        setShowRedrawHint(false);
        setRedrawToken((t) => t + 1);
      }, 700);
      return;
    }

    const isLast = charIndex + 1 === total;

    timerRef.current = setTimeout(() => {
      if (isLast) {
        const totalMistakes = firstAttemptMistakesRef.current.reduce(
          (sum, m) => sum + (m ?? 0),
          0,
        );
        const hadAnyMistake = firstAttemptMistakesRef.current.some((m) => (m ?? 0) > 0);
        const grade = gradeFromMistakes(totalMistakes, false);
        onDoneRef.current(grade, hadAnyMistake);
      } else {
        setCharIndex((i) => i + 1);
        setRedrawToken(0);
      }
    }, VIEWING_DELAY_MS);
  }

  if (charIndex >= total) return null;

  const completedChars: CompletedChar[] = word.characters
    .slice(0, charIndex)
    .map((char, i) => ({
      char,
      mistakes: firstAttemptMistakesRef.current[i] ?? 0,
    }));

  return (
    <div className="text-center animate-pop-in">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
            kind === "review"
              ? "bg-jade-50 text-jade-600"
              : "bg-gold-50 text-gold-600"
          }`}
        >
          {kind === "review" ? t("study.reviewBadge") : t("study.newBadge")}
        </span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-gold-500">
        {t("study.writeFromMemory")}
      </p>
      <div className="mt-2 sm:mt-3 flex items-center justify-center gap-2">
        <p className="text-xl sm:text-2xl font-bold text-ink-700">
          {word.pinyin}
        </p>
        <AudioButton
          audioFile={word.audioFile}
          fallbackText={word.id}
        />
      </div>
      <p className="mt-1 text-base sm:text-lg font-medium text-ink-400">
        {meaningFor(word, lang)}
      </p>
      <p className="mt-2 sm:mt-4 text-xs font-semibold tabular-nums text-ink-300">
        {charIndex + 1} / {total}
      </p>
      <div className="mt-2 sm:mt-3">
        <DrawingCanvas
          key={`${word.id}:${charIndex}:${redrawToken}`}
          character={word.characters[charIndex]}
          onComplete={handleCharComplete}
          leniency={leniency}
          completedChars={completedChars}
          showOutline={kind !== "review"}
        />
      </div>
      {showRedrawHint && (
        <p className="mt-3 text-sm font-semibold text-vermillion-500 animate-pop-in">
          {t("study.drawAgain")}
        </p>
      )}
    </div>
  );
}
