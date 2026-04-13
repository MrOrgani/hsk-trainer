// Persistent domain types. See spec §5.

export type PromptType =
  | "recognition"
  | "audio-to-word"
  | "meaning-to-word"
  | "audio-to-draw"     // Plan 2
  | "meaning-to-draw";  // Plan 2

export type CardState = "new" | "learning" | "review" | "suspended";

export type Grade = "again" | "hard" | "good" | "easy";

export interface Word {
  id: string;                 // e.g. "你好"
  hskLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  characters: string[];
  pinyin: string;
  pinyinNumeric: string;
  meaningEn: string;
  meaningFr: string;
  frequency: number;
  audioFile: string;          // filename in /audio/, ASCII slug
  examples?: Array<{
    text: string;
    pinyin: string;
    meaningEn: string;
    meaningFr: string;
  }>;
}

export interface SrsCard {
  id: string;                 // `${wordId}::${promptType}`
  wordId: string;
  promptType: PromptType;
  state: CardState;
  learningStep: number;       // index into settings.learningSteps when state=learning
  interval: number;           // days until next review (review state)
  easeFactor: number;         // SM-2 ease, starts at 2.5
  repetitions: number;
  dueDate: number;            // epoch ms
  lastReview: number | null;
  createdAt: number;
}

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Settings {
  id: "default";
  uiLanguage: "fr" | "en";
  hskLevel: HskLevel;
  leniency: "strict" | "lenient-order";
  newPerDay: number;
  enabledPromptTypes: PromptType[];
  learningSteps: number[];    // minutes
  audioAutoplay: boolean;
  theme: "light" | "dark" | "auto";
}

export interface DailyState {
  date: string;               // "YYYY-MM-DD" (local)
  newCardsIntroduced: number;
  reviewsCompleted: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "default",
  uiLanguage: "en",
  hskLevel: 1,
  leniency: "strict",
  newPerDay: 10,
  enabledPromptTypes: [
    "recognition",
    "audio-to-word",
    "meaning-to-word",
    "audio-to-draw",
    "meaning-to-draw",
  ],
  learningSteps: [1, 10],
  audioAutoplay: true,
  theme: "auto",
};
