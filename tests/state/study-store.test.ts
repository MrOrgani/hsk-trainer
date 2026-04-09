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
    useStudyStore.getState().nextPhase();
    useStudyStore.getState().nextPhase();
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
