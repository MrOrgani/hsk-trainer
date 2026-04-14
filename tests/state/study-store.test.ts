import { describe, it, expect, beforeEach } from "vitest";
import { useStudyStore, type QueueItem } from "@/state/study-store";
import type { Word } from "@/db/schema";

const W1: Word = {
  id: "你", hskLevel: 1, characters: ["你"], pinyin: "nǐ",
  pinyinNumeric: "ni3", meaningEn: "you", meaningFr: "tu", frequency: 4,
  audioFile: "ni3.mp3",
};
const W2: Word = { ...W1, id: "好", characters: ["好"], pinyin: "hǎo", meaningEn: "good" };

const I1: QueueItem = { word: W1, kind: "new" };
const I2: QueueItem = { word: W2, kind: "new" };

describe("study-store", () => {
  beforeEach(() => useStudyStore.getState().clear());

  it("starts a queue and begins in 'attempt' phase", () => {
    useStudyStore.getState().start([I1, I2]);
    const s = useStudyStore.getState();
    expect(s.queue).toHaveLength(2);
    expect(s.index).toBe(0);
    expect(s.phase).toBe("attempt");
  });

  it("commits the current word, moves to the next, and resets phase", () => {
    useStudyStore.getState().start([I1, I2]);
    useStudyStore.getState().commitCurrent();
    const s = useStudyStore.getState();
    expect(s.index).toBe(1);
    expect(s.phase).toBe("attempt");
  });

  it("past the last word the store is in a 'done' state", () => {
    useStudyStore.getState().start([I1]);
    useStudyStore.getState().commitCurrent();
    expect(useStudyStore.getState().index).toBe(1);
    expect(useStudyStore.getState().isDone()).toBe(true);
  });

  it("pushes items with mistakes into the relearn queue", () => {
    useStudyStore.getState().start([I1, I2]);
    useStudyStore.getState().commitCurrent({ needsRelearn: true });
    useStudyStore.getState().commitCurrent({ needsRelearn: false });
    expect(useStudyStore.getState().relearn).toHaveLength(1);
    expect(useStudyStore.getState().relearn[0].word.id).toBe("你");
  });

  it("enterRelearnPhase replays the relearn items from index 0", () => {
    useStudyStore.getState().start([I1, I2]);
    useStudyStore.getState().commitCurrent({ needsRelearn: true });
    useStudyStore.getState().commitCurrent({ needsRelearn: true });
    useStudyStore.getState().enterRelearnPhase();
    const s = useStudyStore.getState();
    expect(s.queue).toHaveLength(2);
    expect(s.index).toBe(0);
    expect(s.inRelearn).toBe(true);
    expect(s.relearn).toHaveLength(0);
  });

  it("in relearn mode, needsRelearn does not re-enqueue (one pass cap)", () => {
    useStudyStore.getState().start([I1]);
    useStudyStore.getState().commitCurrent({ needsRelearn: true });
    useStudyStore.getState().enterRelearnPhase();
    useStudyStore.getState().commitCurrent({ needsRelearn: true });
    expect(useStudyStore.getState().relearn).toHaveLength(0);
  });
});
