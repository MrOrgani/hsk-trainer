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
    expect(onComplete).toHaveBeenCalledWith({
      mistakes: 2,
      strokeMistakes: [],
      hintsUsed: 0,
      fullRevealUsed: false,
    });
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

  it("does not recreate the writer when onComplete changes", () => {
    const { rerender } = render(
      <DrawingCanvas character="我" onComplete={() => {}} />
    );
    rerender(<DrawingCanvas character="我" onComplete={() => {}} />);
    expect(fakeWriters).toHaveLength(1);
  });
});
