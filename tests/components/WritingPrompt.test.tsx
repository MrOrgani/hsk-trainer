import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
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
  beforeEach(() => {
    resetHanziWriterMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the first character canvas and advances on completion", async () => {
    const onGrade = vi.fn();
    render(
      <WritingPrompt word={WORD} promptType="meaning-to-draw" onGrade={onGrade} />
    );
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

    // Advance past the 800ms viewing delay
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // Fire the shrink transition end
    const shrinkWrapper = document.querySelector("[style*='transform']");
    if (shrinkWrapper) {
      await act(async () => {
        shrinkWrapper.dispatchEvent(new Event("transitionend", { bubbles: true }));
      });
    }

    expect(fakeWriters).toHaveLength(2);
    expect(fakeWriters[1].character).toBe("好");
  });

  it("reveals answer and auto-grades after all characters are drawn", async () => {
    const onGrade = vi.fn();
    render(
      <WritingPrompt word={WORD} promptType="meaning-to-draw" onGrade={onGrade} />
    );

    // Complete first character (0 mistakes)
    const a = fakeWriters[0].lastQuizOptions as { onComplete?: () => void };
    await act(async () => a.onComplete?.());

    // Advance past viewing delay, then trigger shrink transition end
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    const shrinkWrapper = document.querySelector("[style*='transform']");
    if (shrinkWrapper) {
      await act(async () => {
        shrinkWrapper.dispatchEvent(new Event("transitionend", { bubbles: true }));
      });
    }

    // Complete second (last) character (0 mistakes)
    const b = fakeWriters[1].lastQuizOptions as { onComplete?: () => void };
    await act(async () => b.onComplete?.());

    // Advance past viewing delay for last char (no shrink needed)
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText("nǐ hǎo")).toBeInTheDocument();
    expect(screen.getAllByText("hello").length).toBeGreaterThan(0);
    // 0 mistakes → auto-grade "easy", badge shown
    expect(screen.getByText(/Easy/)).toBeInTheDocument();
    expect(screen.getByText(/Tap to continue/i)).toBeInTheDocument();

    // Tap to advance immediately
    await act(async () => {
      screen.getByText(/Easy/).click();
    });
    expect(onGrade).toHaveBeenCalledWith("easy");
  });

  it("auto-advances after timeout in reveal phase", async () => {
    const onGrade = vi.fn();
    render(
      <WritingPrompt word={WORD} promptType="meaning-to-draw" onGrade={onGrade} />
    );

    // Complete first character
    const a = fakeWriters[0].lastQuizOptions as { onComplete?: () => void };
    await act(async () => a.onComplete?.());
    await act(async () => { vi.advanceTimersByTime(1500); });
    const shrinkWrapper = document.querySelector("[style*='transform']");
    if (shrinkWrapper) {
      await act(async () => {
        shrinkWrapper.dispatchEvent(new Event("transitionend", { bubbles: true }));
      });
    }

    // Complete second character
    const b = fakeWriters[1].lastQuizOptions as { onComplete?: () => void };
    await act(async () => b.onComplete?.());
    await act(async () => { vi.advanceTimersByTime(1500); });

    // Now in reveal phase, wait for auto-advance (2500ms)
    expect(onGrade).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(onGrade).toHaveBeenCalledWith("easy");
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
