# HSK Trainer — Design Spec

**Date:** 2026-04-09
**Status:** Draft for review

## 1. Problem & Goals

Build a personal web app to study and retain Chinese vocabulary across New HSK 3.0 levels 1-9 (~11,000 words). The app must:

- Let the user pick an HSK level and browse its words
- Play accurate tone-correct pronunciation audio on demand
- Let the user draw each word character-by-character in a canvas and verify the stroke order
- Schedule long-term review via a Spaced Repetition System (SM-2)
- Mix recognition and writing prompts in a configurable session format
- Work on both desktop and mobile, offline-capable, bilingual French/English UI

**Non-goals:** multi-user accounts, social features, cloud sync (v1), traditional characters, handwriting OCR beyond what `hanzi-writer` provides.

## 2. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | New HSK 3.0, levels 1-9, **word-based** (~11k entries) | HSK 3.0 is defined by words, not characters |
| Unit of study | Word (1-4 characters per entry) | Matches HSK syllabus; writing = draw each char in sequence |
| SRS algorithm | SM-2 | Proven, simple, matches user preference |
| SRS card identity | `(wordId, promptType)` composite | Fixes multi-prompt-type scheduling flaw (Anki-style) |
| Writing verification | `hanzi-writer` quiz mode, per character | Handles stroke-level grading natively |
| Leniency modes | `strict`, `lenient-order` | `shape-match` dropped (out of scope for hanzi-writer quiz API) |
| Audio | Pre-generated MP3s, bundled upfront | ~1,300 unique syllable+tone files OR per-word TTS (see §6) |
| Storage | IndexedDB (Dexie), JSON export/import | Local-only v1, no backend |
| Tech stack | TanStack Router + Vite + TanStack Query + TanStack Form + React + TypeScript + Tailwind + Zustand + Dexie + hanzi-writer + Workbox + i18next | TanStack Start downgraded to Router since no SSR needed |
| Platform | Webapp, mobile-responsive, PWA (offline) | Commute-friendly |
| i18n | French + English, i18next from day one | User is French; both requested |

## 3. High-Level Architecture

Single-page PWA, 100% client-side. No backend. Build-time data pipeline generates static JSON and audio assets. Service worker caches everything for offline use.

```
┌────────────────────────────────────────────────┐
│  React + TanStack Router (Vite)                │
│                                                │
│  ┌─────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Routes  │  │  State   │  │    Engines    │ │
│  │         │  │          │  │               │ │
│  │ /       │  │ TStack Q │  │ • SRS (SM-2)  │ │
│  │ /browse │  │ (data)   │  │ • Writing     │ │
│  │ /study  │◄─┤ Zustand  │◄─┤   grader      │ │
│  │ /review │  │ (UI)     │  │ • Session     │ │
│  │ /stats  │  │          │  │   builder     │ │
│  │ /settings│  │          │  │ • Audio      │ │
│  └─────────┘  └──────────┘  └───────────────┘ │
│        │             │              │         │
│        └─────────────┼──────────────┘         │
│                      ▼                         │
│  ┌──────────────────────────────────────────┐ │
│  │ Storage (Dexie / IndexedDB)              │ │
│  │ words · srsCards · reviewLog · settings  │ │
│  └──────────────────────────────────────────┘ │
│                      ▲                         │
│  ┌──────────────────────────────────────────┐ │
│  │ Static Assets (served + SW-cached)       │ │
│  │ /data/hsk-{1..9}.json                    │ │
│  │ /data/strokes/<char>.json                │ │
│  │ /audio/<wordId>.mp3                      │ │
│  │ /locales/{fr,en}.json                    │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

## 4. Screens

### 4.1 Home (`/`)
- Today's due count (from SRS queue)
- CTA: "Start review" (if cards due), "Study new words" (level picker)
- Mini-stats: streak, total learned, weekly accuracy
- Language toggle (FR/EN)

### 4.2 Browse (`/browse`)
- Sidebar: HSK 1-9 level picker (desktop) / top segmented control (mobile)
- Grid of word cards: simplified chars, pinyin, French/English gloss
- Filter: all / learned / unlearned / due
- Click card → detail view: large chars, audio button, per-char stroke animation, example sentences, "add to SRS" button

### 4.3 Study (`/study`)
Introduces new words into the SRS queue.

Flow for each new word:
1. **Present** — show word + pinyin + meaning; auto-play audio
2. **Animate** — play stroke animation for each character via `hanzi-writer`
3. **First attempt** — one writing prompt (audio → draw) using the word's configured leniency
4. **Commit** — create `srsCard` rows for each enabled `(wordId, promptType)` combination in state `learning` with initial interval from learning-step settings
5. **Graduate** — after the user has answered correctly at both learning steps (e.g., 1 min, 10 min intra-day), card transitions to `review` state

### 4.4 Review (`/review`)
Pulls due cards from the SRS queue. Each card corresponds to a specific `(wordId, promptType)`.

**Prompt types** (enabled subset controlled in Settings):
| Type | Prompt | Answer |
|---|---|---|
| `recognition` | Show word (characters only) | Recall pinyin + meaning, self-grade |
| `audio-to-word` | Play audio | Pick correct word from 4 choices |
| `meaning-to-word` | Show gloss (FR or EN) | Pick correct word from 4 choices |
| `audio-to-draw` | Play audio | Draw each character in sequence |
| `meaning-to-draw` | Show gloss | Draw each character in sequence |

After each answer: show correct answer + audio + Again/Hard/Good/Easy buttons → SM-2 updates the card.

**Session builder** composes a queue from due cards, respecting `sessionMix` ratios (recognition vs writing vs audio), capped at `sessionSize`.

**Writing verification:** for multi-character words, `hanzi-writer` quiz runs per character. Card's final grade combines per-character strokeAccuracy (average) with user self-grade.

### 4.5 Stats (`/stats`)
- Heatmap calendar (daily review count, Anki-style)
- Retention rate per HSK level
- Total words: learning / mature / suspended
- Per-prompt-type accuracy (computed on-the-fly from `reviewLog`)
- Export/import JSON backup

### 4.6 Settings (`/settings`)
- UI language (FR / EN)
- Leniency (strict / lenient-order)
- Session size, session mix percentages, enabled prompt types
- New words per day cap
- Audio autoplay toggle
- Theme (light / dark / auto)
- Learning steps (default: 1m, 10m)

## 5. Data Model (Dexie / IndexedDB)

### `words`
Seeded on first launch from bundled JSON files, read-mostly.

```ts
interface Word {
  id: string;              // canonical form, e.g. "电脑"
  hskLevel: 1|2|3|4|5|6|7|8|9;
  characters: string[];    // ["电", "脑"]
  pinyin: string;          // "diànnǎo"
  pinyinNumeric: string;   // "dian4nao3" (for filename + tone parsing)
  meaningEn: string;       // "computer"
  meaningFr: string;       // "ordinateur"
  frequency: number;       // usage rank, lower = more common
  examples: Array<{
    text: string;
    pinyin: string;
    meaningEn: string;
    meaningFr: string;
  }>;
}
```

### `srsCards`
**One row per `(wordId, promptType)` pair.** This is the key fix from the design review — multi-prompt-type learning requires independent SM-2 state per trace.

```ts
type PromptType =
  | "recognition"
  | "audio-to-word"
  | "meaning-to-word"
  | "audio-to-draw"
  | "meaning-to-draw";

type CardState = "new" | "learning" | "review" | "suspended";

interface SrsCard {
  id: string;              // `${wordId}::${promptType}` — composite
  wordId: string;
  promptType: PromptType;
  state: CardState;
  learningStep: number;    // index into settings.learningSteps when state=learning
  interval: number;        // days until next review (review state)
  easeFactor: number;      // SM-2 ease, starts at 2.5
  repetitions: number;     // consecutive correct count
  dueDate: number;         // epoch ms
  lastReview: number | null;
  createdAt: number;
}
```

### `reviewLog`
Append-only. Drives stats and heatmap. Per-type accuracy is derived from this table — not cached in `srsCards`.

```ts
interface ReviewLog {
  id?: number;             // auto-increment
  cardId: string;          // `${wordId}::${promptType}`
  wordId: string;
  promptType: PromptType;
  timestamp: number;
  grade: "again" | "hard" | "good" | "easy";
  timeTakenMs: number;
  writingDetails?: {
    perCharacterAccuracy: number[];  // 0..1 per character in the word
    strokeMistakes: number;          // total strokes redrawn
    leniency: "strict" | "lenient-order";
  };
  multipleChoiceDetails?: {
    wrongSelectionsBeforeCorrect: number;
  };
}
```

### `settings`
Singleton row, id = `"default"`.

```ts
interface Settings {
  id: "default";
  uiLanguage: "fr" | "en";
  leniency: "strict" | "lenient-order";
  sessionMix: {
    recognition: number;    // 0..1
    writing: number;
    audioChoice: number;
  };
  sessionSize: number;      // default 20
  newPerDay: number;        // default 10
  enabledPromptTypes: PromptType[];
  learningSteps: number[];  // minutes, default [1, 10]
  audioAutoplay: boolean;
  theme: "light" | "dark" | "auto";
}
```

### Indexes
- `srsCards`: by `dueDate`, by `wordId`, by `state`
- `reviewLog`: by `timestamp`, by `wordId`
- `words`: by `hskLevel`, by `frequency`

## 6. Static Assets & Data Pipeline

### Asset layout
```
public/
  data/
    hsk-1.json        # [{id, characters, pinyin, ...}, ...]
    hsk-2.json
    ...
    hsk-9.json
    strokes/
      <char>.json     # hanzi-writer data, one per unique character
    missing-chars.json  # validation output, flags chars without stroke data
  audio/
    <wordId>.mp3      # per-word TTS, natural prosody preserved
  locales/
    fr.json
    en.json
```

**Audio decision:** per-word TTS (one MP3 per HSK 3.0 entry, ~11k files). Rationale: natural prosody for multi-character words is much better than concatenating per-syllable audio, and total size at 32 kbps mono (~15 KB/file average) is ~150-200 MB — acceptable for a PWA that caches to device once. If this proves too large at build time, we fall back to per-syllable audio (~1,300 files, ~5 MB) and sequence them at runtime.

### Build pipeline (`scripts/build-data.ts`)
1. **Fetch** HSK 3.0 word list from `krmanik/HSK-3.0` repo (vendored as a git submodule or committed snapshot)
2. **Merge** with CC-CEDICT for pinyin + English meanings; fall back to source list for gaps
3. **Translate** English glosses to French via a one-shot LLM pass, manually spot-checked; committed as part of the dataset
4. **Split** into `hsk-1.json` … `hsk-9.json`
5. **Extract** unique characters from all words; download each character's stroke data from the hanzi-writer CDN / Make Me A Hanzi dataset into `public/data/strokes/`
6. **Validate**: cross-check every character in every word against the downloaded stroke set. Write any missing chars to `missing-chars.json` and exclude affected words from the final shipped JSON — loudly logged at build time
7. **Generate audio**: batch TTS (Azure Neural or Google Cloud TTS, Mandarin voice) for each word. Cache output in repo (`public/audio/`) so it's built once and not regenerated on every build

The build script is idempotent: re-running it only processes new or changed entries.

## 7. Engines

### 7.1 SRS engine (`src/engines/srs.ts`)
Pure TypeScript, no React. Implements SM-2:

```ts
interface SrsGrade { ease: "again" | "hard" | "good" | "easy"; }
function schedule(card: SrsCard, grade: SrsGrade, now: number): SrsCard
function getDueCards(now: number): Promise<SrsCard[]>  // via Dexie
function introduceNewCard(wordId: string, promptType: PromptType): Promise<SrsCard>
```

Handles learning-step progression: cards in `learning` state advance through `settings.learningSteps` on Good/Easy, reset to step 0 on Again, then graduate to `review` when all steps pass.

### 7.2 Writing grader (`src/engines/grader.ts`)
Thin wrapper around `hanzi-writer` quiz mode. For a word, runs a quiz per character and collects per-character accuracy. Leniency:
- `strict` — stroke order enforced (hanzi-writer default)
- `lenient-order` — intercept `onMistake`; accept any stroke that matches an unused stroke in the character

### 7.3 Session builder (`src/engines/session.ts`)
Given `settings` and current due cards, composes an ordered queue of prompts respecting the mix ratios and `sessionSize` cap. Mixes new cards (up to `newPerDay`) with review cards.

### 7.4 Audio player (`src/engines/audio.ts`)
Preloads next prompt's audio. Uses the Web Audio API via a thin `<audio>` element fallback for PWA offline. Controlled by `settings.audioAutoplay`.

## 8. State Management

- **TanStack Query** — all async data: words per level, due cards, stats aggregations. Query keys namespaced by HSK level and date.
- **Zustand** — ephemeral UI state: current session queue position, current drawing-in-progress, modal open/close.
- **Dexie live queries** — for reactive updates of due counts on the Home screen.

## 9. Error Handling

- **Missing stroke data for a character** — handled at build time (word excluded). Runtime should never encounter this, but if it does (data corruption), the writing prompt for that word is disabled and a toast surfaces the error.
- **Audio file missing** — fall back to browser `SpeechSynthesis` with `zh-CN` locale. Log a warning; do not block the prompt.
- **IndexedDB unavailable** (private mode, storage full) — show a blocking error screen explaining the app needs local storage; offer to export current state if any.
- **SRS corruption** (invalid interval, NaN easeFactor) — defensive clamp in scheduler; any card with invalid state is reset to `new`.
- **PWA update** — show a "new version available" toast; user must confirm to reload.
- **Import/export** — validate JSON schema on import; reject with clear error rather than partially applying.

## 10. Testing Strategy

- **Unit tests (Vitest)** — `srs.ts` scheduling correctness, `session.ts` mix-ratio math, `grader.ts` leniency logic with stubbed hanzi-writer
- **Integration tests** — Dexie in-memory (fake-indexeddb) for `progress → srsCards → reviewLog` round-trips; verify card identity is `(wordId, promptType)`
- **Component tests (React Testing Library)** — Review screen rendering per prompt type, grading button flow, keyboard shortcuts
- **E2E smoke (Playwright, 1 happy path)** — pick level → study 3 new words → review them → check heatmap updates
- **Manual checks**: mobile responsiveness (iPhone SE, iPad), French/English UI, offline mode, export/import round trip

## 11. Accessibility & Responsiveness

- **Mobile-first layouts** via Tailwind breakpoints; bottom tab nav on mobile, sidebar ≥ `md`
- **Touch-friendly drawing canvas** — handles both pointer events and touch events; minimum 280 px square on mobile
- **Keyboard shortcuts** on desktop: 1-4 for Again/Hard/Good/Easy, Space to replay audio
- **ARIA labels** on all interactive controls; focus management on route changes
- **Respects `prefers-reduced-motion`** — disables stroke animations if set
- **Dark mode** via Tailwind `dark:` classes, auto-detect from `prefers-color-scheme`

## 12. Internationalization

- `i18next` + `react-i18next`, namespace per route, translation files in `public/locales/{fr,en}.json`
- Language toggle persisted in `settings.uiLanguage`
- **Chinese content itself is not translated** — it stays Chinese; only UI chrome and glosses are bilingual (each word stores both `meaningFr` and `meaningEn`, picked at render time based on `uiLanguage`)
- Dates and numbers formatted via `Intl` APIs with the active locale

## 13. PWA

- `vite-plugin-pwa` with Workbox
- Service worker strategy:
  - App shell (HTML/JS/CSS) — `StaleWhileRevalidate`
  - `/data/*.json` and `/data/strokes/*` — `CacheFirst`, cached indefinitely
  - `/audio/*.mp3` — `CacheFirst` with per-level pre-caching when a user first enters that level
- Web App Manifest with maskable icon set, name, standalone display mode
- Install prompt shown on Home after 3rd visit

## 14. Project Structure

```
hsk-trainer/
├── public/
│   ├── data/
│   ├── audio/
│   ├── locales/
│   └── manifest.webmanifest
├── scripts/
│   └── build-data.ts
├── src/
│   ├── routes/           # TanStack Router file-based
│   │   ├── __root.tsx
│   │   ├── index.tsx     # Home
│   │   ├── browse.tsx
│   │   ├── study.tsx
│   │   ├── review.tsx
│   │   ├── stats.tsx
│   │   └── settings.tsx
│   ├── components/
│   │   ├── DrawingCanvas.tsx
│   │   ├── AudioButton.tsx
│   │   ├── HeatmapCalendar.tsx
│   │   ├── WordCard.tsx
│   │   └── ...
│   ├── engines/
│   │   ├── srs.ts
│   │   ├── grader.ts
│   │   ├── session.ts
│   │   └── audio.ts
│   ├── db/
│   │   ├── dexie.ts
│   │   └── schema.ts
│   ├── state/
│   │   └── session-store.ts  # Zustand
│   ├── i18n/
│   │   └── index.ts
│   └── main.tsx
├── tests/
└── package.json
```

## 15. Open Questions (to resolve during implementation)

- Exact source of French glosses — LLM batch translation acceptable? Manual curation for HSK 1-3 (highest-value) a good compromise?
- Audio bundling — per-word (~150 MB) vs per-syllable (~5 MB, less natural)? Decision deferred until first build-data run measures actual size
- Example sentences — include in v1 or defer to v2? Currently modeled but optional per word

## 16. Out of Scope (v1)

- Traditional characters
- Cloud sync / accounts
- Shape-match writing grading
- Handwriting OCR beyond hanzi-writer
- Sentence-level practice / speaking practice
- Multi-user profiles

---

**Next step:** invoke `superpowers:writing-plans` to produce the implementation plan.
