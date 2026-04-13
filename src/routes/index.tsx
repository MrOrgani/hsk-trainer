import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { seedHskLevel } from "@/lib/seed";
import { getTodayState } from "@/engines/srs";
import { useSettings } from "@/state/settings-store";
import { chunky } from "@/components/Button";
import { useTranslation, meaningFor } from "@/lib/i18n";
import {
  loadWordsWithState,
  filterWords,
  STATE_COLORS,
  type WordWithState,
} from "@/lib/word-state";
import { CharacterDetailSheet } from "@/components/CharacterDetailSheet";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const settings = useSettings();
  const { t, lang } = useTranslation();
  const [seeded, setSeeded] = useState(false);
  const [search, setSearch] = useState("");
  const [allWords, setAllWords] = useState<WordWithState[]>([]);
  const [selectedWord, setSelectedWord] = useState<WordWithState | null>(null);
  const wordsLoadedRef = useRef(false);

  useEffect(() => {
    Promise.all([
      seedHskLevel(1),
      seedHskLevel(2),
      seedHskLevel(3),
      seedHskLevel(4),
      seedHskLevel(5),
      seedHskLevel(6),
      seedHskLevel(7),
    ]).then(() => setSeeded(true));
  }, []);

  const todayQuery = useQuery({
    queryKey: ["today"],
    queryFn: () => getTodayState(Date.now()),
    enabled: seeded,
  });

  const newToday = todayQuery.data?.newCardsIntroduced ?? 0;
  const newTarget = settings?.newPerDay ?? 0;

  function handleSearchFocus() {
    if (!wordsLoadedRef.current && seeded) {
      wordsLoadedRef.current = true;
      loadWordsWithState().then(setAllWords);
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    handleSearchFocus();
  }

  const filtered = search.trim() ? filterWords(allWords, search).slice(0, 20) : [];
  const isSearching = search.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-5 pt-6 sm:pt-16 pb-8">
      {/* Hero */}
      <div className="text-center animate-pop-in">
        <div className="seal-stamp h-20 w-20 sm:h-24 sm:w-24 text-vermillion-500 mb-5 animate-stamp-in mx-auto">
          <span className="font-hanzi text-4xl sm:text-5xl font-black">
            學
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-800">
          {t("home.title")}
        </h1>
        <p className="mt-2 text-ink-400 font-medium">
          {t("home.subtitle")}
        </p>
      </div>

      {/* Search bar */}
      <div className="mt-8 max-w-md mx-auto">
        <input
          type="text"
          placeholder={t("search.placeholder")}
          value={search}
          onFocus={handleSearchFocus}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full rounded-xl border border-ink-200 bg-paper px-4 py-3 text-ink-800 font-medium placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-vermillion-300"
        />
      </div>

      {isSearching ? (
        /* Search results */
        <div className="mt-4 space-y-2 max-w-md mx-auto pb-8">
          {filtered.map((item) => (
            <button
              key={item.word.id}
              type="button"
              onClick={() => setSelectedWord(item)}
              className="w-full rounded-xl card px-4 py-3 flex items-center gap-4 text-left hover:shadow-lg transition-shadow"
            >
              <span className="font-hanzi text-2xl font-black text-ink-800 min-w-[3rem]">
                {item.word.id}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-700 truncate">
                  {item.word.pinyin}
                </p>
                <p className="text-xs text-ink-400 truncate">
                  {meaningFor(item.word, lang)}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${STATE_COLORS[item.state]}`}
              >
                {item.state === "unseen" ? "new" : item.state}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-8 text-ink-300 font-medium">
              {t("search.noResults")}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Stat pill */}
          <div className="mt-6 max-w-xs mx-auto">
            <div className="rounded-xl card p-4 sm:p-5 text-center">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-300">
                {t("home.newToday")}
              </p>
              <p className="mt-1 text-4xl sm:text-5xl font-black tabular-nums text-jade-500">
                {newToday}
                <span className="text-2xl sm:text-3xl text-ink-200"> / {newTarget}</span>
              </p>
              <p className="mt-1 text-xs font-medium text-ink-300">{t("home.introduced")}</p>
            </div>
          </div>

          {/* Big CTA card */}
          <div className="mt-8 rounded-2xl card p-6 sm:p-8 text-center">
            <p className="font-display text-jade-500 text-3xl sm:text-4xl mb-2">
              开始吧
            </p>
            <p className="text-ink-500 font-medium mb-5">
              {t("home.addNewCharacters")}
            </p>
            <Link to="/study" className={chunky("info", "w-full")}>
              {t("home.addNewCharacters")}
            </Link>
          </div>
        </>
      )}

      {selectedWord && (
        <CharacterDetailSheet
          word={selectedWord.word}
          state={selectedWord.state}
          bestCard={selectedWord.bestCard}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
