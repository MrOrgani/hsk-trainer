import { create } from "zustand";
import type { Word } from "@/db/schema";

export type StudyPhase = "attempt";

interface StudyState {
  queue: Word[];
  index: number;
  phase: StudyPhase;
  start: (words: Word[]) => void;
  commitCurrent: () => void;
  isDone: () => boolean;
  clear: () => void;
}

export const useStudyStore = create<StudyState>((set, get) => ({
  queue: [],
  index: 0,
  phase: "attempt",
  start: (words) => set({ queue: words, index: 0, phase: "attempt" }),
  commitCurrent: () => set((s) => ({ index: s.index + 1, phase: "attempt" })),
  isDone: () => get().index >= get().queue.length,
  clear: () => set({ queue: [], index: 0, phase: "attempt" }),
}));
