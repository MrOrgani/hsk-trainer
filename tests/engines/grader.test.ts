import { describe, expect, it } from "vitest";
import {
  combineAccuracy,
  perCharAccuracy,
  suggestGrade,
} from "@/engines/grader";

describe("perCharAccuracy", () => {
  it("returns 1 for zero mistakes", () => {
    expect(perCharAccuracy({ strokeCount: 5, mistakes: 0 })).toBe(1);
  });

  it("decreases linearly with mistakes", () => {
    expect(perCharAccuracy({ strokeCount: 5, mistakes: 1 })).toBeCloseTo(0.8);
    expect(perCharAccuracy({ strokeCount: 5, mistakes: 2 })).toBeCloseTo(0.6);
  });

  it("floors at 0 — cannot go negative", () => {
    expect(perCharAccuracy({ strokeCount: 3, mistakes: 10 })).toBe(0);
  });

  it("returns 0 for a char with zero strokes (defensive)", () => {
    expect(perCharAccuracy({ strokeCount: 0, mistakes: 0 })).toBe(0);
  });
});

describe("combineAccuracy", () => {
  it("averages per-character scores", () => {
    expect(combineAccuracy([1, 1, 1])).toBe(1);
    expect(combineAccuracy([1, 0.5])).toBeCloseTo(0.75);
    expect(combineAccuracy([0.8, 0.6, 0.4])).toBeCloseTo(0.6);
  });

  it("returns 0 for an empty list", () => {
    expect(combineAccuracy([])).toBe(0);
  });
});

describe("suggestGrade", () => {
  it("returns 'good' for perfect accuracy", () => {
    expect(suggestGrade(1)).toBe("good");
  });

  it("returns 'hard' for mid accuracy", () => {
    expect(suggestGrade(0.75)).toBe("hard");
    expect(suggestGrade(0.5)).toBe("hard");
  });

  it("returns 'again' for low accuracy", () => {
    expect(suggestGrade(0.49)).toBe("again");
    expect(suggestGrade(0)).toBe("again");
  });

  it("does not suggest 'easy' — user must opt into it manually", () => {
    expect(suggestGrade(1.0)).not.toBe("easy");
  });
});
