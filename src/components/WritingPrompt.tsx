import { useState } from "react";
import type { Grade, PromptType, Word } from "@/db/schema";
import { DrawingCanvas } from "./DrawingCanvas";
import { GradeButtons } from "./GradeButtons";
import { AudioButton } from "./AudioButton";

interface Props {
  word: Word;
  promptType: PromptType; // "audio-to-draw" | "meaning-to-draw"
  onGrade: (grade: Grade) => void;
}

interface Attempt {
  mistakes: number;
}

/**
 * Multi-character writing flow for review sessions.
 *
 * State machine (`phase`):
 *   "drawing"  → rendering DrawingCanvas for `word.characters[charIndex]`
 *   "reveal"   → all characters drawn, show answer + GradeButtons
 */
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
      <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-sky-500">
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
          <div className="mx-auto max-w-md rounded-3xl bg-white border-2 border-b-4 border-gray-200 py-6 px-6">
            <p className="text-xl sm:text-2xl font-extrabold text-gray-800 leading-snug">
              {word.meaningEn}
            </p>
          </div>
        )}
      </div>

      {phase === "drawing" && (
        <>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-gray-400 tabular-nums">
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
                className={`h-2 w-6 rounded-full ${
                  i < charIndex
                    ? "bg-green-500"
                    : i === charIndex
                    ? "bg-sky-400"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {phase === "reveal" && (
        <div className="mt-2 space-y-3 animate-pop-in">
          <p className="font-hanzi text-5xl sm:text-6xl font-black text-gray-800">
            {word.id}
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-700">
            {word.pinyin}
          </p>
          <p className="text-base sm:text-lg font-bold text-gray-500">
            {word.meaningEn}
          </p>
          <p className="pt-2 text-xs font-bold uppercase tracking-wider text-gray-400">
            {attempts.every((a) => a.mistakes === 0)
              ? "Perfect strokes!"
              : `${attempts.reduce((s, a) => s + a.mistakes, 0)} stroke mistakes`}
          </p>
          <div className="pt-4">
            <GradeButtons onGrade={onGrade} />
          </div>
        </div>
      )}
    </div>
  );
}
