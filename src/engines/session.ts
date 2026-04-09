import type { PromptType, SrsCard, Settings } from "@/db/schema";

export type Bucket = "recognition" | "writing" | "audioChoice";

export function computeBucketTargets(
  mix: Settings["sessionMix"],
  sessionSize: number
): Record<Bucket, number> {
  return {
    recognition: Math.round(sessionSize * mix.recognition),
    writing: Math.round(sessionSize * mix.writing),
    audioChoice: Math.round(sessionSize * mix.audioChoice),
  };
}

export function promptTypesForBucket(bucket: Bucket): PromptType[] {
  if (bucket === "recognition") return ["recognition"];
  if (bucket === "audioChoice") return ["audio-to-word", "meaning-to-word"];
  return ["audio-to-draw", "meaning-to-draw"];
}

export function buildSessionQueue(
  dueCards: SrsCard[],
  targets: Record<Bucket, number>
): SrsCard[] {
  const buckets: Bucket[] = ["recognition", "writing", "audioChoice"];
  const poolByBucket: Record<Bucket, SrsCard[]> = {
    recognition: [],
    writing: [],
    audioChoice: [],
  };
  for (const card of dueCards) {
    for (const bucket of buckets) {
      if (promptTypesForBucket(bucket).includes(card.promptType)) {
        poolByBucket[bucket].push(card);
        break;
      }
    }
  }
  for (const bucket of buckets) {
    poolByBucket[bucket].sort((a, b) => a.dueDate - b.dueDate);
  }

  const taken: Record<Bucket, SrsCard[]> = {
    recognition: [],
    writing: [],
    audioChoice: [],
  };
  const remaining: Record<Bucket, SrsCard[]> = {
    recognition: [...poolByBucket.recognition],
    writing: [...poolByBucket.writing],
    audioChoice: [...poolByBucket.audioChoice],
  };
  let shortfall = 0;
  for (const bucket of buckets) {
    const target = targets[bucket];
    const take = Math.min(target, remaining[bucket].length);
    taken[bucket] = remaining[bucket].splice(0, take);
    shortfall += target - take;
  }

  while (shortfall > 0) {
    let progressed = false;
    for (const bucket of buckets) {
      if (shortfall === 0) break;
      if (remaining[bucket].length > 0) {
        taken[bucket].push(remaining[bucket].shift()!);
        shortfall--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  const result: SrsCard[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const bucket of buckets) {
      const next = taken[bucket].shift();
      if (next) {
        result.push(next);
        added = true;
      }
    }
  }
  return result;
}
