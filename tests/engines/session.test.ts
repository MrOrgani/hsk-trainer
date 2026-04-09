import { describe, expect, it } from "vitest";
import { computeBucketTargets, buildSessionQueue } from "@/engines/session";
import type { SrsCard } from "@/db/schema";

describe("computeBucketTargets", () => {
  it("rounds target counts to sum at or below sessionSize", () => {
    const targets = computeBucketTargets(
      { recognition: 0.5, writing: 0.25, audioChoice: 0.25 },
      20
    );
    expect(targets).toEqual({ recognition: 10, writing: 5, audioChoice: 5 });
  });

  it("handles uneven ratios with rounding", () => {
    const targets = computeBucketTargets(
      { recognition: 0.6, writing: 0.2, audioChoice: 0.2 },
      10
    );
    expect(targets.recognition + targets.writing + targets.audioChoice).toBeLessThanOrEqual(10);
    expect(targets.recognition).toBe(6);
  });
});

function card(wordId: string, promptType: SrsCard["promptType"], dueDate: number): SrsCard {
  return {
    id: `${wordId}::${promptType}`,
    wordId,
    promptType,
    state: "review",
    learningStep: 0,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 1,
    dueDate,
    lastReview: null,
    createdAt: 0,
  };
}

describe("buildSessionQueue", () => {
  it("fills each bucket up to its target, ordered by dueDate ascending", () => {
    const due: SrsCard[] = [
      card("a", "recognition", 10),
      card("b", "recognition", 20),
      card("c", "recognition", 30),
      card("d", "audio-to-word", 5),
      card("e", "meaning-to-word", 15),
    ];
    const queue = buildSessionQueue(due, {
      recognition: 2,
      writing: 0,
      audioChoice: 2,
    });

    const ids = queue.map((c) => c.wordId).sort();
    expect(ids).toEqual(["a", "b", "d", "e"]);
  });

  it("backfills shortfall proportionally to other buckets", () => {
    const due: SrsCard[] = [
      card("a", "recognition", 1),
      card("b", "recognition", 2),
      card("c", "recognition", 3),
      card("d", "audio-to-word", 4),
      card("e", "audio-to-word", 5),
      card("f", "audio-to-word", 6),
    ];
    const queue = buildSessionQueue(due, {
      recognition: 2,
      writing: 2,
      audioChoice: 2,
    });

    expect(queue).toHaveLength(6);
  });

  it("runs short when nothing can fill the shortfall", () => {
    const due: SrsCard[] = [card("a", "recognition", 1)];
    const queue = buildSessionQueue(due, {
      recognition: 5,
      writing: 5,
      audioChoice: 5,
    });
    expect(queue).toHaveLength(1);
  });
});
