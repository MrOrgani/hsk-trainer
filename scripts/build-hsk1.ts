import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface SourceEntry {
  id: string;
  characters: string[];
  pinyin: string;
  pinyinNumeric: string;
  meaningEn: string;
  meaningFr: string;
  frequency: number;
}

interface OutputWord extends SourceEntry {
  hskLevel: 1;
  audioFile: string;
}

function slugify(pinyinNumeric: string): string {
  return `${pinyinNumeric}.mp3`;
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, "..");
  const sourcePath = path.join(rootDir, "vendor", "hsk1-source.json");
  const outDir = path.join(rootDir, "public", "data");
  const outPath = path.join(outDir, "hsk-1.json");

  const raw = await readFile(sourcePath, "utf-8");
  const source: SourceEntry[] = JSON.parse(raw);

  const output: OutputWord[] = source.map((entry) => ({
    ...entry,
    hskLevel: 1,
    audioFile: slugify(entry.pinyinNumeric),
  }));

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} words to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
