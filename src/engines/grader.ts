import type { Grade } from "@/db/schema";

export interface CharAttempt {
  strokeCount: number;
  mistakes: number;
}

/**
 * Per-character accuracy = 1 minus the mistake rate, clamped to [0, 1].
 * A character with zero strokes is a data error; return 0 so it never
 * contributes a misleading "perfect" score to the average.
 */
export function perCharAccuracy({ strokeCount, mistakes }: CharAttempt): number {
  if (strokeCount <= 0) return 0;
  const raw = 1 - mistakes / strokeCount;
  return Math.max(0, Math.min(1, raw));
}

/** Mean of the per-character accuracy scores. Empty → 0. */
export function combineAccuracy(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

/**
 * Seeds the Grade buttons after a writing attempt.
 * Perfect → good. Middling → hard. Below 0.5 → again.
 * "easy" is never auto-suggested; it is an explicit user judgement.
 */
export function suggestGrade(accuracy: number): Grade {
  if (accuracy >= 1) return "good";
  if (accuracy >= 0.5) return "hard";
  return "again";
}
