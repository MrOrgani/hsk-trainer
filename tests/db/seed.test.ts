import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/dexie";
import { seedHskLevel } from "@/lib/seed";

describe("seedHskLevel", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("loads HSK 1 words into the words table on first call", async () => {
    const mockWords = [
      {
        id: "你好",
        hskLevel: 1,
        characters: ["你", "好"],
        pinyin: "nǐ hǎo",
        pinyinNumeric: "ni3hao3",
        meaningEn: "hello",
        meaningFr: "bonjour",
        frequency: 1,
        audioFile: "ni3hao3.mp3",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWords,
    });
    vi.stubGlobal("fetch", fetchMock);

    await seedHskLevel(1);

    const all = await db.words.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("你好");
    expect(fetchMock).toHaveBeenCalledWith("/data/hsk-1.json");
  });

  it("is idempotent — calling twice does not duplicate", async () => {
    const mockWords = [
      {
        id: "水",
        hskLevel: 1,
        characters: ["水"],
        pinyin: "shuǐ",
        pinyinNumeric: "shui3",
        meaningEn: "water",
        meaningFr: "eau",
        frequency: 6,
        audioFile: "shui3.mp3",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockWords })
    );

    await seedHskLevel(1);
    await seedHskLevel(1);

    const all = await db.words.toArray();
    expect(all).toHaveLength(1);
  });
});
