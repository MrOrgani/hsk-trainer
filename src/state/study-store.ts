import { create } from "zustand";
import type { Word } from "@/db/schema";

export type StudyPhase = "attempt";

export interface QueueItem {
  word: Word;
  kind: "new" | "review";
}

interface StudyState {
  queue: QueueItem[];
  index: number;
  phase: StudyPhase;
  relearn: QueueItem[];
  inRelearn: boolean;
  start: (items: QueueItem[]) => void;
  commitCurrent: (opts?: { needsRelearn?: boolean }) => void;
  enterRelearnPhase: () => void;
  isDone: () => boolean;
  clear: () => void;
}

export const useStudyStore = create<StudyState>((set, get) => ({
  queue: [],
  index: 0,
  phase: "attempt",
  relearn: [],
  inRelearn: false,
  start: (items) =>
    set({ queue: items, index: 0, phase: "attempt", relearn: [], inRelearn: false }),
  commitCurrent: (opts) =>
    set((s) => {
      const current = s.queue[s.index];
      const shouldRelearn = !!opts?.needsRelearn && !s.inRelearn && current !== undefined;
      return {
        index: s.index + 1,
        phase: "attempt",
        relearn: shouldRelearn ? [...s.relearn, current] : s.relearn,
      };
    }),
  enterRelearnPhase: () =>
    set((s) => ({
      queue: s.relearn,
      relearn: [],
      index: 0,
      inRelearn: true,
      phase: "attempt",
    })),
  isDone: () => get().index >= get().queue.length,
  clear: () =>
    set({ queue: [], index: 0, phase: "attempt", relearn: [], inRelearn: false }),
}));
