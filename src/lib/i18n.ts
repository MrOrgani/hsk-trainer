import { useSettings } from "@/state/settings-store";
import type { Word } from "@/db/schema";

type Lang = "en" | "fr";

const translations = {
  // Nav
  "nav.home": { en: "Home", fr: "Accueil" },
  "nav.study": { en: "Study", fr: "Apprendre" },
  "nav.stats": { en: "Stats", fr: "Stats" },
  "nav.settings": { en: "Settings", fr: "Param\u00e8tres" },

  // Home page
  "home.title": { en: "Let's learn Chinese!", fr: "Apprenons le chinois !" },
  "home.subtitle": {
    en: "A few minutes a day keeps the characters flowing.",
    fr: "Quelques minutes par jour pour ma\u00eetriser les caract\u00e8res.",
  },
  "home.newToday": { en: "New today", fr: "Nouveaux aujourd'hui" },
  "home.introduced": { en: "introduced", fr: "appris" },
  "home.addNewCharacters": {
    en: "+ Add new characters",
    fr: "+ Ajouter des caract\u00e8res",
  },

  // Study page
  "study.newWord": { en: "New word", fr: "Nouveau mot" },
  "study.showStrokes": { en: "Show strokes \u2192", fr: "Voir les traits \u2192" },
  "study.watchStrokeOrder": {
    en: "Watch the stroke order",
    fr: "Observez l'ordre des traits",
  },
  "study.tryItYourself": {
    en: "Try it yourself \u2192",
    fr: "Essayez vous-m\u00eame \u2192",
  },
  "study.yourTurn": { en: "Your turn", fr: "A votre tour" },
  "study.allDone": { en: "All done!", fr: "Termin\u00e9 !" },
  "study.newWordsAdded": {
    en: "{count} new {unit} added to your deck.",
    fr: "{count} nouveau(x) {unit} ajout\u00e9(s) \u00e0 votre deck.",
  },
  "study.word": { en: "word", fr: "mot" },
  "study.words": { en: "words", fr: "mots" },
  "study.listen": { en: "Listen", fr: "Ecouter" },
  "study.writeFromMemory": { en: "Write from memory", fr: "Ecrivez de memoire" },
  "study.chooseLevel": { en: "Choose your level", fr: "Choisissez votre niveau" },
  "study.perfect": { en: "Perfect!", fr: "Parfait !" },
  "study.mistakes": { en: "{count} mistakes", fr: "{count} erreurs" },
  "study.autoGradeEasy": { en: "Easy — review in 4 days", fr: "Facile — revision dans 4 jours" },
  "study.autoGradeGood": { en: "Good — review tomorrow", fr: "Bien — revision demain" },
  "study.autoGradeHard": { en: "Hard — review soon", fr: "Difficile — revision prochaine" },
  "study.autoGradeAgain": { en: "Again — review shortly", fr: "A revoir — revision imminente" },
  "study.tapToContinue": { en: "Tap to continue", fr: "Appuyez pour continuer" },
  "study.continue": { en: "Continue", fr: "Continuer" },
  "study.relearnPass": {
    en: "Reviewing the tricky ones",
    fr: "On revoit les plus difficiles",
  },
  "study.drawAgain": { en: "Draw it again — cleanly", fr: "Redessinez — proprement" },
  "study.reviewBadge": { en: "Review", fr: "R\u00e9vision" },
  "study.newBadge": { en: "New", fr: "Nouveau" },

  // Common
  "common.backToHome": { en: "Back to home", fr: "Retour \u00e0 l'accueil" },
  "common.loading": { en: "Loading\u2026", fr: "Chargement\u2026" },
  "common.playAudio": { en: "Play audio", fr: "Lire l'audio" },

  // Settings
  "settings.title": { en: "Settings", fr: "Param\u00e8tres" },
  "settings.newCardsPerDay": {
    en: "New cards per day",
    fr: "Nouvelles cartes par jour",
  },
  "settings.interfaceLanguage": {
    en: "Interface language",
    fr: "Langue de l'interface",
  },
  "settings.strokeOrderLeniency": {
    en: "Stroke order leniency",
    fr: "Tol\u00e9rance de l'ordre des traits",
  },
  "settings.hskLevel": { en: "HSK Level", fr: "Niveau HSK" },
  "settings.strict": { en: "Strict", fr: "Strict" },
  "settings.lenientOrder": { en: "Lenient (order)", fr: "Tol\u00e9rant (ordre)" },
  "settings.saved": { en: "Saved!", fr: "Enregistr\u00e9 !" },
  "settings.saveSettings": { en: "Save settings", fr: "Enregistrer" },
  "settings.resetTitle": { en: "Reset all data", fr: "R\u00e9initialiser les donn\u00e9es" },
  "settings.resetDescription": {
    en: "This will delete all your progress and settings. This action cannot be undone.",
    fr: "Cela supprimera toute votre progression et vos param\u00e8tres. Cette action est irr\u00e9versible.",
  },
  "settings.resetButton": { en: "Clear all data", fr: "Effacer toutes les donn\u00e9es" },
  "settings.resetConfirm": {
    en: "Are you sure you want to delete all data? This cannot be undone.",
    fr: "\u00cates-vous s\u00fbr de vouloir supprimer toutes les donn\u00e9es ? Cette action est irr\u00e9versible.",
  },

  // Stats
  "stats.title": { en: "Statistics", fr: "Statistiques" },
  "stats.totalCards": { en: "Total cards", fr: "Total cartes" },
  "stats.learning": { en: "Learning", fr: "En cours" },
  "stats.reviewing": { en: "Reviewing", fr: "En r\u00e9vision" },
  "stats.newCardsThisWeek": {
    en: "New cards this week",
    fr: "Nouvelles cartes cette semaine",
  },
  "stats.progressByLevel": {
    en: "Progress by HSK level",
    fr: "Progression par niveau HSK",
  },
  "stats.maturityNew": { en: "New", fr: "Nouveau" },
  "stats.maturityLearning": { en: "Learning", fr: "En cours" },
  "stats.maturityYoung": { en: "Young", fr: "Récent" },
  "stats.maturityMature": { en: "Mature", fr: "Maîtrisé" },
  "stats.characters": { en: "characters", fr: "caractères" },

  // Search (home page)
  "search.placeholder": {
    en: "Search by character, pinyin, or meaning...",
    fr: "Rechercher par caract\u00e8re, pinyin ou sens...",
  },
  "search.noResults": { en: "No words found.", fr: "Aucun mot trouv\u00e9." },

  // Character detail sheet
  "detail.nextReview": { en: "Next review", fr: "Prochaine r\u00e9vision" },
  "detail.interval": { en: "Interval", fr: "Intervalle" },
  "detail.day": { en: "day", fr: "jour" },
  "detail.days": { en: "days", fr: "jours" },
  "detail.today": { en: "Today", fr: "Aujourd'hui" },
  "detail.overdue": { en: "Overdue", fr: "En retard" },

  // Stats extras
  "stats.showCharacters": { en: "Show characters", fr: "Voir les caract\u00e8res" },
  "stats.hideCharacters": { en: "Hide characters", fr: "Masquer les caract\u00e8res" },
} as const;

export type TranslationKey = keyof typeof translations;

/** Returns the translated string for the given key and language. Falls back to English. */
export function translate(key: TranslationKey, lang: Lang): string {
  const entry = translations[key];
  return entry[lang] || entry.en;
}

/** Hook that returns a `t` function bound to the current UI language. */
export function useTranslation() {
  const settings = useSettings();
  const lang: Lang = settings?.uiLanguage ?? "en";

  function t(key: TranslationKey): string {
    return translate(key, lang);
  }

  return { t, lang };
}

/** Returns the appropriate meaning for a word based on language, falling back to English. */
export function meaningFor(word: Word, lang: Lang): string {
  if (lang === "fr" && word.meaningFr && word.meaningFr.trim() !== "") {
    return word.meaningFr;
  }
  return word.meaningEn;
}
