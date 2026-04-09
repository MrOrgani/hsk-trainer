import { useState } from "react";
import type { Grade, Word } from "@/db/schema";
import { GradeButtons } from "./GradeButtons";

interface Props {
  word: Word;
  onGrade: (grade: Grade) => void;
}

export function RecognitionPrompt({ word, onGrade }: Props) {
  const [revealed, setRevealed] = useState(false);

  function handleGrade(grade: Grade) {
    setRevealed(false);
    onGrade(grade);
  }

  return (
    <div className="rounded border bg-white p-6 text-center space-y-6">
      <div className="text-6xl font-serif tracking-wide">{word.id}</div>
      {revealed ? (
        <div className="space-y-2">
          <div className="text-lg">{word.pinyin}</div>
          <div className="text-slate-600">{word.meaningEn}</div>
          <GradeButtons onGrade={handleGrade} />
        </div>
      ) : (
        <button
          type="button"
          className="rounded border border-slate-300 px-4 py-2"
          onClick={() => setRevealed(true)}
        >
          Show answer
        </button>
      )}
    </div>
  );
}
