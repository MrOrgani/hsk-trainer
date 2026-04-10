# Browse, Stats & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new pages — Browse (vocabulary list), Stats (daily/weekly review stats), and Settings (user preferences) — so users can manage their learning beyond the review/study loop.

**Architecture:** Each page is a TanStack Router file route (`/browse`, `/stats`, `/settings`). Browse queries Dexie `words` + `srsCards` tables to show learned vocabulary with SRS state. Stats aggregates `dailyState` + `reviewLog` tables. Settings reads/writes the `settings` table via the existing `useSettings` hook, extended to support mutations. All pages use the existing Ink & Jade design system (`.card`, `chunky()`, `font-display`, `text-ink-*`, etc.).

**Tech Stack:** React 19, TypeScript, TanStack Router, Dexie (IndexedDB), Tailwind CSS 3, Vitest + Testing Library

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/routes/browse.tsx` | Browse page — searchable vocabulary list |
| Create | `src/routes/stats.tsx` | Stats page — daily/weekly review charts |
| Create | `src/routes/settings.tsx` | Settings page — user preferences form |
| Modify | `src/routes/__root.tsx` | Add Browse, Stats, Settings nav links |
| Modify | `src/state/settings-store.ts` | Add `updateSettings()` mutation helper |
| Create | `src/lib/stats.ts` | Stats aggregation queries (pure data layer) |
| Create | `tests/lib/stats.test.ts` | Unit tests for stats queries |
| Create | `tests/routes/browse.test.tsx` | Browse page rendering tests |
| Create | `tests/routes/settings.test.tsx` | Settings page rendering tests |

---

### Task 1: Settings mutation helper

**Files:**
- Modify: `src/state/settings-store.ts`
- Create: `tests/state/settings-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/state/settings-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/dexie";
import { DEFAULT_SETTINGS } from "@/db/schema";
import { loadOrInitSettings, updateSettings } from "@/state/settings-store";

beforeEach(async () => {
  await db.settings.clear();
});

describe("loadOrInitSettings", () => {
  it("returns defaults when no settings exist", async () => {
    const s = await loadOrInitSettings();
    expect(s.newPerDay).toBe(10);
    expect(s.uiLanguage).toBe("en");
  });

  it("returns existing settings if already stored", async () => {
    await db.settings.put({ ...DEFAULT_SETTINGS, newPerDay: 5 });
    const s = await loadOrInitSettings();
    expect(s.newPerDay).toBe(5);
  });
});

describe("updateSettings", () => {
  it("merges partial updates into stored settings", async () => {
    await loadOrInitSettings(); // seed defaults
    const updated = await updateSettings({ newPerDay: 20, uiLanguage: "fr" });
    expect(updated.newPerDay).toBe(20);
    expect(updated.uiLanguage).toBe("fr");
    expect(updated.sessionSize).toBe(20); // unchanged

    // Verify persistence
    const reloaded = await db.settings.get("default");
    expect(reloaded!.newPerDay).toBe(20);
  });

  it("initialises settings if none exist before updating", async () => {
    const updated = await updateSettings({ newPerDay: 3 });
    expect(updated.newPerDay).toBe(3);
    expect(updated.sessionSize).toBe(20); // rest is default
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/settings-store.test.ts`
Expected: FAIL — `updateSettings` is not exported from `@/state/settings-store`

- [ ] **Step 3: Implement updateSettings**

Modify `src/state/settings-store.ts` — add at the end:

```typescript
export async function updateSettings(
  partial: Partial<Omit<Settings, "id">>
): Promise<Settings> {
  const current = await loadOrInitSettings();
  const merged: Settings = { ...current, ...partial, id: "default" };
  await db.settings.put(merged);
  return merged;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state/settings-store.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/state/settings-store.ts tests/state/settings-store.test.ts
git commit -m "feat: add updateSettings mutation helper"
```

---

### Task 2: Stats aggregation queries

**Files:**
- Create: `src/lib/stats.ts`
- Create: `tests/lib/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/stats.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/dexie";
import { getWeeklyStats, getOverallStats } from "@/lib/stats";
import type { DailyState, SrsCard } from "@/db/schema";

beforeEach(async () => {
  await db.dailyState.clear();
  await db.srsCards.clear();
  await db.words.clear();
});

function makeDailyState(date: string, newCards: number, reviews: number): DailyState {
  return { date, newCardsIntroduced: newCards, reviewsCompleted: reviews };
}

function makeCard(id: string, state: SrsCard["state"]): SrsCard {
  return {
    id,
    wordId: id.split("::")[0],
    promptType: "recognition",
    state,
    learningStep: 0,
    interval: state === "review" ? 5 : 0,
    easeFactor: 2.5,
    repetitions: state === "review" ? 3 : 0,
    dueDate: Date.now(),
    lastReview: Date.now(),
    createdAt: Date.now(),
  };
}

describe("getWeeklyStats", () => {
  it("returns last 7 days of data, filling missing days with zeros", async () => {
    // Seed 2 days
    await db.dailyState.bulkPut([
      makeDailyState("2026-04-10", 5, 20),
      makeDailyState("2026-04-08", 3, 10),
    ]);

    // now = 2026-04-10T12:00:00
    const now = new Date("2026-04-10T12:00:00").getTime();
    const result = await getWeeklyStats(now);

    expect(result).toHaveLength(7);
    expect(result[6].date).toBe("2026-04-10");
    expect(result[6].reviewsCompleted).toBe(20);
    expect(result[4].date).toBe("2026-04-08");
    expect(result[4].reviewsCompleted).toBe(10);
    // Gaps filled with zeros
    expect(result[5].date).toBe("2026-04-09");
    expect(result[5].reviewsCompleted).toBe(0);
    expect(result[5].newCardsIntroduced).toBe(0);
  });
});

describe("getOverallStats", () => {
  it("counts cards by state", async () => {
    await db.srsCards.bulkPut([
      makeCard("a::recognition", "learning"),
      makeCard("b::recognition", "review"),
      makeCard("c::recognition", "review"),
      makeCard("d::recognition", "new"),
    ]);

    const result = await getOverallStats();
    expect(result.learning).toBe(1);
    expect(result.review).toBe(2);
    expect(result.total).toBe(4);
  });

  it("returns zeros when no cards exist", async () => {
    const result = await getOverallStats();
    expect(result.total).toBe(0);
    expect(result.learning).toBe(0);
    expect(result.review).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/stats.test.ts`
Expected: FAIL — module `@/lib/stats` not found

- [ ] **Step 3: Implement stats queries**

Create `src/lib/stats.ts`:

```typescript
import { db } from "@/db/dexie";
import type { DailyState } from "@/db/schema";

function localDateString(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateString(d.getTime());
}

export async function getWeeklyStats(now: number): Promise<DailyState[]> {
  const today = localDateString(now);
  const startDate = addDays(today, -6);

  const stored = await db.dailyState
    .where("date")
    .between(startDate, today, true, true)
    .toArray();

  const byDate = new Map(stored.map((s) => [s.date, s]));
  const result: DailyState[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i);
    result.push(
      byDate.get(date) ?? { date, newCardsIntroduced: 0, reviewsCompleted: 0 }
    );
  }
  return result;
}

export interface OverallStats {
  total: number;
  learning: number;
  review: number;
  suspended: number;
  newCount: number;
}

export async function getOverallStats(): Promise<OverallStats> {
  const cards = await db.srsCards.toArray();
  let learning = 0;
  let review = 0;
  let suspended = 0;
  let newCount = 0;
  for (const c of cards) {
    if (c.state === "learning") learning++;
    else if (c.state === "review") review++;
    else if (c.state === "suspended") suspended++;
    else newCount++;
  }
  return { total: cards.length, learning, review, suspended, newCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/stats.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts tests/lib/stats.test.ts
git commit -m "feat: add stats aggregation queries"
```

---

### Task 3: Settings page

**Files:**
- Create: `src/routes/settings.tsx`
- Create: `tests/routes/settings.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/routes/settings.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { db } from "@/db/dexie";
import { DEFAULT_SETTINGS } from "@/db/schema";

beforeEach(async () => {
  await db.settings.clear();
  await db.settings.put(DEFAULT_SETTINGS);
});

async function renderSettings() {
  const { SettingsPage } = await import("@/routes/settings");

  const rootRoute = createRootRoute();
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: SettingsPage,
  });
  rootRoute.addChildren([settingsRoute]);

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/settings"] }),
  });

  render(<RouterProvider router={router} />);

  // Wait for async settings load
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

describe("SettingsPage", () => {
  it("renders the settings heading", async () => {
    await renderSettings();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("displays the current newPerDay value", async () => {
    await renderSettings();
    const input = screen.getByLabelText(/new cards per day/i);
    expect(input).toHaveValue(10);
  });

  it("displays the current session size", async () => {
    await renderSettings();
    const input = screen.getByLabelText(/session size/i);
    expect(input).toHaveValue(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/settings.test.tsx`
Expected: FAIL — cannot import `SettingsPage` from `@/routes/settings`

- [ ] **Step 3: Implement the Settings page**

Create `src/routes/settings.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadOrInitSettings, updateSettings } from "@/state/settings-store";
import type { Settings } from "@/db/schema";
import { chunky } from "@/components/Button";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadOrInitSettings().then(setSettings);
  }, []);

  async function handleSave() {
    if (!settings) return;
    const { id, ...rest } = settings;
    await updateSettings(rest);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) {
    return (
      <p className="text-center py-20 text-ink-300 font-semibold uppercase tracking-wider text-sm">
        Loading...
      </p>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-5 pt-10 pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-ink-800 mb-8">
        Settings
      </h1>

      <div className="space-y-6">
        {/* New cards per day */}
        <div className="rounded-xl card p-5">
          <label
            htmlFor="newPerDay"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            New cards per day
          </label>
          <input
            id="newPerDay"
            type="number"
            min={0}
            max={50}
            value={settings.newPerDay}
            onChange={(e) =>
              setSettings({ ...settings, newPerDay: parseInt(e.target.value) || 0 })
            }
            className="w-full rounded-lg border border-ink-200 bg-paper px-4 py-2.5 text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-vermillion-300"
          />
        </div>

        {/* Session size */}
        <div className="rounded-xl card p-5">
          <label
            htmlFor="sessionSize"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            Session size
          </label>
          <input
            id="sessionSize"
            type="number"
            min={5}
            max={50}
            value={settings.sessionSize}
            onChange={(e) =>
              setSettings({
                ...settings,
                sessionSize: parseInt(e.target.value) || 5,
              })
            }
            className="w-full rounded-lg border border-ink-200 bg-paper px-4 py-2.5 text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-vermillion-300"
          />
        </div>

        {/* Language */}
        <div className="rounded-xl card p-5">
          <label
            htmlFor="uiLanguage"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            Interface language
          </label>
          <select
            id="uiLanguage"
            value={settings.uiLanguage}
            onChange={(e) =>
              setSettings({
                ...settings,
                uiLanguage: e.target.value as "en" | "fr",
              })
            }
            className="w-full rounded-lg border border-ink-200 bg-paper px-4 py-2.5 text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-vermillion-300"
          >
            <option value="en">English</option>
            <option value="fr">French</option>
          </select>
        </div>

        {/* Leniency */}
        <div className="rounded-xl card p-5">
          <label
            htmlFor="leniency"
            className="block text-sm font-semibold text-ink-500 mb-2"
          >
            Stroke order leniency
          </label>
          <select
            id="leniency"
            value={settings.leniency}
            onChange={(e) =>
              setSettings({
                ...settings,
                leniency: e.target.value as "strict" | "lenient-order",
              })
            }
            className="w-full rounded-lg border border-ink-200 bg-paper px-4 py-2.5 text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-vermillion-300"
          >
            <option value="strict">Strict</option>
            <option value="lenient-order">Lenient (order)</option>
          </select>
        </div>

        {/* Save button */}
        <button onClick={handleSave} className={chunky("primary", "w-full")}>
          {saved ? "Saved!" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes/settings.test.tsx`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings.tsx tests/routes/settings.test.tsx
git commit -m "feat: add Settings page with newPerDay, sessionSize, language, leniency"
```

---

### Task 4: Browse page

**Files:**
- Create: `src/routes/browse.tsx`
- Create: `tests/routes/browse.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/routes/browse.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { db } from "@/db/dexie";
import type { Word, SrsCard } from "@/db/schema";

const WORD: Word = {
  id: "\u4F60\u597D",
  characters: ["\u4F60", "\u597D"],
  pinyin: "n\u01D0 h\u01CEo",
  pinyinNumeric: "ni3hao3",
  meaningEn: "hello",
  meaningFr: "bonjour",
  frequency: 1,
  hskLevel: 1,
  audioFile: "ni3hao3.mp3",
};

const CARD: SrsCard = {
  id: "\u4F60\u597D::recognition",
  wordId: "\u4F60\u597D",
  promptType: "recognition",
  state: "review",
  learningStep: 0,
  interval: 5,
  easeFactor: 2.5,
  repetitions: 3,
  dueDate: Date.now() + 86400000,
  lastReview: Date.now(),
  createdAt: Date.now() - 86400000 * 10,
};

beforeEach(async () => {
  await db.words.clear();
  await db.srsCards.clear();
  await db.words.put(WORD);
  await db.srsCards.put(CARD);
});

async function renderBrowse() {
  const { BrowsePage } = await import("@/routes/browse");

  const rootRoute = createRootRoute();
  const browseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/browse",
    component: BrowsePage,
  });
  rootRoute.addChildren([browseRoute]);

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/browse"] }),
  });

  render(<RouterProvider router={router} />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

describe("BrowsePage", () => {
  it("renders the page heading", async () => {
    await renderBrowse();
    expect(screen.getByText("Vocabulary")).toBeInTheDocument();
  });

  it("displays the word character and meaning", async () => {
    await renderBrowse();
    expect(screen.getByText("\u4F60\u597D")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("shows the SRS state badge", async () => {
    await renderBrowse();
    expect(screen.getByText(/review/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/browse.test.tsx`
Expected: FAIL — cannot import `BrowsePage` from `@/routes/browse`

- [ ] **Step 3: Implement the Browse page**

Create `src/routes/browse.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/db/dexie";
import type { Word, SrsCard, CardState } from "@/db/schema";

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
});

interface WordWithState {
  word: Word;
  state: CardState | "unseen";
}

const STATE_COLORS: Record<string, string> = {
  unseen: "bg-ink-100 text-ink-400",
  new: "bg-ink-200 text-ink-500",
  learning: "bg-gold-100 text-gold-700",
  review: "bg-jade-100 text-jade-700",
  suspended: "bg-vermillion-100 text-vermillion-700",
};

export function BrowsePage() {
  const [items, setItems] = useState<WordWithState[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const words = await db.words.orderBy("frequency").toArray();
      const cards = await db.srsCards.toArray();

      // Best state per word: review > learning > new > unseen
      const stateByWord = new Map<string, CardState>();
      for (const card of cards) {
        const prev = stateByWord.get(card.wordId);
        if (!prev || statePriority(card.state) > statePriority(prev)) {
          stateByWord.set(card.wordId, card.state);
        }
      }

      setItems(
        words.map((word) => ({
          word,
          state: stateByWord.get(word.id) ?? "unseen",
        }))
      );
    })();
  }, []);

  const filtered = search.trim()
    ? items.filter(
        ({ word }) =>
          word.id.includes(search) ||
          word.pinyin.toLowerCase().includes(search.toLowerCase()) ||
          word.meaningEn.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-ink-800 mb-6">
        Vocabulary
      </h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by character, pinyin, or meaning..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-ink-200 bg-paper px-4 py-3 text-ink-800 font-medium placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-vermillion-300 mb-6"
      />

      {/* Word list */}
      <div className="space-y-2">
        {filtered.map(({ word, state }) => (
          <div
            key={word.id}
            className="rounded-xl card px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-4"
          >
            <span className="font-hanzi text-2xl sm:text-3xl font-black text-ink-800 min-w-[3rem]">
              {word.id}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-semibold text-ink-700 truncate">
                {word.pinyin}
              </p>
              <p className="text-xs sm:text-sm text-ink-400 truncate">
                {word.meaningEn}
              </p>
            </div>
            <span
              className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${STATE_COLORS[state]}`}
            >
              {state === "unseen" ? "new" : state}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-ink-300 font-medium">
            No words found.
          </p>
        )}
      </div>
    </div>
  );
}

function statePriority(state: CardState): number {
  switch (state) {
    case "review":
      return 3;
    case "learning":
      return 2;
    case "new":
      return 1;
    case "suspended":
      return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes/browse.test.tsx`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/browse.tsx tests/routes/browse.test.tsx
git commit -m "feat: add Browse page with search and SRS state badges"
```

---

### Task 5: Stats page

**Files:**
- Create: `src/routes/stats.tsx`

- [ ] **Step 1: Implement the Stats page**

Create `src/routes/stats.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getWeeklyStats, getOverallStats, type OverallStats } from "@/lib/stats";
import type { DailyState } from "@/db/schema";

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});

export function StatsPage() {
  const [weekly, setWeekly] = useState<DailyState[]>([]);
  const [overall, setOverall] = useState<OverallStats | null>(null);

  useEffect(() => {
    const now = Date.now();
    getWeeklyStats(now).then(setWeekly);
    getOverallStats().then(setOverall);
  }, []);

  const maxReviews = Math.max(1, ...weekly.map((d) => d.reviewsCompleted));

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-ink-800 mb-8">
        Statistics
      </h1>

      {/* Overall stats cards */}
      {overall && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl card p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              Total cards
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-ink-800">
              {overall.total}
            </p>
          </div>
          <div className="rounded-xl card p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              Learning
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-gold-500">
              {overall.learning}
            </p>
          </div>
          <div className="rounded-xl card p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              Reviewing
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-jade-500">
              {overall.review}
            </p>
          </div>
        </div>
      )}

      {/* Weekly review bar chart */}
      <div className="rounded-xl card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 mb-4">
          Reviews this week
        </h2>
        <div className="flex items-end gap-2 h-32">
          {weekly.map((day) => {
            const height =
              day.reviewsCompleted > 0
                ? Math.max(8, (day.reviewsCompleted / maxReviews) * 100)
                : 4;
            const dayLabel = new Date(day.date + "T00:00:00").toLocaleDateString(
              "en",
              { weekday: "short" }
            );
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums text-ink-400">
                  {day.reviewsCompleted > 0 ? day.reviewsCompleted : ""}
                </span>
                <div
                  className={`w-full rounded-t-md transition-all ${
                    day.reviewsCompleted > 0
                      ? "bg-gradient-to-t from-jade-500 to-jade-400"
                      : "bg-ink-100"
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] font-semibold text-ink-300">
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly new cards bar chart */}
      {(() => {
        const maxNew = Math.max(1, ...weekly.map((d) => d.newCardsIntroduced));
        return (
          <div className="rounded-xl card p-5 mt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 mb-4">
              New cards this week
            </h2>
            <div className="flex items-end gap-2 h-32">
              {weekly.map((day) => {
                const height =
                  day.newCardsIntroduced > 0
                    ? Math.max(8, (day.newCardsIntroduced / maxNew) * 100)
                    : 4;
                const dayLabel = new Date(
                  day.date + "T00:00:00"
                ).toLocaleDateString("en", { weekday: "short" });
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] font-bold tabular-nums text-ink-400">
                      {day.newCardsIntroduced > 0 ? day.newCardsIntroduced : ""}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        day.newCardsIntroduced > 0
                          ? "bg-gradient-to-t from-gold-500 to-gold-400"
                          : "bg-ink-100"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] font-semibold text-ink-300">
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/stats.tsx
git commit -m "feat: add Stats page with weekly bar charts and overall card counts"
```

---

### Task 6: Update navigation

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add Browse, Stats, Settings links to the nav**

In `src/routes/__root.tsx`, replace the `<nav>` element contents (lines 29-46) with:

```tsx
<nav className="flex items-center gap-1 sm:gap-1.5">
  <Link
    to="/"
    className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-vermillion-500 hover:bg-vermillion-50 [&.active]:text-vermillion-600 [&.active]:bg-vermillion-50 transition-colors"
  >
    Home
  </Link>
  <Link
    to="/study"
    className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-jade-600 hover:bg-jade-50 [&.active]:text-jade-600 [&.active]:bg-jade-50 transition-colors"
  >
    Study
  </Link>
  <Link
    to="/review"
    className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-gold-600 hover:bg-gold-50 [&.active]:text-gold-600 [&.active]:bg-gold-50 transition-colors"
  >
    Review
  </Link>
  <Link
    to="/browse"
    className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-jade-600 hover:bg-jade-50 [&.active]:text-jade-600 [&.active]:bg-jade-50 transition-colors"
  >
    Browse
  </Link>
  <Link
    to="/stats"
    className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-gold-600 hover:bg-gold-50 [&.active]:text-gold-600 [&.active]:bg-gold-50 transition-colors"
  >
    Stats
  </Link>
  <Link
    to="/settings"
    className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-ink-600 hover:bg-ink-50 [&.active]:text-ink-600 [&.active]:bg-ink-100 transition-colors"
  >
    Settings
  </Link>
</nav>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: add Browse, Stats, Settings links to navigation"
```

---

## Self-Review

**Spec coverage:**
- Settings page: newPerDay, sessionSize, uiLanguage, leniency --- covered in Task 3
- Browse page: word list, search, SRS state --- covered in Task 4
- Stats page: weekly charts, overall card counts --- covered in Task 5
- Navigation: all routes linked --- covered in Task 6
- Settings mutation: `updateSettings()` --- covered in Task 1
- Stats queries: `getWeeklyStats()`, `getOverallStats()` --- covered in Task 2

**Placeholder scan:** No TBD, TODO, "implement later", or "similar to Task N" found.

**Type consistency:**
- `updateSettings` signature matches usage in Task 3 (takes `Partial<Omit<Settings, "id">>`)
- `getWeeklyStats` returns `DailyState[]`, used in Task 5
- `getOverallStats` returns `OverallStats`, used in Task 5
- `BrowsePage` and `SettingsPage` are named exports, matching test imports
- `statePriority` uses `CardState` from schema
