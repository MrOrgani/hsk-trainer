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
  beforeEach(() => resetHanziWriterMock());
  afterEach(() => cleanup());

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

    expect(fakeWriters).toHaveLength(2);
    expect(fakeWriters[1].character).toBe("好");
  });

  it("reveals answer and grade buttons after all characters are drawn", async () => {
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

    await act(async () => {
      screen.getByRole("button", { name: /good/i }).click();
    });
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
