import Dexie, { type Table } from "dexie";
import type {
  Word,
  SrsCard,
  ReviewLog,
  Settings,
  DailyState,
} from "./schema";

export class HskDb extends Dexie {
  words!: Table<Word, string>;
  srsCards!: Table<SrsCard, string>;
  reviewLog!: Table<ReviewLog, number>;
  settings!: Table<Settings, string>;
  dailyState!: Table<DailyState, string>;

  constructor() {
    super("hsk-trainer");
    this.version(1).stores({
      words: "id, hskLevel, frequency",
      srsCards: "id, wordId, state, promptType, dueDate",
      reviewLog: "++id, cardId, wordId, timestamp",
      settings: "id",
      dailyState: "date",
    });
  }
}

export const db = new HskDb();
