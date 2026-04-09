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
      <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-sky-500">
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
          <div className="mx-auto max-w-md rounded-3xl bg-white border-2 border-b-4 border-gray-200 py-10 px-6">
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-800 leading-snug">
              {word.meaningEn}
            </p>
          </div>
        )}
      </div>

      {/* Four chunky option tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
        {choices.map((c) => {
          const isCorrect = c.id === word.id;
          const isPicked = picked === c.id;
          const decided = picked !== null;

          let cls =
            "bg-white border-2 border-b-4 border-gray-200 hover:border-sky-300 hover:bg-sky-50 text-gray-800";
          if (decided) {
            if (isCorrect) {
              cls =
                "bg-green-50 border-2 border-b-4 border-green-500 text-green-700";
            } else if (isPicked) {
              cls =
                "bg-rose-50 border-2 border-b-4 border-rose-500 text-rose-700";
            } else {
              cls =
                "bg-white border-2 border-b-4 border-gray-200 text-gray-400 opacity-60";
            }
          }

          return (
            <button
              key={c.id}
              type="button"
              disabled={decided}
              onClick={() => setPicked(c.id)}
              className={`rounded-2xl py-6 sm:py-8 px-4 transition-colors duration-100 disabled:cursor-default ${cls}`}
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
          <p className="font-hanzi text-5xl sm:text-6xl font-black text-gray-800">
            {word.id}
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-700">
            {word.pinyin}
          </p>
          <p className="text-base sm:text-lg font-bold text-gray-500">
            {word.meaningEn}
          </p>
          <p className="pt-4 text-sm font-bold uppercase tracking-wider text-gray-400">
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
