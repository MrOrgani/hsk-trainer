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
// CFDICT – Chinese-French dictionary (CC BY-SA 3.0)
// Format per line: Traditional Simplified [pinyin] /def1/def2/.../
// Source: https://chine.in/mandarin/dictionnaire/CFDICT/
// ---------------------------------------------------------------------------

const CFDICT_URL = "https://chine.in/mandarin/dictionnaire/CFDICT/cfdict.u8";

/** Parse the CFDICT file into a Map<simplified, frenchDefinitions> */
async function fetchCfdict(): Promise<Map<string, string>> {
  console.log(`  Fetching CFDICT from ${CFDICT_URL}`);
  const res = await fetch(CFDICT_URL);
  if (!res.ok) {
    console.warn(`  ⚠ Failed to fetch CFDICT: ${res.status} – French translations will be empty`);
    return new Map();
  }

  const text = await res.text();
  const dict = new Map<string, string[]>();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Split into: Traditional, Simplified, rest ([pinyin] /defs/)
    const parts = trimmed.split(" ", 2);
    if (parts.length < 2) continue;

    const simplified = parts[1];
    const rest = trimmed.slice(parts[0].length + 1 + simplified.length);
    const bracketEnd = rest.indexOf("]");
    if (bracketEnd < 0) continue;

    const defsPart = rest.slice(bracketEnd + 1).trim();
    const defs = defsPart
      .split("/")
      .map((d) => d.trim())
      .filter(Boolean);

    if (defs.length === 0) continue;

    // First entry for a simplified form wins (most common reading)
    if (!dict.has(simplified)) {
      dict.set(simplified, defs);
    }
  }

  // Join definitions into a single string per word
  const result = new Map<string, string>();
  for (const [key, defs] of dict) {
    result.set(key, defs.join("; "));
  }

  console.log(`  CFDICT loaded: ${result.size} entries`);
  return result;
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

  // Fetch French dictionary in parallel with first HSK level
  const frenchDict = await fetchCfdict();

  let totalWords = 0;
  let totalFrench = 0;

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
      const meaningFr = frenchDict.get(entry.simplified) ?? "";

      words.push({
        id: entry.simplified,
        hskLevel: level,
        characters: [...entry.simplified],
        pinyin,
        pinyinNumeric,
        meaningEn,
        meaningFr,
        frequency: 0, // assigned below
        audioFile: `${pinyinNumeric}.mp3`,
      });
    }

    // Sort alphabetically by pinyin for stable ordering, then assign sequential frequency
    words.sort((a, b) => a.pinyin.localeCompare(b.pinyin, "zh"));

    for (let i = 0; i < words.length; i++) {
      words[i].frequency = i + 1;
    }

    const frenchCount = words.filter((w) => w.meaningFr !== "").length;
    totalFrench += frenchCount;

    const outPath = path.join(outDir, `hsk-${level}.json`);
    await writeFile(outPath, JSON.stringify(words, null, 2), "utf-8");
    console.log(`  HSK ${level}: ${words.length} words -> ${outPath} (${frenchCount} with French)`);
    totalWords += words.length;
  }

  console.log(`\nTotal: ${totalWords} words across 7 levels (${totalFrench} with French translations, ${totalWords - totalFrench} without)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
