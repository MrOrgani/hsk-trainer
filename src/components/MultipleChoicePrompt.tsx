import { useEffect, useMemo, useState } from "react";
import { db } from "@/db/dexie";
import type { Grade, PromptType, Word } from "@/db/schema";
import { GradeButtons } from "./GradeButtons";
import { AudioButton } from "./AudioButton";

interface Props {
  word: Word;
  promptType: PromptType;
  onGrade: (grade: Grade) => void;
}

const KICKER: Record<string, string> = {
  "audio-to-word": "Tap to listen",
  "meaning-to-word": "Which one means…",
};

export function MultipleChoicePrompt({ word, promptType, onGrade }: Props) {
  const [distractors, setDistractors] = useState<Word[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const pool = await db.words
        .where("hskLevel")
        .equals(word.hskLevel)
        .and((w) => w.id !== word.id)
        .limit(50)
        .toArray();
      const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);
      setDistractors(shuffled);
      setPicked(null);
    })();
  }, [word.id, word.hskLevel]);

  const choices = useMemo(() => {
    const all = [word, ...distractors];
    return all.sort(() => Math.random() - 0.5);
  }, [word, distractors]);

  const kicker = KICKER[promptType] ?? "";

  return (
    <div className="text-center">
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-gold-500">
        {kicker}
      </p>

      {/* Prompt */}
      <div className="mt-6 mb-10 animate-pop-in">
        {promptType === "audio-to-word" ? (
          <AudioButton
            audioFile={word.audioFile}
            fallbackText={word.id}
            label="Play audio"
          />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl card py-10 px-6">
            <p className="text-2xl sm:text-3xl font-bold text-ink-800 leading-snug">
              {word.meaningEn}
            </p>
          </div>
        )}
      </div>

      {/* Four option tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
        {choices.map((c) => {
          const isCorrect = c.id === word.id;
          const isPicked = picked === c.id;
          const decided = picked !== null;

          let cls =
            "bg-paper border border-ink-100/50 shadow-card hover:shadow-card-hover hover:border-gold-300 text-ink-800";
          if (decided) {
            if (isCorrect) {
              cls =
                "bg-jade-50 border-2 border-jade-500 shadow-glow-jade text-jade-700";
            } else if (isPicked) {
              cls =
                "bg-vermillion-50 border-2 border-vermillion-500 shadow-glow-vermillion text-vermillion-700";
            } else {
              cls =
                "bg-paper border border-ink-100/50 text-ink-300 opacity-50";
            }
          }

          return (
            <button
              key={c.id}
              type="button"
              disabled={decided}
              onClick={() => setPicked(c.id)}
              className={`rounded-xl py-6 sm:py-8 px-4 transition-all duration-150 disabled:cursor-default ${cls}`}
            >
              <span
                className="font-hanzi text-3xl sm:text-4xl font-black"
              >
                {c.id}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reveal + grade */}
      {picked && (
        <div className="mt-10 space-y-3 animate-pop-in">
          <p className="font-hanzi text-5xl sm:text-6xl font-black text-ink-800">
            {word.id}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-ink-700">
            {word.pinyin}
          </p>
          <p className="text-base sm:text-lg font-medium text-ink-400">
            {word.meaningEn}
          </p>
          <p className="pt-4 text-sm font-semibold uppercase tracking-wider text-ink-300">
            {picked === word.id ? "Nice! How well did you know it?" : "Not quite — let's try again"}
          </p>
          <div className="pt-2">
            <GradeButtons
              onGrade={(grade) => {
                const wasCorrect = picked === word.id;
                onGrade(wasCorrect ? grade : "again");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
