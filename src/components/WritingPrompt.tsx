import { useCallback, useEffect, useRef, useState } from "react";
import type { Grade, PromptType, Word } from "@/db/schema";
import { DrawingCanvas, masteryColor } from "./DrawingCanvas";
import type { CompletedChar } from "./DrawingCanvas";
import { AudioButton } from "./AudioButton";
import { useTranslation, meaningFor } from "@/lib/i18n";

function computeGrade(mistakes: number): Grade {
  if (mistakes === 0) return "easy";
  if (mistakes <= 3) return "good";
  if (mistakes <= 6) return "hard";
  return "again";
}

function gradeBadgeColor(grade: Grade): string {
  switch (grade) {
    case "easy": return "bg-jade-500 text-white";
    case "good": return "bg-jade-400 text-white";
    case "hard": return "bg-gold-500 text-white";
    case "again": return "bg-vermillion-500 text-white";
  }
}

const AUTO_ADVANCE_MS = 2500;

interface Props {
  word: Word;
  promptType: PromptType;
  onGrade: (grade: Grade) => void;
  leniency?: "strict" | "lenient-order";
  repetitions?: number;
}

interface Attempt {
  mistakes: number;
}

/** Hide outline once the card has been reviewed enough times (3+ reps = from memory) */
const OUTLINE_THRESHOLD = 3;

const VIEWING_DELAY_MS = 1500;
const SHRINK_DURATION_MS = 400;

interface AutoGradeRevealProps {
  word: Word;
  lang: "en" | "fr";
  t: (key: import("@/lib/i18n").TranslationKey) => string;
  totalMistakes: number;
  autoGrade: Grade;
  gradeLabel: string;
  onGrade: (grade: Grade) => void;
}

function AutoGradeReveal({ word, lang, t, totalMistakes, autoGrade, gradeLabel, onGrade }: AutoGradeRevealProps) {
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calledRef = useRef(false);

  const advance = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    onGrade(autoGrade);
  }, [autoGrade, onGrade]);

  useEffect(() => {
    advanceTimerRef.current = setTimeout(advance, AUTO_ADVANCE_MS);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [advance]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="mt-2 space-y-3 animate-pop-in cursor-pointer" onClick={advance}>
      <p className="font-hanzi text-5xl sm:text-6xl font-black text-ink-800">
        {word.id}
      </p>
      <p className="text-xl sm:text-2xl font-bold text-ink-700">
        {word.pinyin}
      </p>
      <p className="text-base sm:text-lg font-medium text-ink-400">
        {meaningFor(word, lang)}
      </p>
      <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
        {totalMistakes === 0
          ? t("prompt.perfectStrokes")
          : (totalMistakes === 1
              ? t("prompt.strokeMistake")
              : t("prompt.strokeMistakes")
            ).replace("{count}", String(totalMistakes))}
      </p>
      <div className="pt-4 flex flex-col items-center gap-2">
        <span
          className={`inline-block rounded-full px-5 py-2 text-sm font-bold ${gradeBadgeColor(autoGrade)}`}
          style={{ backgroundColor: masteryColor(totalMistakes) }}
        >
          {gradeLabel}
        </span>
        <p className="text-xs text-ink-300 animate-pulse">
          {t("review.tapToContinue")}
        </p>
      </div>
    </div>
  );
}

export function WritingPrompt({ word, promptType, onGrade, leniency = "strict", repetitions = 0 }: Props) {
  const { t, lang } = useTranslation();
  const [charIndex, setCharIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [shrinking, setShrinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = word.characters.length;
  const isMultiChar = total > 1;
  const phase: "drawing" | "reveal" = charIndex >= total ? "reveal" : "drawing";
  const currentChar = word.characters[charIndex];

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const advanceChar = useCallback(() => {
    setShrinking(false);
    setCharIndex((i) => i + 1);
  }, []);

  function handleCharComplete({ mistakes, strokeMistakes: _strokeMistakes }: { mistakes: number; strokeMistakes: number[] }) {
    setAttempts((prev) => [...prev, { mistakes }]);

    const isLastChar = charIndex >= total - 1;

    if (!isMultiChar || isLastChar) {
      // Single char word or last char: just delay then advance
      
      timerRef.current = setTimeout(() => {
        advanceChar();
      }, VIEWING_DELAY_MS);
    } else {
      // Non-last char of multi-char word: delay, then shrink, then advance
      
      timerRef.current = setTimeout(() => {
        setShrinking(true);
      }, VIEWING_DELAY_MS);
    }
  }

  function handleTransitionEnd(e: React.TransitionEvent) {
    // Two properties animate (transform + opacity), so transitionend fires twice.
    // Only react to the first one to avoid advancing charIndex twice.
    if (shrinking && e.propertyName !== "opacity") {
      advanceChar();
    }
  }

  // Build completedChars with mastery info
  const completedChars: CompletedChar[] = word.characters
    .slice(0, charIndex)
    .map((char, i) => ({
      char,
      mistakes: attempts[i]?.mistakes ?? 0,
    }));

  // Canvas size for calculations
  const canvasSize = 260;

  // Shrink transform: scale down to corner char size and translate to corner position
  const shrinkScale = 0.13;
  // Target position: top-left corner, offset by completed chars count
  // Each corner char is ~canvasSize*0.13 wide, plus small gap
  const cornerCharWidth = canvasSize * 0.13;
  const targetX = 8 + charIndex * (cornerCharWidth + 2); // left-2 = 8px, gap-0.5 = 2px
  const targetY = 6; // top-1.5 = 6px
  // Since transformOrigin is top-left, we translate to the target position
  // But the canvas is centered (mx-auto), so we need to account for that
  // The transform origin is top-left of the canvas wrapper
  const shrinkTransform = shrinking
    ? `scale(${shrinkScale}) translate(${targetX / shrinkScale - 0}px, ${targetY / shrinkScale}px)`
    : "scale(1) translate(0, 0)";

  return (
    <div className="text-center">
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-gold-500">
        {promptType === "audio-to-draw"
          ? t("prompt.listenAndWrite")
          : t("prompt.writeTheWord")}
      </p>

      <div className="mt-5 mb-8 flex flex-col items-center gap-4 animate-pop-in">
        {promptType === "audio-to-draw" ? (
          <AudioButton
            audioFile={word.audioFile}
            fallbackText={word.id}
            label={t("common.playAudio")}
          />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl card py-6 px-6">
            <p className="text-xl sm:text-2xl font-bold text-ink-800 leading-snug">
              {meaningFor(word, lang)}
            </p>
          </div>
        )}
      </div>

      {phase === "drawing" && (
        <>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-300 tabular-nums">
            {t("prompt.character")} {charIndex + 1} / {total}
          </p>
          <div
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
              character={currentChar}
              onComplete={handleCharComplete}
              leniency={leniency}
              showOutline={repetitions < OUTLINE_THRESHOLD}
              completedChars={completedChars}
            />
          </div>
          <div
            className="mt-5 flex items-center justify-center gap-2"
            aria-label="progress"
          >
            {word.characters.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-6 rounded-full transition-colors ${
                  i < charIndex
                    ? "bg-jade-500"
                    : i === charIndex
                    ? "bg-gold-400"
                    : "bg-ink-200"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {phase === "reveal" && (() => {
        const totalMistakes = attempts.reduce((s, a) => s + a.mistakes, 0);
        const autoGrade = computeGrade(totalMistakes);
        const mistakeUnit = totalMistakes === 1 ? t("review.mistake") : t("review.mistakes");
        const gradeLabel =
          autoGrade === "easy"
            ? t("review.autoGradeEasy")
            : autoGrade === "good"
            ? t("review.autoGradeGood").replace("{count}", String(totalMistakes)).replace("{unit}", mistakeUnit)
            : autoGrade === "hard"
            ? t("review.autoGradeHard").replace("{count}", String(totalMistakes)).replace("{unit}", mistakeUnit)
            : t("review.autoGradeAgain").replace("{count}", String(totalMistakes)).replace("{unit}", mistakeUnit);
        return (
        <AutoGradeReveal
          word={word}
          lang={lang}
          t={t}
          totalMistakes={totalMistakes}
          autoGrade={autoGrade}
          gradeLabel={gradeLabel}
          onGrade={onGrade}
        />
        );
      })()}
    </div>
  );
}
