import { useEffect } from "react";
import type { Word, CardState } from "@/db/schema";
import type { BestCard } from "@/lib/word-state";
import { STATE_COLORS, getMaturity, MATURITY_TILE_COLORS } from "@/lib/word-state";
import { AudioButton } from "@/components/AudioButton";
import { useTranslation, meaningFor } from "@/lib/i18n";

interface CharacterDetailSheetProps {
  word: Word;
  state: CardState | "unseen";
  bestCard: BestCard | null;
  onClose: () => void;
}

import type { TranslationKey } from "@/lib/i18n";

function formatRelativeDate(dueDate: number, t: (key: TranslationKey) => string): string {
  const now = Date.now();
  const diffMs = dueDate - now;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return t("detail.overdue");
  if (diffDays === 0) return t("detail.today");
  if (diffDays === 1) return `1 ${t("detail.day")}`;
  return `${diffDays} ${t("detail.days")}`;
}

export function CharacterDetailSheet({
  word,
  state,
  bestCard,
  onClose,
}: CharacterDetailSheetProps) {
  const { t, lang } = useTranslation();
  const maturity = getMaturity(bestCard);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const stateLabel = state === "unseen" ? "new" : state;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-paper p-6 pb-8 animate-pop-in max-h-[80vh] overflow-y-auto">
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 rounded-full bg-ink-200 mx-auto mb-5 sm:hidden" />

        {/* Character */}
        <p className="font-hanzi text-6xl font-black text-ink-800 text-center">
          {word.id}
        </p>

        {/* Pinyin + meaning */}
        <p className="mt-3 text-lg font-semibold text-ink-600 text-center">
          {word.pinyin}
        </p>
        <p className="mt-1 text-base font-medium text-ink-400 text-center">
          {meaningFor(word, lang)}
        </p>

        {/* Audio */}
        <div className="mt-4 flex justify-center">
          <AudioButton
            audioFile={word.audioFile}
            fallbackText={word.id}
            label={t("common.playAudio")}
            variant="button"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-ink-100 my-5" />

        {/* State + maturity */}
        <div className="flex items-center justify-center gap-3">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${STATE_COLORS[state]}`}
          >
            {stateLabel}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-400">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-sm ${MATURITY_TILE_COLORS[maturity]}`}
            />
            {t(`stats.maturity${maturity.charAt(0).toUpperCase()}${maturity.slice(1)}` as TranslationKey)}
          </span>
        </div>

        {/* Review info */}
        {bestCard && bestCard.dueDate > 0 && (
          <div className="mt-4 text-center space-y-1">
            <p className="text-xs font-semibold text-ink-300 uppercase tracking-wider">
              {t("detail.nextReview")}
            </p>
            <p className="text-sm font-bold text-ink-600">
              {formatRelativeDate(bestCard.dueDate, t)}
            </p>
            {bestCard.interval >= 1 && (
              <p className="text-xs text-ink-300">
                {t("detail.interval")}: {Math.round(bestCard.interval)} {t("detail.days")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
