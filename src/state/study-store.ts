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
