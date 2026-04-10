import { useSettings } from "@/state/settings-store";
import type { Word } from "@/db/schema";

type Lang = "en" | "fr";

const translations = {
  // Nav
  "nav.home": { en: "Home", fr: "Accueil" },
  "nav.study": { en: "Study", fr: "Apprendre" },
  "nav.review": { en: "Review", fr: "Revoir" },
  "nav.browse": { en: "Browse", fr: "Parcourir" },
  "nav.stats": { en: "Stats", fr: "Stats" },
  "nav.settings": { en: "Settings", fr: "Param\u00e8tres" },

  // Home page
  "home.title": { en: "Let's learn Chinese!", fr: "Apprenons le chinois !" },
  "home.subtitle": {
    en: "A few minutes a day keeps the characters flowing.",
    fr: "Quelques minutes par jour pour ma\u00eetriser les caract\u00e8res.",
  },
  "home.dueNow": { en: "Due now", fr: "A revoir" },
  "home.newToday": { en: "New today", fr: "Nouveaux aujourd'hui" },
  "home.character": { en: "character", fr: "caract\u00e8re" },
  "home.characters": { en: "characters", fr: "caract\u00e8res" },
  "home.introduced": { en: "introduced", fr: "appris" },
  "home.readyForYou": {
    en: "{count} {unit} ready for you.",
    fr: "{count} {unit} vous attendent.",
  },
  "home.characterIs": { en: "character is", fr: "caract\u00e8re vous attend" },
  "home.charactersAre": { en: "characters are", fr: "caract\u00e8res vous attendent" },
  "home.startLesson": { en: "Start lesson \u2192", fr: "Commencer la le\u00e7on \u2192" },
  "home.noReviewsDue": {
    en: "No reviews due. Plant some new characters!",
    fr: "Rien \u00e0 r\u00e9viser. Apprenez de nouveaux caract\u00e8res !",
  },
  "home.addNewCharacters": {
    en: "+ Add new characters",
    fr: "+ Ajouter des caract\u00e8res",
  },
  "home.addNewCharactersLower": {
    en: "+ add new characters",
    fr: "+ ajouter des caract\u00e8res",
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
  "study.nothingNew": {
    en: "Nothing new to learn right now.",
    fr: "Rien de nouveau \u00e0 apprendre pour le moment.",
  },
  "study.allStudied": {
    en: "You've studied all available words!",
    fr: "Vous avez \u00e9tudi\u00e9 tous les mots disponibles !",
  },
  "study.allDone": { en: "All done!", fr: "Termin\u00e9 !" },
  "study.newWordsAdded": {
    en: "{count} new {unit} added to your deck.",
    fr: "{count} nouveau(x) {unit} ajout\u00e9(s) \u00e0 votre deck.",
  },
  "study.word": { en: "word", fr: "mot" },
  "study.words": { en: "words", fr: "mots" },
  "study.listen": { en: "Listen", fr: "Ecouter" },

  // Review page
  "review.nothingToReview": {
    en: "Nothing to review!",
    fr: "Rien \u00e0 r\u00e9viser !",
  },
  "review.comeBackLater": {
    en: "Come back later or add new characters.",
    fr: "Revenez plus tard ou ajoutez de nouveaux caract\u00e8res.",
  },
  "review.lessonComplete": { en: "Lesson complete!", fr: "Le\u00e7on termin\u00e9e !" },
  "review.studied": { en: "studied", fr: "\u00e9tudi\u00e9(s)" },
  "review.wellDone": { en: "Well done", fr: "Bravo" },
  "review.finish": { en: "Finish", fr: "Terminer" },

  // Prompts
  "prompt.listenAndWrite": {
    en: "Listen and write it",
    fr: "Ecoutez et \u00e9crivez",
  },
  "prompt.writeTheWord": { en: "Write the word", fr: "Ecrivez le mot" },
  "prompt.whatDoesThisMean": {
    en: "What does this mean?",
    fr: "Que signifie ceci ?",
  },
  "prompt.showAnswer": { en: "Show answer", fr: "Voir la r\u00e9ponse" },
  "prompt.howWellDidYouKnow": {
    en: "How well did you know it?",
    fr: "Connaissiez-vous ce mot ?",
  },
  "prompt.perfectStrokes": { en: "Perfect strokes!", fr: "Traits parfaits !" },
  "prompt.strokeMistake": {
    en: "{count} stroke mistake",
    fr: "{count} erreur de trait",
  },
  "prompt.strokeMistakes": {
    en: "{count} stroke mistakes",
    fr: "{count} erreurs de trait",
  },
  "prompt.tapToListen": { en: "Tap to listen", fr: "Appuyez pour \u00e9couter" },
  "prompt.whichOneMeans": {
    en: "Which one means\u2026",
    fr: "Lequel signifie\u2026",
  },
  "prompt.niceHowWell": {
    en: "Nice! How well did you know it?",
    fr: "Bien jou\u00e9 ! Connaissiez-vous ce mot ?",
  },
  "prompt.notQuite": {
    en: "Not quite \u2014 let's try again",
    fr: "Pas tout \u00e0 fait \u2014 r\u00e9essayons",
  },
  "prompt.character": { en: "Character", fr: "Caract\u00e8re" },

  // Grade buttons
  "grade.again": { en: "Again", fr: "A revoir" },
  "grade.hard": { en: "Hard", fr: "Difficile" },
  "grade.good": { en: "Good", fr: "Bien" },
  "grade.easy": { en: "Easy", fr: "Facile" },

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
  "settings.sessionSize": { en: "Session size", fr: "Taille de session" },
  "settings.interfaceLanguage": {
    en: "Interface language",
    fr: "Langue de l'interface",
  },
  "settings.strokeOrderLeniency": {
    en: "Stroke order leniency",
    fr: "Tol\u00e9rance de l'ordre des traits",
  },
  "settings.strict": { en: "Strict", fr: "Strict" },
  "settings.lenientOrder": { en: "Lenient (order)", fr: "Tol\u00e9rant (ordre)" },
  "settings.saved": { en: "Saved!", fr: "Enregistr\u00e9 !" },
  "settings.saveSettings": { en: "Save settings", fr: "Enregistrer" },
  "settings.resetTitle": { en: "Reset all data", fr: "R\u00e9initialiser les donn\u00e9es" },
  "settings.resetDescription": {
    en: "This will delete all your progress, settings, and review history. This action cannot be undone.",
    fr: "Cela supprimera toute votre progression, vos param\u00e8tres et votre historique de r\u00e9visions. Cette action est irr\u00e9versible.",
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
  "stats.reviewsThisWeek": {
    en: "Reviews this week",
    fr: "R\u00e9visions cette semaine",
  },
  "stats.newCardsThisWeek": {
    en: "New cards this week",
    fr: "Nouvelles cartes cette semaine",
  },

  // Browse
  "browse.title": { en: "Vocabulary", fr: "Vocabulaire" },
  "browse.searchPlaceholder": {
    en: "Search by character, pinyin, or meaning...",
    fr: "Rechercher par caract\u00e8re, pinyin ou sens...",
  },
  "browse.noWordsFound": { en: "No words found.", fr: "Aucun mot trouv\u00e9." },
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
