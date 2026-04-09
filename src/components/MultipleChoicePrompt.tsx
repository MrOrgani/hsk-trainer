import { useEffect, useMemo, useState } from "react";
import { db } from "@/db/dexie";
import type { Grade, PromptType, Word } from "@/db/schema";
import { GradeButtons } from "./GradeButtons";

interface Props {
  word: Word;
  promptType: PromptType;
  onGrade: (grade: Grade) => void;
}

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

  function playAudio() {
    const audio = new Audio(`/audio/${word.audioFile}`);
    audio.play().catch(() => {
      // Expected during MVP: files not yet generated.
    });
  }

  const prompt =
    promptType === "audio-to-word" ? (
      <button
        type="button"
        onClick={playAudio}
        className="rounded border border-slate-300 px-4 py-2"
      >
        ▶ Play audio
      </button>
    ) : (
      <div className="text-2xl">{word.meaningEn}</div>
    );

  return (
    <div className="rounded border bg-white p-6 text-center space-y-6">
      {prompt}
      <div className="grid grid-cols-2 gap-2">
        {choices.map((c) => {
          const isCorrect = c.id === word.id;
          const isPicked = picked === c.id;
          let cls = "rounded border px-3 py-3 text-lg";
          if (picked !== null) {
            if (isCorrect) cls += " bg-emerald-100 border-emerald-500";
            else if (isPicked) cls += " bg-rose-100 border-rose-500";
            else cls += " opacity-60";
          } else {
            cls += " hover:bg-slate-100";
          }
          return (
            <button
              key={c.id}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(c.id)}
              className={cls}
            >
              {c.id}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="space-y-2">
          <div className="text-slate-600">{word.pinyin} — {word.meaningEn}</div>
          <GradeButtons
            onGrade={(grade) => {
              const wasCorrect = picked === word.id;
              onGrade(wasCorrect ? grade : "again");
            }}
          />
        </div>
      )}
    </div>
  );
}
