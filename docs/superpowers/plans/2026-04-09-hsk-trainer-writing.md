# HSK Trainer — Plan 2: Writing Practice & Study Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stroke-based writing practice to the HSK Trainer. Users can draw each character of a word stroke-by-stroke inside a quiz canvas; the two deferred prompt types (`audio-to-draw`, `meaning-to-draw`) become active review modes; a new `/study` screen introduces new words with a stroke animation + first writing attempt before committing them to the SRS queue.

**Architecture:** `hanzi-writer` (v3.7.3) handles canvas rendering, stroke data, animation, and quiz validation — we never touch stroke geometry directly. Plan 2 ships only `strict` leniency (built-in); `lenient-order` remains deferred per spec §7.2. Stroke character data is loaded from the library's default CDN (`jsdelivr`) — offline / bundled stroke data ships in Plan 3. A thin `DrawingCanvas` React wrapper bridges the imperative hanzi-writer API to React; `WritingPrompt` orchestrates the multi-character flow and grading; a Zustand `study-store` tracks the new-word introduction queue exactly the way `session-store` tracks the review queue.

**Tech Stack:** hanzi-writer 3.7.3 · React 19 · TanStack Router · Zustand · Dexie (unchanged schema) · Vitest + React Testing Library · existing Tailwind Duolingo design language from Plan 1.

---

## File Structure

```
src/
├── engines/
│   └── grader.ts              # NEW · pure helpers: per-char accuracy, grade suggestion
├── components/
│   ├── DrawingCanvas.tsx      # NEW · hanzi-writer quiz wrapper
│   ├── StrokeAnimation.tsx    # NEW · hanzi-writer animate-mode wrapper
│   ├── WritingPrompt.tsx      # NEW · multi-char writing flow for review route
│   ├── AudioButton.tsx        # NEW · reusable audio button w/ speechSynthesis fallback
│   ├── MultipleChoicePrompt.tsx  # MODIFY · use AudioButton
│   └── GradeButtons.tsx       # (unchanged)
├── routes/
│   ├── review.tsx             # MODIFY · route draw prompt types to WritingPrompt
│   ├── index.tsx              # MODIFY · CTA links to /study instead of inline intro
│   └── study.tsx              # NEW · new-word introduction flow
├── state/
│   ├── study-store.ts         # NEW · Zustand queue for /study
│   └── session-store.ts       # (unchanged)
├── db/
│   └── schema.ts              # MODIFY · add draw prompt types to DEFAULT_SETTINGS.enabledPromptTypes
└── test-utils/
    └── hanzi-writer-mock.ts   # NEW · shared vi.mock helper

tests/
├── engines/
│   └── grader.test.ts         # NEW
├── components/
│   ├── DrawingCanvas.test.tsx # NEW
│   └── WritingPrompt.test.tsx # NEW
└── routes/
    └── study.test.tsx         # NEW
```

**Why the split:**
- `grader.ts` is pure functions — unit-testable without the DOM or hanzi-writer.
- `DrawingCanvas` is one imperative adapter for quiz mode; `StrokeAnimation` is the parallel adapter for animate mode. Splitting them keeps each file focused on one hanzi-writer API.
- `WritingPrompt` is a composition component: it owns per-char state and the final reveal; it does not know about hanzi-writer directly.
- `study-store` mirrors the shape of `session-store` for consistency (both are queue+index Zustand stores).

---

## Task 1: Install hanzi-writer and add a shared test mock

**Files:**
- Modify: `package.json`
- Create: `src/test-utils/hanzi-writer-mock.ts`

- [ ] **Step 1: Install the library**

Run: `npm install hanzi-writer@3.7.3`
Expected: `hanzi-writer` appears under `dependencies` in `package.json`; no peer-dep warnings beyond React 19 if any.

- [ ] **Step 2: Verify the library exports are what we expect**

Run: `node -e "import('hanzi-writer').then(m => console.log(Object.keys(m.default || m)))"`
Expected output contains: `create`, `loadCharacterData`. The default export exposes `.create(target, character, options)` which returns a `HanziWriter` instance with `.quiz()`, `.animateCharacter()`, etc.

- [ ] **Step 3: Create shared vi.mock helper for tests**

JSDOM can't render hanzi-writer's SVG canvas meaningfully, and the library fetches stroke JSON from a CDN on first use. Every test file that imports a component touching `hanzi-writer` must stub it. Centralize the stub.

Create `src/test-utils/hanzi-writer-mock.ts`:

```ts
import { vi } from "vitest";

/**
 * Controllable fake for `hanzi-writer`. Tests can read `lastQuizOptions` to
 * drive quiz callbacks imperatively (simulate strokes, mistakes, completion).
 */
export interface FakeWriter {
  character: string;
  quiz: ReturnType<typeof vi.fn>;
  animateCharacter: ReturnType<typeof vi.fn>;
  cancelQuiz: ReturnType<typeof vi.fn>;
  hideCharacter: ReturnType<typeof vi.fn>;
  lastQuizOptions: Record<string, unknown> | null;
}

export const fakeWriters: FakeWriter[] = [];

export function installHanziWriterMock() {
  vi.mock("hanzi-writer", () => {
    return {
      default: {
        create: vi.fn((_target: HTMLElement, character: string) => {
          const instance: FakeWriter = {
            character,
            lastQuizOptions: null,
            quiz: vi.fn((opts: Record<string, unknown>) => {
              instance.lastQuizOptions = opts;
            }),
            animateCharacter: vi.fn((opts?: { onComplete?: () => void }) => {
              opts?.onComplete?.();
            }),
            cancelQuiz: vi.fn(),
            hideCharacter: vi.fn(),
          };
          fakeWriters.push(instance);
          return instance;
        }),
        loadCharacterData: vi.fn(async () => ({ strokes: [], medians: [] })),
      },
    };
  });
}

export function resetHanziWriterMock() {
  fakeWriters.length = 0;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/test-utils/hanzi-writer-mock.ts
git commit -m "feat(plan2): install hanzi-writer + shared test mock"
```

---

## Task 2: Grader pure helpers with tests

**Files:**
- Create: `src/engines/grader.ts`
- Test: `tests/engines/grader.test.ts`

The grader is a pure, side-effect-free module that turns raw quiz results (per-character mistake counts) into an aggregate accuracy and a *suggested* grade. The user can always override; this only seeds the UI.

- [ ] **Step 1: Write the failing tests**

Create `tests/engines/grader.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  combineAccuracy,
  perCharAccuracy,
  suggestGrade,
} from "@/engines/grader";

describe("perCharAccuracy", () => {
  it("returns 1 for zero mistakes", () => {
    expect(perCharAccuracy({ strokeCount: 5, mistakes: 0 })).toBe(1);
  });

  it("decreases linearly with mistakes", () => {
    expect(perCharAccuracy({ strokeCount: 5, mistakes: 1 })).toBeCloseTo(0.8);
    expect(perCharAccuracy({ strokeCount: 5, mistakes: 2 })).toBeCloseTo(0.6);
  });

  it("floors at 0 — cannot go negative", () => {
    expect(perCharAccuracy({ strokeCount: 3, mistakes: 10 })).toBe(0);
  });

  it("returns 0 for a char with zero strokes (defensive)", () => {
    expect(perCharAccuracy({ strokeCount: 0, mistakes: 0 })).toBe(0);
  });
});

describe("combineAccuracy", () => {
  it("averages per-character scores", () => {
    expect(combineAccuracy([1, 1, 1])).toBe(1);
    expect(combineAccuracy([1, 0.5])).toBeCloseTo(0.75);
    expect(combineAccuracy([0.8, 0.6, 0.4])).toBeCloseTo(0.6);
  });

  it("returns 0 for an empty list", () => {
    expect(combineAccuracy([])).toBe(0);
  });
});

describe("suggestGrade", () => {
  it("returns 'good' for perfect accuracy", () => {
    expect(suggestGrade(1)).toBe("good");
  });

  it("returns 'hard' for mid accuracy", () => {
    expect(suggestGrade(0.75)).toBe("hard");
    expect(suggestGrade(0.5)).toBe("hard");
  });

  it("returns 'again' for low accuracy", () => {
    expect(suggestGrade(0.49)).toBe("again");
    expect(suggestGrade(0)).toBe("again");
  });

  it("does not suggest 'easy' — user must opt into it manually", () => {
    expect(suggestGrade(1.0)).not.toBe("easy");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engines/grader.test.ts`
Expected: FAIL — `Cannot find module '@/engines/grader'`.

- [ ] **Step 3: Implement the grader**

Create `src/engines/grader.ts`:

```ts
import type { Grade } from "@/db/schema";

export interface CharAttempt {
  strokeCount: number;
  mistakes: number;
}

/**
 * Per-character accuracy = 1 minus the mistake rate, clamped to [0, 1].
 * A character with zero strokes is a data error; return 0 so it never
 * contributes a misleading "perfect" score to the average.
 */
export function perCharAccuracy({ strokeCount, mistakes }: CharAttempt): number {
  if (strokeCount <= 0) return 0;
  const raw = 1 - mistakes / strokeCount;
  return Math.max(0, Math.min(1, raw));
}

/** Mean of the per-character accuracy scores. Empty → 0. */
export function combineAccuracy(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

/**
 * Seeds the Grade buttons after a writing attempt.
 * Perfect → good. Middling → hard. Below 0.5 → again.
 * "easy" is never auto-suggested; it is an explicit user judgement.
 */
export function suggestGrade(accuracy: number): Grade {
  if (accuracy >= 1) return "good";
  if (accuracy >= 0.5) return "hard";
  return "again";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engines/grader.test.ts`
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engines/grader.ts tests/engines/grader.test.ts
git commit -m "feat(plan2): pure writing-grader helpers"
```

---

## Task 3: `DrawingCanvas` component (quiz mode wrapper)

**Files:**
- Create: `src/components/DrawingCanvas.tsx`
- Test: `tests/components/DrawingCanvas.test.tsx`

Thin React wrapper around `HanziWriter.create()` in quiz mode. Props in: `character`, `onComplete({ mistakes })`. Lifecycle: create on mount with a ref'd `<div>`, start quiz, cancel on unmount.

- [ ] **Step 1: Write the failing test**

Create `tests/components/DrawingCanvas.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  installHanziWriterMock,
  fakeWriters,
  resetHanziWriterMock,
} from "@/test-utils/hanzi-writer-mock";

installHanziWriterMock();

// Imported AFTER the mock is installed so the component sees the fake.
import { DrawingCanvas } from "@/components/DrawingCanvas";

describe("DrawingCanvas", () => {
  beforeEach(() => resetHanziWriterMock());
  afterEach(() => cleanup());

  it("creates a HanziWriter instance for the given character", () => {
    render(<DrawingCanvas character="你" onComplete={() => {}} />);
    expect(fakeWriters).toHaveLength(1);
    expect(fakeWriters[0].character).toBe("你");
    expect(fakeWriters[0].quiz).toHaveBeenCalledTimes(1);
  });

  it("reports total mistakes to onComplete when the quiz finishes", () => {
    const onComplete = vi.fn();
    render(<DrawingCanvas character="好" onComplete={onComplete} />);
    const opts = fakeWriters[0].lastQuizOptions as {
      onMistake?: (s: { strokeNum: number }) => void;
      onComplete?: (s: { totalMistakes: number }) => void;
    };
    opts.onMistake?.({ strokeNum: 0 });
    opts.onMistake?.({ strokeNum: 1 });
    opts.onComplete?.({ totalMistakes: 2 });
    expect(onComplete).toHaveBeenCalledWith({ mistakes: 2 });
  });

  it("cancels the quiz on unmount", () => {
    const { unmount } = render(
      <DrawingCanvas character="我" onComplete={() => {}} />
    );
    const writer = fakeWriters[0];
    unmount();
    expect(writer.cancelQuiz).toHaveBeenCalled();
  });

  it("re-creates the writer when the character prop changes", () => {
    const { rerender } = render(
      <DrawingCanvas character="你" onComplete={() => {}} />
    );
    rerender(<DrawingCanvas character="好" onComplete={() => {}} />);
    expect(fakeWriters).toHaveLength(2);
    expect(fakeWriters[1].character).toBe("好");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/DrawingCanvas.test.tsx`
Expected: FAIL — `Cannot find module '@/components/DrawingCanvas'`.

- [ ] **Step 3: Implement `DrawingCanvas`**

Create `src/components/DrawingCanvas.tsx`:

```tsx
import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";

interface Props {
  character: string;
  /** Called once when the user has drawn every stroke of the character. */
  onComplete: (result: { mistakes: number }) => void;
  /** Square size in px — defaults to a mobile-friendly 260. */
  size?: number;
}

/**
 * Imperative bridge to hanzi-writer's quiz mode. The library owns the SVG DOM;
 * React owns the outer `<div>` ref and the lifecycle.
 *
 * We key the effect on `character` so that navigating to the next character
 * in a multi-char word tears down the previous writer cleanly.
 */
export function DrawingCanvas({ character, onComplete, size = 260 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    // Clear any previous SVG between re-mounts (safe: no user content).
    target.replaceChildren();

    let mistakes = 0;
    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 10,
      showCharacter: false,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 50,
      strokeColor: "#15803d", // tailwind green-700
      outlineColor: "#e5e7eb", // tailwind gray-200
      highlightColor: "#22c55e", // tailwind green-500
    });

    writer.quiz({
      onMistake: () => {
        mistakes += 1;
      },
      onComplete: () => {
        onComplete({ mistakes });
      },
    });

    return () => {
      writer.cancelQuiz();
    };
  }, [character, size, onComplete]);

  return (
    <div
      ref={containerRef}
      aria-label={`Draw the character ${character}`}
      className="mx-auto rounded-2xl bg-white border-2 border-b-4 border-gray-200"
      style={{ width: size, height: size }}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/DrawingCanvas.test.tsx`
Expected: all 4 tests pass.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/DrawingCanvas.tsx tests/components/DrawingCanvas.test.tsx
git commit -m "feat(plan2): DrawingCanvas wraps hanzi-writer quiz mode"
```

---

## Task 4: `StrokeAnimation` component (animate mode wrapper)

**Files:**
- Create: `src/components/StrokeAnimation.tsx`

Used by the Study screen to show the user how to write the character before they attempt it. No dedicated test file: trivial wrapper, visual-only, exercised via the Study route test in Task 10.

- [ ] **Step 1: Implement `StrokeAnimation`**

Create `src/components/StrokeAnimation.tsx`:

```tsx
import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";

interface Props {
  character: string;
  size?: number;
  /** Called once the animation has played through all strokes. */
  onDone?: () => void;
}

/**
 * Plays the stroke animation for a single character. Auto-starts on mount.
 * Study flow uses this to show the user the correct stroke order before
 * handing off to a DrawingCanvas for the first attempt.
 */
export function StrokeAnimation({ character, size = 200, onDone }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    target.replaceChildren();

    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 8,
      showOutline: true,
      strokeColor: "#0ea5e9", // tailwind sky-500
      outlineColor: "#e5e7eb",
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 120,
    });

    writer.animateCharacter({ onComplete: () => onDone?.() });

    return () => {
      target.replaceChildren();
    };
  }, [character, size, onDone]);

  return (
    <div
      ref={containerRef}
      aria-label={`Stroke order for ${character}`}
      className="mx-auto"
      style={{ width: size, height: size }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/StrokeAnimation.tsx
git commit -m "feat(plan2): StrokeAnimation wraps hanzi-writer animate mode"
```

---

## Task 5: `AudioButton` component with speechSynthesis fallback

**Files:**
- Create: `src/components/AudioButton.tsx`
- Modify: `src/components/MultipleChoicePrompt.tsx`

Currently `MultipleChoicePrompt` calls `new Audio("/audio/...")` inline and silently fails because no files ship yet. Extract into a reusable component that tries the MP3 first, then falls back to `window.speechSynthesis` with `zh-CN` voice. Writing prompts reuse this for `audio-to-draw`.

- [ ] **Step 1: Implement `AudioButton`**

Create `src/components/AudioButton.tsx`:

```tsx
import { chunky, type ChunkyVariant } from "./Button";

interface Props {
  /** Filename in /public/audio (Plan 3). If missing, speech synthesis is used. */
  audioFile: string;
  /** Text spoken by the synthesis fallback — the Chinese characters. */
  fallbackText: string;
  label?: string;
  variant?: ChunkyVariant;
}

/**
 * Plays pronunciation for a word. Prefers the bundled MP3 (shipping in Plan 3);
 * if the file is missing (404 or decode error) falls back to
 * `window.speechSynthesis` with the Mandarin voice.
 */
export function AudioButton({
  audioFile,
  fallbackText,
  label = "Play",
  variant = "info",
}: Props) {
  function speak() {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(fallbackText);
    utter.lang = "zh-CN";
    utter.rate = 0.85;
    synth.speak(utter);
  }

  function play() {
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      speak();
    };
    const audio = new Audio(`/audio/${audioFile}`);
    audio.addEventListener("error", fallback, { once: true });
    audio.play().catch(fallback);
  }

  return (
    <button
      type="button"
      onClick={play}
      className={chunky(variant)}
      aria-label={`Play pronunciation of ${fallbackText}`}
    >
      <span aria-hidden className="text-2xl">🔊</span>
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Use `AudioButton` inside `MultipleChoicePrompt`**

Open `src/components/MultipleChoicePrompt.tsx`. Delete the local `playAudio` function. Add the import next to the existing `chunky` import:

```tsx
import { AudioButton } from "./AudioButton";
```

Then replace the `promptType === "audio-to-word"` branch.

Replace this:

```tsx
        {promptType === "audio-to-word" ? (
          <button
            type="button"
            onClick={playAudio}
            className={chunky("info", "text-xl")}
            aria-label="Play audio"
          >
            <span aria-hidden className="text-2xl">🔊</span>
            Play
          </button>
        ) : (
```

with this:

```tsx
        {promptType === "audio-to-word" ? (
          <AudioButton
            audioFile={word.audioFile}
            fallbackText={word.id}
            label="Play audio"
          />
        ) : (
```

- [ ] **Step 3: Typecheck & run existing tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean, all 22 existing Plan 1 tests + the 14 new Plan 2 tests so far remain green.

- [ ] **Step 4: Commit**

```bash
git add src/components/AudioButton.tsx src/components/MultipleChoicePrompt.tsx
git commit -m "feat(plan2): AudioButton with speechSynthesis fallback"
```

---

## Task 6: `WritingPrompt` component — multi-character writing flow

**Files:**
- Create: `src/components/WritingPrompt.tsx`
- Test: `tests/components/WritingPrompt.test.tsx`

Owns the state machine for a writing review:

1. Show prompt header (audio button for `audio-to-draw`, gloss text for `meaning-to-draw`)
2. For each character in `word.characters`, render a `DrawingCanvas`. When it completes, push `{ mistakes }` and advance.
3. When all characters are drawn, reveal the full word + pinyin + meaning and render `GradeButtons`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/WritingPrompt.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  installHanziWriterMock,
  fakeWriters,
  resetHanziWriterMock,
} from "@/test-utils/hanzi-writer-mock";

installHanziWriterMock();

import { WritingPrompt } from "@/components/WritingPrompt";
import type { Word } from "@/db/schema";

const WORD: Word = {
  id: "你好",
  hskLevel: 1,
  characters: ["你", "好"],
  pinyin: "nǐ hǎo",
  pinyinNumeric: "ni3hao3",
  meaningEn: "hello",
  meaningFr: "bonjour",
  frequency: 1,
  audioFile: "ni3hao3.mp3",
};

describe("WritingPrompt", () => {
  beforeEach(() => resetHanziWriterMock());
  afterEach(() => cleanup());

  it("renders the first character canvas and advances on completion", async () => {
    const onGrade = vi.fn();
    render(
      <WritingPrompt word={WORD} promptType="meaning-to-draw" onGrade={onGrade} />
    );
    // First writer is for 你
    expect(fakeWriters).toHaveLength(1);
    expect(fakeWriters[0].character).toBe("你");

    const first = fakeWriters[0].lastQuizOptions as {
      onMistake?: () => void;
      onComplete?: () => void;
    };
    await act(async () => {
      first.onMistake?.();
      first.onComplete?.();
    });

    // Second character 好 should now be rendered
    expect(fakeWriters).toHaveLength(2);
    expect(fakeWriters[1].character).toBe("好");
  });

  it("reveals answer and grade buttons after all characters are drawn", async () => {
    const user = userEvent.setup();
    const onGrade = vi.fn();
    render(
      <WritingPrompt word={WORD} promptType="meaning-to-draw" onGrade={onGrade} />
    );

    const a = fakeWriters[0].lastQuizOptions as { onComplete?: () => void };
    await act(async () => a.onComplete?.());

    const b = fakeWriters[1].lastQuizOptions as { onComplete?: () => void };
    await act(async () => b.onComplete?.());

    expect(screen.getByText("nǐ hǎo")).toBeInTheDocument();
    expect(screen.getAllByText("hello").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /good/i }));
    expect(onGrade).toHaveBeenCalledWith("good");
  });

  it("shows the gloss in meaning-to-draw mode", () => {
    render(
      <WritingPrompt word={WORD} promptType="meaning-to-draw" onGrade={() => {}} />
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("shows a play button in audio-to-draw mode", () => {
    render(
      <WritingPrompt word={WORD} promptType="audio-to-draw" onGrade={() => {}} />
    );
    expect(
      screen.getByRole("button", { name: /play pronunciation/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run tests/components/WritingPrompt.test.tsx`
Expected: FAIL — `Cannot find module '@/components/WritingPrompt'`.

- [ ] **Step 3: Implement `WritingPrompt`**

Create `src/components/WritingPrompt.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the WritingPrompt tests**

Run: `npx vitest run tests/components/WritingPrompt.test.tsx`
Expected: all 4 tests pass.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/WritingPrompt.tsx tests/components/WritingPrompt.test.tsx
git commit -m "feat(plan2): WritingPrompt orchestrates multi-char writing flow"
```

---

## Task 7: Route draw prompt types to `WritingPrompt` in `/review`

**Files:**
- Modify: `src/routes/review.tsx`

- [ ] **Step 1: Add the import**

Open `src/routes/review.tsx`. Add next to the other component imports:

```tsx
import { WritingPrompt } from "@/components/WritingPrompt";
```

- [ ] **Step 2: Replace the prompt branch**

Find this block inside the `Review()` component:

```tsx
        {current.card.promptType === "recognition" ? (
          <RecognitionPrompt word={current.word} onGrade={handleGrade} />
        ) : (
          <MultipleChoicePrompt
            word={current.word}
            promptType={current.card.promptType}
            onGrade={handleGrade}
          />
        )}
```

Replace with:

```tsx
        {current.card.promptType === "recognition" ? (
          <RecognitionPrompt word={current.word} onGrade={handleGrade} />
        ) : current.card.promptType === "audio-to-draw" ||
          current.card.promptType === "meaning-to-draw" ? (
          <WritingPrompt
            word={current.word}
            promptType={current.card.promptType}
            onGrade={handleGrade}
          />
        ) : (
          <MultipleChoicePrompt
            word={current.word}
            promptType={current.card.promptType}
            onGrade={handleGrade}
          />
        )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/routes/review.tsx
git commit -m "feat(plan2): route draw prompts through WritingPrompt"
```

---

## Task 8: Expand `DEFAULT_SETTINGS.enabledPromptTypes` to include draw types

**Files:**
- Modify: `src/db/schema.ts`

Now that draw prompts are implemented, new users' settings should enable them by default. Existing rows in IndexedDB are left alone — this only affects first-run seeding.

- [ ] **Step 1: Edit the default**

In `src/db/schema.ts`, replace this line:

```ts
  enabledPromptTypes: ["recognition", "audio-to-word", "meaning-to-word"],
```

with:

```ts
  enabledPromptTypes: [
    "recognition",
    "audio-to-word",
    "meaning-to-word",
    "audio-to-draw",
    "meaning-to-draw",
  ],
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all previous + new tests still green. Sanity-check: if any existing test hardcoded the old 3-element array for `enabledPromptTypes`, update it in place.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(plan2): enable draw prompt types in default settings"
```

---

## Task 9: `study-store` Zustand state for the new-word introduction queue

**Files:**
- Create: `src/state/study-store.ts`
- Test: `tests/state/study-store.test.ts`

Mirrors `session-store` in shape. The queue is an array of `Word`s (not `SrsCard`s — cards don't exist yet). Each word walks through three phases: `present` → `animate` → `attempt`.

- [ ] **Step 1: Write the failing test**

Create `tests/state/study-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useStudyStore } from "@/state/study-store";
import type { Word } from "@/db/schema";

const W1: Word = {
  id: "你", hskLevel: 1, characters: ["你"], pinyin: "nǐ",
  pinyinNumeric: "ni3", meaningEn: "you", meaningFr: "tu", frequency: 4,
  audioFile: "ni3.mp3",
};
const W2: Word = { ...W1, id: "好", characters: ["好"], pinyin: "hǎo", meaningEn: "good" };

describe("study-store", () => {
  beforeEach(() => useStudyStore.getState().clear());

  it("starts a queue and begins in 'present' phase", () => {
    useStudyStore.getState().start([W1, W2]);
    const s = useStudyStore.getState();
    expect(s.queue).toHaveLength(2);
    expect(s.index).toBe(0);
    expect(s.phase).toBe("present");
  });

  it("advances phase through present → animate → attempt", () => {
    useStudyStore.getState().start([W1]);
    useStudyStore.getState().nextPhase();
    expect(useStudyStore.getState().phase).toBe("animate");
    useStudyStore.getState().nextPhase();
    expect(useStudyStore.getState().phase).toBe("attempt");
  });

  it("commits the current word, moves to the next, and resets phase", () => {
    useStudyStore.getState().start([W1, W2]);
    useStudyStore.getState().nextPhase(); // animate
    useStudyStore.getState().nextPhase(); // attempt
    useStudyStore.getState().commitCurrent();
    const s = useStudyStore.getState();
    expect(s.index).toBe(1);
    expect(s.phase).toBe("present");
  });

  it("past the last word the store is in a 'done' state", () => {
    useStudyStore.getState().start([W1]);
    useStudyStore.getState().commitCurrent();
    expect(useStudyStore.getState().index).toBe(1);
    expect(useStudyStore.getState().isDone()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/study-store.test.ts`
Expected: FAIL — `Cannot find module '@/state/study-store'`.

- [ ] **Step 3: Implement `study-store`**

Create `src/state/study-store.ts`:

```ts
import { create } from "zustand";
import type { Word } from "@/db/schema";

export type StudyPhase = "present" | "animate" | "attempt";

interface StudyState {
  queue: Word[];
  index: number;
  phase: StudyPhase;
  start: (words: Word[]) => void;
  nextPhase: () => void;
  commitCurrent: () => void;
  isDone: () => boolean;
  clear: () => void;
}

const PHASES: StudyPhase[] = ["present", "animate", "attempt"];

export const useStudyStore = create<StudyState>((set, get) => ({
  queue: [],
  index: 0,
  phase: "present",
  start: (words) => set({ queue: words, index: 0, phase: "present" }),
  nextPhase: () =>
    set((s) => {
      const i = PHASES.indexOf(s.phase);
      return { phase: PHASES[Math.min(i + 1, PHASES.length - 1)] };
    }),
  commitCurrent: () => set((s) => ({ index: s.index + 1, phase: "present" })),
  isDone: () => get().index >= get().queue.length,
  clear: () => set({ queue: [], index: 0, phase: "present" }),
}));
```

- [ ] **Step 4: Run tests — confirm they pass**

Run: `npx vitest run tests/state/study-store.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/study-store.ts tests/state/study-store.test.ts
git commit -m "feat(plan2): study-store Zustand queue for new-word intro"
```

---

## Task 10: `/study` route — present + animate + attempt + commit

**Files:**
- Create: `src/routes/study.tsx`
- Test: `tests/routes/study.test.tsx`

Selects up to `newPerDay - newCardsIntroducedToday` words from `db.words` that do not yet have any `SrsCard`, walks them through the three phases, and calls `introduceNewCard` + `incrementDailyNew` on commit.

- [ ] **Step 1: Write the route test**

Create `tests/routes/study.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { db } from "@/db/dexie";
import { loadOrInitSettings } from "@/state/settings-store";
import {
  installHanziWriterMock,
  fakeWriters,
  resetHanziWriterMock,
} from "@/test-utils/hanzi-writer-mock";

installHanziWriterMock();

import { Route as StudyRoute } from "@/routes/study";

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study",
  component: StudyRoute.options.component!,
});

function buildRouter() {
  const tree = rootRoute.addChildren([studyRoute]);
  return createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: ["/study"] }),
  });
}

describe("/study route", () => {
  beforeEach(async () => {
    resetHanziWriterMock();
    await db.delete();
    await db.open();
    await db.words.bulkAdd([
      {
        id: "你",
        hskLevel: 1,
        characters: ["你"],
        pinyin: "nǐ",
        pinyinNumeric: "ni3",
        meaningEn: "you",
        meaningFr: "tu",
        frequency: 1,
        audioFile: "ni3.mp3",
      },
    ]);
    await loadOrInitSettings();
  });
  afterEach(() => cleanup());

  it("walks a single word through present → animate → attempt → done", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const router = buildRouter();
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /show strokes/i })
      ).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /show strokes/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /try it yourself/i })
      ).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /try it yourself/i }));

    await waitFor(() => expect(fakeWriters.length).toBeGreaterThan(0));
    const opts = fakeWriters[fakeWriters.length - 1].lastQuizOptions as {
      onComplete?: () => void;
    };
    await act(async () => opts.onComplete?.());

    await waitFor(() =>
      expect(screen.getByText(/all done/i)).toBeInTheDocument()
    );
    const cards = await db.srsCards.toArray();
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].wordId).toBe("你");
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npx vitest run tests/routes/study.test.tsx`
Expected: FAIL — `Cannot find module '@/routes/study'`.

- [ ] **Step 3: Implement `/study`**

Create `src/routes/study.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/db/dexie";
import {
  introduceNewCard,
  incrementDailyNew,
  getTodayState,
} from "@/engines/srs";
import { useSettings } from "@/state/settings-store";
import { useStudyStore } from "@/state/study-store";
import { StrokeAnimation } from "@/components/StrokeAnimation";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { AudioButton } from "@/components/AudioButton";
import { chunky } from "@/components/Button";
import type { Word } from "@/db/schema";

export const Route = createFileRoute("/study")({
  component: Study,
});

function Study() {
  const settings = useSettings();
  const { queue, index, phase, start, nextPhase, commitCurrent, clear } =
    useStudyStore();

  useEffect(() => {
    if (!settings) return;
    (async () => {
      const today = await getTodayState(Date.now());
      const remaining = Math.max(
        0,
        settings.newPerDay - today.newCardsIntroduced
      );
      if (remaining === 0) {
        start([]);
        return;
      }
      const words = await db.words
        .where("hskLevel")
        .equals(1)
        .sortBy("frequency");
      const existing = new Set(
        (await db.srsCards.toArray()).map((c) => c.wordId)
      );
      const fresh = words
        .filter((w) => !existing.has(w.id))
        .slice(0, remaining);
      start(fresh);
    })();
    return () => clear();
  }, [settings, start, clear]);

  if (!settings) {
    return (
      <p className="text-center py-20 text-gray-400 font-bold uppercase tracking-wider text-sm">
        Loading…
      </p>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <p className="text-6xl mb-4">🌿</p>
        <p className="text-2xl font-extrabold text-gray-800">
          Nothing new to learn right now.
        </p>
        <p className="mt-2 text-gray-500 font-semibold">
          Either your daily cap is reached or HSK 1 is exhausted.
        </p>
        <Link to="/" className={chunky("primary", "mt-8")}>
          ← Back to home
        </Link>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-pop-in">
        <p className="text-7xl mb-4">🎉</p>
        <p className="text-3xl sm:text-4xl font-extrabold text-green-600">
          All done!
        </p>
        <p className="mt-2 text-gray-500 font-semibold">
          {queue.length} new {queue.length === 1 ? "word" : "words"} added to
          your deck.
        </p>
        <Link to="/" className={chunky("primary", "mt-8 w-full")}>
          Back to home
        </Link>
      </div>
    );
  }

  const word = queue[index];

  async function handleCommitCurrent() {
    await introduceNewCard(word.id, settings!, Date.now());
    await incrementDailyNew(Date.now());
    commitCurrent();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      {/* Progress header */}
      <header className="flex items-center gap-3 mb-10">
        <Link
          to="/"
          aria-label="Exit study"
          className="grid place-items-center h-10 w-10 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-2xl font-black"
        >
          ✕
        </Link>
        <div className="flex-1 h-4 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-sky-500 border-b-[3px] border-sky-700 rounded-full transition-all duration-300"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-extrabold tabular-nums text-gray-500 min-w-[3ch] text-right">
          {index + 1}/{queue.length}
        </span>
      </header>

      {phase === "present" && (
        <div className="text-center animate-pop-in">
          <p className="text-xs font-extrabold uppercase tracking-widest text-sky-500">
            New word
          </p>
          <p className="mt-6 font-hanzi text-7xl sm:text-8xl font-black text-gray-800">
            {word.id}
          </p>
          <p className="mt-4 text-2xl font-extrabold text-gray-700">
            {word.pinyin}
          </p>
          <p className="mt-2 text-lg font-bold text-gray-500">{word.meaningEn}</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <AudioButton
              audioFile={word.audioFile}
              fallbackText={word.id}
              label="Listen"
              variant="neutral"
            />
            <button onClick={nextPhase} className={chunky("primary")}>
              Show strokes →
            </button>
          </div>
        </div>
      )}

      {phase === "animate" && (
        <div className="text-center animate-pop-in">
          <p className="text-xs font-extrabold uppercase tracking-widest text-sky-500">
            Watch the stroke order
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {word.characters.map((c, i) => (
              <StrokeAnimation key={`${word.id}:${i}`} character={c} />
            ))}
          </div>
          <button onClick={nextPhase} className={chunky("primary", "mt-8")}>
            Try it yourself →
          </button>
        </div>
      )}

      {phase === "attempt" && (
        <AttemptPhase word={word} onDone={handleCommitCurrent} />
      )}
    </div>
  );
}

/**
 * Per-character writing attempt. Once every character has been drawn, calls
 * onDone() — which writes the SRS cards and advances the study-store.
 */
function AttemptPhase({
  word,
  onDone,
}: {
  word: Word;
  onDone: () => void;
}) {
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (charIndex >= word.characters.length) {
      onDone();
    }
  }, [charIndex, word.characters.length, onDone]);

  if (charIndex >= word.characters.length) return null;

  return (
    <div className="text-center animate-pop-in">
      <p className="text-xs font-extrabold uppercase tracking-widest text-sky-500">
        Your turn · {charIndex + 1} / {word.characters.length}
      </p>
      <div className="mt-6">
        <DrawingCanvas
          key={`${word.id}:${charIndex}`}
          character={word.characters[charIndex]}
          onComplete={() => setCharIndex((i) => i + 1)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the route test**

Run: `npx vitest run tests/routes/study.test.tsx`
Expected: the single test passes.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all Plan 1 + Plan 2 tests remain green.

- [ ] **Step 6: Commit**

```bash
git add src/routes/study.tsx tests/routes/study.test.tsx
git commit -m "feat(plan2): /study route introduces new words with stroke animation"
```

---

## Task 11: Home route — link "+ add new characters" to `/study`

**Files:**
- Modify: `src/routes/index.tsx`

Right now the "+ add new characters" button calls `introduceTenNew()` inline, which creates cards without ever showing the user the character. Redirect it to the new `/study` flow.

- [ ] **Step 1: Replace the two `introduceTenNew` buttons with `Link to="/study"`**

In `src/routes/index.tsx`, find the empty-state branch:

```tsx
            <button
              onClick={introduceTenNew}
              className={chunky("info", "w-full")}
              disabled={!settings || newToday >= newTarget}
            >
              + Add new characters
            </button>
```

Replace with:

```tsx
            <Link to="/study" className={chunky("info", "w-full")}>
              + Add new characters
            </Link>
```

And find the secondary button further down:

```tsx
          <button
            onClick={introduceTenNew}
            className="mt-3 w-full text-sm font-bold uppercase tracking-wider text-gray-400 hover:text-sky-500 py-2 transition-colors"
            disabled={!settings || newToday >= newTarget}
          >
            + add new characters
          </button>
```

Replace with:

```tsx
          <Link
            to="/study"
            className="mt-3 block w-full text-center text-sm font-bold uppercase tracking-wider text-gray-400 hover:text-sky-500 py-2 transition-colors"
          >
            + add new characters
          </Link>
```

- [ ] **Step 2: Delete the now-unused `introduceTenNew` function and its imports**

Remove the entire `async function introduceTenNew()` body. Remove any top-level import only it used: `db`, `introduceNewCard`, `incrementDailyNew`. Keep `getTodayState` (still used by `todayQuery`), `seedHskLevel`, and `useQueryClient` only if still referenced — run typecheck at the next step to catch anything left over.

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: both clean. Fix any "declared but never used" errors by deleting the offending imports.

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(plan2): home CTA routes to /study for new words"
```

---

## Task 12: Add "Study" nav link, rename "Learn" → "Review", hide header on focused routes

**Files:**
- Modify: `src/routes/__root.tsx`

The nav already has a "Learn" link pointing to `/review`. That's misleading now that Plan 2 splits *learning new words* from *reviewing due cards*. Add a Study link and hide the top header on both focused routes.

- [ ] **Step 1: Update the nav links**

In `src/routes/__root.tsx`, replace the existing `<nav>` block with:

```tsx
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/"
                className="px-3 sm:px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-green-600 hover:bg-green-50 [&.active]:text-green-600 [&.active]:bg-green-50 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/study"
                className="px-3 sm:px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-sky-600 hover:bg-sky-50 [&.active]:text-sky-600 [&.active]:bg-sky-50 transition-colors"
              >
                Study
              </Link>
              <Link
                to="/review"
                className="px-3 sm:px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-green-600 hover:bg-green-50 [&.active]:text-green-600 [&.active]:bg-green-50 transition-colors"
              >
                Review
              </Link>
            </nav>
```

- [ ] **Step 2: Hide header on `/study` and `/review`**

Find:

```tsx
  const onReview = location.pathname.startsWith("/review");
```

Replace with:

```tsx
  const onFocused =
    location.pathname.startsWith("/review") ||
    location.pathname.startsWith("/study");
```

Then rename `onReview` to `onFocused` in the conditional just below (`{!onReview && ( ...` → `{!onFocused && ( ...`).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat(plan2): add Study nav link + hide header on focused routes"
```

---

## Task 13: Manual end-to-end smoke test

No code. Gate 0 for declaring Plan 2 done: the engineer runs the dev server and walks through the full flow with their own eyes.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: server on `http://localhost:5173`, no console errors in browser devtools.

- [ ] **Step 2: Clear previous IndexedDB state**

In browser devtools → Application → IndexedDB → delete `hsk-trainer`. Reload.

- [ ] **Step 3: Introduce new words via `/study`**

- Click "+ Add new characters" on Home.
- Verify the `/study` route loads the first HSK 1 word with pinyin + meaning.
- Click "Listen" — `speechSynthesis` should speak the word in Mandarin.
- Click "Show strokes →" — stroke animation plays.
- Click "Try it yourself →" — draw the strokes in order with your mouse / finger.
- On completion, the word commits and the next word appears.
- Continue to the success screen.

- [ ] **Step 4: Review them**

- Wait 1 minute (learning step 0) so the cards become due.
- Go to Home — "Due now" counter shows `> 0`.
- Click "Start lesson →".
- Verify you see a mix of `recognition`, `audio-to-word`, `meaning-to-word`, `audio-to-draw`, `meaning-to-draw` prompts (all 5 enabled by default).
- For draw prompts, finish each character and grade yourself.
- Session completes with the finish screen.

- [ ] **Step 5: Check offline failure modes**

- Open devtools → Network → Offline.
- Reload `/study`. The stroke animation will fail silently (hanzi-writer's CDN fetch errors). **This is the Plan 3 gap**: note it in the follow-up list, don't fix here.
- Restore network before moving on.

- [ ] **Step 6: Mobile check**

- Toggle devtools device emulation to iPhone SE.
- Verify the DrawingCanvas is usable with touch; button shadows don't wrap; progress pills don't overflow.

- [ ] **Step 7: Record follow-ups**

If anything failed in Steps 3-6, append to the "Follow-up issues" list at the bottom of this plan document before calling Plan 2 done.

---

## Out of Scope for Plan 2

| Deferred | Plan |
|---|---|
| Bundling stroke data under `public/data/strokes/` (true offline) | Plan 3 |
| `lenient-order` leniency mode | Plan 3 or later — high-risk, spec §7.2 |
| TTS MP3 generation pipeline (`speechSynthesis` is the stopgap) | Plan 3 |
| Browse screen (`/browse`) | Plan 3 |
| Stats screen (`/stats`) | Plan 3 |
| Settings screen (`/settings`) with draw-toggle UI | Plan 3 |
| HSK 2-9 data | Plan 3 |
| PWA / service worker / install prompt | Plan 3 |
| i18n (French UI strings) | Plan 3 |

## Follow-up issues to confirm before Plan 3

Record anything discovered during Task 13 manual testing that should feed into Plan 3 planning.

- [ ] *(placeholder — fill during smoke test)*

---

## Self-Review Notes

Checklist performed on this plan before handing off:

1. **Spec coverage:**
   - Spec §4.3 Study flow → Tasks 9-11.
   - Spec §4.4 writing prompt types → Tasks 6-8.
   - Spec §7.2 grader (strict only) → Tasks 2-3.
   - Spec §9 audio fallback to `SpeechSynthesis` → Task 5.
   - Spec §7.2 `lenient-order` risk → explicitly deferred in Out of Scope.
2. **Placeholders:** none — every code step shows the full code. No TODOs.
3. **Type consistency:** `Grade` / `PromptType` / `Word` imported from `@/db/schema` throughout; `FakeWriter.lastQuizOptions` typed in the mock and consumed with the same shape in tests; `StudyPhase` union used consistently.
