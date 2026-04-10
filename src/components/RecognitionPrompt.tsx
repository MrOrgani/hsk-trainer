import { useState, useEffect } from "react";
import type { Grade, Word } from "@/db/schema";
import { GradeButtons } from "./GradeButtons";
import { chunky } from "./Button";
import { useTranslation, meaningFor } from "@/lib/i18n";

interface Props {
  word: Word;
  onGrade: (grade: Grade) => void;
}

export function RecognitionPrompt({ word, onGrade }: Props) {
  const { t, lang } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [word.id]);

  function handleGrade(grade: Grade) {
    setRevealed(false);
    onGrade(grade);
  }

  return (
    <div className="text-center">
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-gold-500">
        {t("prompt.whatDoesThisMean")}
      </p>

      {/* The big character card */}
      <div
        key={word.id}
        className="mt-6 mx-auto max-w-md rounded-2xl card py-12 sm:py-16 px-6 animate-pop-in"
      >
        <div
          className="font-hanzi text-ink-800 leading-none text-[7rem] sm:text-[9rem]"
          style={{ fontWeight: 700 }}
        >
          {word.id}
        </div>
      </div>

      {revealed ? (
        <div className="mt-8 space-y-4 animate-pop-in">
          <p className="text-2xl sm:text-3xl font-bold text-ink-800">
            {word.pinyin}
          </p>
          <p className="text-lg sm:text-xl font-medium text-ink-400">
            {meaningFor(word, lang)}
          </p>
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-300 pt-2">
            {t("prompt.howWellDidYouKnow")}
          </p>
          <div className="pt-2">
            <GradeButtons onGrade={handleGrade} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className={chunky("primary", "mt-10")}
        >
          {t("prompt.showAnswer")}
        </button>
      )}
    </div>
  );
}
