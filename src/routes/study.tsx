import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/db/dexie";
import {
  introduceNewCard,
  incrementDailyNew,
} from "@/engines/srs";
import { useSettings } from "@/state/settings-store";
import { useStudyStore } from "@/state/study-store";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import type { CompletedChar } from "@/components/DrawingCanvas";
import { AudioButton } from "@/components/AudioButton";
import { chunky } from "@/components/Button";
import type { Word, HskLevel } from "@/db/schema";
import { useTranslation, meaningFor } from "@/lib/i18n";
import { playWordAudio } from "@/lib/audio";
import { Button } from "@/components/Button";

export const Route = createFileRoute("/study")({
  component: Study,
});

const HSK_LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6, 7];

function Study() {
  const settings = useSettings();
  const { t, lang } = useTranslation();
  const { queue, index, start, commitCurrent, clear } =
    useStudyStore();
  const [selectedLevel, setSelectedLevel] = useState<HskLevel | null>(null);

  useEffect(() => {
    if (!settings || selectedLevel === null) return;
    (async () => {
      const BATCH_SIZE = 10;
      const words = await db.words
        .where("hskLevel")
        .equals(selectedLevel)
        .sortBy("frequency");
      const existing = new Set(
        (await db.srsCards.toArray()).map((c) => c.wordId)
      );
      const fresh = words
        .filter((w) => !existing.has(w.id))
        .slice(0, BATCH_SIZE);
      start(fresh);
    })();
    return () => clear();
  }, [settings, selectedLevel, start, clear]);

  if (!settings) {
    return (
      <p className="text-center py-20 text-ink-300 font-semibold uppercase tracking-wider text-sm">
        {t("common.loading")}
      </p>
    );
  }

  if (selectedLevel === null && queue.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <Link
          to="/"
          aria-label="Exit study"
          className="absolute top-4 left-4 grid place-items-center h-10 w-10 rounded-lg text-ink-300 hover:text-ink-600 hover:bg-ink-50 text-2xl font-black"
        >
          ✕
        </Link>
        <p className="font-display text-5xl text-ink-300 mb-4">
          学
        </p>
        <p className="text-2xl font-bold text-ink-800">
          {t("study.chooseLevel")}
        </p>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {HSK_LEVELS.map((level) => (
            <Button
              key={level}
              variant={level === settings.hskLevel ? "primary" : "neutral"}
              className="text-lg py-4"
              onClick={() => setSelectedLevel(level)}
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
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <p className="font-display text-5xl text-ink-300 mb-4">
          等一等
        </p>
        <p className="text-2xl font-bold text-ink-800">
          {t("study.nothingNew")}
        </p>
        <p className="mt-2 text-ink-400 font-medium">
          {t("study.allStudied")}
        </p>
        <Link to="/" className={chunky("primary", "mt-8")}>
          {t("common.backToHome")}
        </Link>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <div className="seal-stamp h-20 w-20 text-jade-500 mx-auto mb-4 animate-stamp-in">
          <span className="font-hanzi text-3xl font-black">好</span>
        </div>
        <p className="text-3xl sm:text-4xl font-bold text-jade-600">
          {t("study.allDone")}
        </p>
        <p className="mt-2 text-ink-400 font-medium">
          {t("study.newWordsAdded")
            .replace("{count}", String(queue.length))
            .replace("{unit}", queue.length === 1 ? t("study.word") : t("study.words"))}
        </p>
        <Link to="/" className={chunky("primary", "mt-8 w-full")}>
          {t("common.backToHome")}
        </Link>
      </div>
    );
  }

  const word = queue[index];

  async function handleCommitCurrent() {
    await introduceNewCard(word.id, settings!, Date.now());
    await incrementDailyNew(Date.now());
    commitCurrent();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <header className="flex items-center gap-3 mb-10">
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

      <AttemptPhase key={word.id} word={word} onDone={handleCommitCurrent} leniency={settings?.leniency ?? "strict"} lang={lang} />
    </div>
  );
}

const VIEWING_DELAY_MS = 1500;
const SHRINK_DURATION_MS = 400;

function AttemptPhase({
  word,
  onDone,
  leniency,
  lang,
}: {
  word: Word;
  onDone: () => void;
  leniency: "strict" | "lenient-order";
  lang: "en" | "fr";
}) {
  const { t } = useTranslation();
  const settings = useSettings();
  const [charIndex, setCharIndex] = useState(0);
  const [attempts, setAttempts] = useState<{ mistakes: number }[]>([]);
  const [shrinking, setShrinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = word.characters.length;
  const isMultiChar = total > 1;

  // Auto-play pronunciation when a new word appears
  useEffect(() => {
    if (settings?.audioAutoplay) {
      playWordAudio(word.id);
    }
  }, [word.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (charIndex >= total) {
      onDone();
    }
  }, [charIndex, total, onDone]);

  const advanceChar = useCallback(() => {
    setShrinking(false);
    setCharIndex((i) => i + 1);
  }, []);

  function handleCharComplete({ mistakes, strokeMistakes: _strokeMistakes }: { mistakes: number; strokeMistakes: number[] }) {
    setAttempts((prev) => [...prev, { mistakes }]);

    const isLastChar = charIndex >= total - 1;

    if (!isMultiChar || isLastChar) {
      timerRef.current = setTimeout(() => {
        advanceChar();
      }, VIEWING_DELAY_MS);
    } else {
      timerRef.current = setTimeout(() => {
        setShrinking(true);
      }, VIEWING_DELAY_MS);
    }
  }

  function handleTransitionEnd() {
    if (shrinking) {
      advanceChar();
    }
  }

  if (charIndex >= total) return null;

  const completedChars: CompletedChar[] = word.characters
    .slice(0, charIndex)
    .map((char, i) => ({
      char,
      mistakes: attempts[i]?.mistakes ?? 0,
    }));

  const canvasSize = 260;
  const shrinkScale = 0.13;
  const cornerCharWidth = canvasSize * 0.13;
  const targetX = 8 + charIndex * (cornerCharWidth + 2);
  const targetY = 6;

  const shrinkTransform = shrinking
    ? `scale(${shrinkScale}) translate(${targetX / shrinkScale}px, ${targetY / shrinkScale}px)`
    : "scale(1) translate(0, 0)";

  return (
    <div className="text-center animate-pop-in">
      <p className="text-xs font-semibold uppercase tracking-widest text-gold-500">
        {t("study.writeFromMemory")}
      </p>
      <p className="mt-3 text-2xl font-bold text-ink-700">
        {word.pinyin}
      </p>
      <p className="mt-1 text-lg font-medium text-ink-400">
        {meaningFor(word, lang)}
      </p>
      <div className="mt-3 flex items-center justify-center">
        <AudioButton
          audioFile={word.audioFile}
          fallbackText={word.id}
          label={t("study.listen")}
          variant="neutral"
        />
      </div>
      <p className="mt-4 text-xs font-semibold tabular-nums text-ink-300">
        {charIndex + 1} / {total}
      </p>
      <div
        className="mt-3"
        style={{
          transition: shrinking
            ? `transform ${SHRINK_DURATION_MS}ms ease-in-out, opacity ${SHRINK_DURATION_MS}ms ease-in-out`
            : "none",
          transform: shrinkTransform,
          transformOrigin: "top left",
          opacity: shrinking ? 0 : 1,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <DrawingCanvas
          key={`${word.id}:${charIndex}`}
          character={word.characters[charIndex]}
          onComplete={handleCharComplete}
          leniency={leniency}
          completedChars={completedChars}
        />
      </div>
    </div>
  );
}
