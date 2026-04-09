import { vi, beforeEach } from "vitest";

/**
 * Controllable fake for `hanzi-writer`. Tests can read `lastQuizOptions` to
 * drive quiz callbacks imperatively (simulate strokes, mistakes, completion).
 */
export interface FakeWriter {
  character: string;
  quiz: ReturnType<typeof vi.fn>;
  animateCharacter: ReturnType<typeof vi.fn>;
  cancelQuiz: ReturnType<typeof vi.fn>;
  hideCharacter: ReturnType<typeof vi.fn>;
  lastQuizOptions: Record<string, unknown> | null;
}

export const fakeWriters: FakeWriter[] = [];

export function installHanziWriterMock() {
  vi.mock("hanzi-writer", () => {
    return {
      default: {
        create: vi.fn((_target: HTMLElement, character: string) => {
          const instance: FakeWriter = {
            character,
            lastQuizOptions: null,
            quiz: vi.fn((opts: Record<string, unknown>) => {
              instance.lastQuizOptions = opts;
            }),
            animateCharacter: vi.fn((opts?: { onComplete?: () => void }) => {
              opts?.onComplete?.();
            }),
            cancelQuiz: vi.fn(),
            hideCharacter: vi.fn(),
          };
          fakeWriters.push(instance);
          return instance;
        }),
        loadCharacterData: vi.fn(async () => ({ strokes: [], medians: [] })),
      },
    };
  });
  // Safety net: clear the captured writers between every test so stale
  // instances from a previous test never leak into the next one.
  beforeEach(() => {
    fakeWriters.length = 0;
  });
}

export function resetHanziWriterMock() {
  fakeWriters.length = 0;
}
