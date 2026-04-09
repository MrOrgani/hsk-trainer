import { create } from "zustand";
import type { SrsCard, Word } from "@/db/schema";

interface SessionState {
  queue: Array<{ card: SrsCard; word: Word }>;
  index: number;
  start(items: Array<{ card: SrsCard; word: Word }>): void;
  advance(): void;
  clear(): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  queue: [],
  index: 0,
  start: (items) => set({ queue: items, index: 0 }),
  advance: () => set((s) => ({ index: s.index + 1 })),
  clear: () => set({ queue: [], index: 0 }),
}));
