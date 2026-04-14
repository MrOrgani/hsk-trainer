import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react";
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
  afterEach(() => {
    cleanup();
  });

  it("goes directly to attempt phase and completes", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const router = buildRouter();
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    // Should show level picker first
    await waitFor(() =>
      expect(screen.getByText(/HSK 1/)).toBeInTheDocument()
    );

    // Pick HSK 1
    fireEvent.click(screen.getByText(/HSK 1/));

    // Should proceed to drawing (attempt) phase
    await waitFor(() =>
      expect(screen.getByText(/write from memory/i)).toBeInTheDocument()
    );

    // The drawing canvas should be active
    await waitFor(() => expect(fakeWriters.length).toBeGreaterThan(0));
    const opts = fakeWriters[fakeWriters.length - 1].lastQuizOptions as {
      onComplete?: (r: { totalMistakes: number }) => void;
    };
    await act(async () => opts.onComplete?.({ totalMistakes: 0 }));

    vi.useRealTimers();

    // Should auto-advance to "all done" after VIEWING_DELAY_MS and DB commit.
    await waitFor(
      () => expect(screen.getByText(/all done/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );
    const cards = await db.srsCards.toArray();
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].wordId).toBe("你");
    // With 0 mistakes, should be graded "easy" -> review state with 4-day interval
    expect(cards[0].state).toBe("review");
    expect(cards[0].interval).toBe(4);
  });
});
