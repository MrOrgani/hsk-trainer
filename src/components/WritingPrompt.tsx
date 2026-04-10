import { useState } from "react";
import type { Grade, PromptType, Word } from "@/db/schema";
import { DrawingCanvas } from "./DrawingCanvas";
import { GradeButtons } from "./GradeButtons";
import { AudioButton } from "./AudioButton";

interface Props {
  word: Word;
  promptType: PromptType;
  onGrade: (grade: Grade) => void;
}

interface Attempt {
  mistakes: number;
}

export function WritingPrompt({ word, promptType, onGrade }: Props) {
  const [charIndex, setCharIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const total = word.characters.length;
  const phase: "drawing" | "reveal" = charIndex >= total ? "reveal" : "drawing";
  const currentChar = word.characters[charIndex];

  function handleCharComplete({ mistakes }: { mistakes: number }) {
    setAttempts((prev) => [...prev, { mistakes }]);
    setCharIndex((i) => i + 1);
  }

  return (
    <div className="text-center">
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-gold-500">
        {promptType === "audio-to-draw"
          ? "Listen and write it"
          : "Write the word"}
      </p>

      <div className="mt-5 mb-8 flex flex-col items-center gap-4 animate-pop-in">
        {promptType === "audio-to-draw" ? (
          <AudioButton
            audioFile={word.audioFile}
            fallbackText={word.id}
            label="Play audio"
          />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl card py-6 px-6">
            <p className="text-xl sm:text-2xl font-bold text-ink-800 leading-snug">
              {word.meaningEn}
            </p>
          </div>
        )}
      </div>

      {phase === "drawing" && (
        <>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-300 tabular-nums">
            Character {charIndex + 1} / {total}
          </p>
          <DrawingCanvas
            key={`${word.id}:${charIndex}`}
            character={currentChar}
            onComplete={handleCharComplete}
          />
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
        return (
        <div className="mt-2 space-y-3 animate-pop-in">
          <p className="font-hanzi text-5xl sm:text-6xl font-black text-ink-800">
            {word.id}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-ink-700">
            {word.pinyin}
          </p>
          <p className="text-base sm:text-lg font-medium text-ink-400">
            {word.meaningEn}
          </p>
          <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
            {totalMistakes === 0
              ? "Perfect strokes!"
              : `${totalMistakes} stroke mistake${totalMistakes === 1 ? "" : "s"}`}
          </p>
          <div className="pt-4">
            <GradeButtons onGrade={onGrade} />
          </div>
        </div>
        );
      })()}
    </div>
  );
}
