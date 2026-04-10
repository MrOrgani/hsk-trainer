import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Source data types (drkameleon/complete-hsk-vocabulary)
// ---------------------------------------------------------------------------

interface Transcriptions {
  pinyin: string;
  numeric: string;
  wadegiles: string;
  bopomofo: string;
  romatzyh: string;
}

interface Form {
  traditional: string;
  transcriptions: Transcriptions;
  meanings: string[];
  classifiers: string[];
}

interface SourceEntry {
  simplified: string;
  radical: string;
  frequency: number;
  pos: string[];
  forms: Form[];
}

// ---------------------------------------------------------------------------
// App output type (mirrors src/db/schema.ts Word)
// ---------------------------------------------------------------------------

interface OutputWord {
  id: string;
  hskLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  characters: string[];
  pinyin: string;
  pinyinNumeric: string;
  meaningEn: string;
  meaningFr: string;
  frequency: number;
  audioFile: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type HskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Remove spaces and lowercase: "ai4 hao4" -> "ai4hao4" */
function toCompactNumeric(numeric: string): string {
  return numeric.replace(/\s+/g, "").toLowerCase();
}

const BASE_URL =
  "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main";

async function fetchLevel(level: HskLevel): Promise<SourceEntry[]> {
  const url = `${BASE_URL}/wordlists/exclusive/new/${level}.json`;
  console.log(`  Fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch HSK ${level}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SourceEntry[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, "..");
  const outDir = path.join(rootDir, "public", "data");

  await mkdir(outDir, { recursive: true });

  let totalWords = 0;

  for (const level of [1, 2, 3, 4, 5, 6, 7] as HskLevel[]) {
    const entries = await fetchLevel(level);

    const words: OutputWord[] = [];

    for (const entry of entries) {
      // Use the first form (primary reading)
      const form = entry.forms[0];
      if (!form) continue;

      const pinyin = form.transcriptions.pinyin;
      const pinyinNumeric = toCompactNumeric(form.transcriptions.numeric);
      const meaningEn = form.meanings.join("; ");

      words.push({
        id: entry.simplified,
        hskLevel: level,
        characters: [...entry.simplified],
        pinyin,
        pinyinNumeric,
        meaningEn,
        meaningFr: "",
        frequency: 0, // assigned below
        audioFile: `${pinyinNumeric}.mp3`,
      });
    }

    // Sort alphabetically by pinyin for stable ordering, then assign sequential frequency
    words.sort((a, b) => a.pinyin.localeCompare(b.pinyin, "zh"));

    for (let i = 0; i < words.length; i++) {
      words[i].frequency = i + 1;
    }

    const outPath = path.join(outDir, `hsk-${level}.json`);
    await writeFile(outPath, JSON.stringify(words, null, 2), "utf-8");
    console.log(`  HSK ${level}: ${words.length} words -> ${outPath}`);
    totalWords += words.length;
  }

  console.log(`\nTotal: ${totalWords} words across 7 levels`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
