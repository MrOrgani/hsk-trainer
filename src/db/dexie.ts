import Dexie, { type Table } from "dexie";
import type {
  Word,
  SrsCard,
  Settings,
  DailyState,
} from "./schema";

export class HskDb extends Dexie {
  words!: Table<Word, string>;
  srsCards!: Table<SrsCard, string>;
  settings!: Table<Settings, string>;
  dailyState!: Table<DailyState, string>;

  constructor() {
    super("hsk-trainer");
    this.version(1).stores({
      words: "id, hskLevel, frequency",
      srsCards: "id, wordId, state, promptType, dueDate",
      settings: "id",
      dailyState: "date",
    });
  }
}

export const db = new HskDb();
