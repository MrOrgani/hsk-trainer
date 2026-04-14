"""Generate MP3 audio files for HSK words using Microsoft Edge TTS."""

import asyncio
import json
import os
import sys

import edge_tts

VOICE = "zh-CN-XiaoxiaoNeural"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")


async def generate(level: int):
    path = os.path.join(DATA_DIR, f"hsk-{level}.json")
    if not os.path.exists(path):
        print(f"File not found: {path}")
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        words = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = len(words)
    skipped = 0
    generated = 0

    for i, word in enumerate(words, 1):
        char = word["id"]
        filename = word["audioFile"]
        out = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(out):
            skipped += 1
            continue

        try:
            tts = edge_tts.Communicate(char, VOICE)
            await tts.save(out)
            generated += 1
            print(f"  [{i}/{total}] {char} → {filename}")
        except Exception as e:
            print(f"  [{i}/{total}] FAILED {char}: {e}")

    print(f"\nDone — generated: {generated}, skipped: {skipped}, total: {total}")


if __name__ == "__main__":
    level = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    print(f"Generating audio for HSK {level} ({VOICE})...\n")
    asyncio.run(generate(level))
