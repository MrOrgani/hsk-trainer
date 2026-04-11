/**
 * Shared audio utilities for Chinese speech synthesis.
 */

/** Module-level cached voice reference */
let cachedVoice: SpeechSynthesisVoice | undefined;
let voiceLoaded = false;

/**
 * Finds the best available Chinese voice from speechSynthesis.
 *
 * Priority order:
 * 1. Premium / Neural / Enhanced voices (highest quality)
 * 2. Well-known high-quality voices by name:
 *    - Chrome: "Google 普通话（中国大陆）" or similar Google voices
 *    - Safari/iOS: "Ting-Ting" (compact but decent)
 * 3. Any zh-CN voice
 * 4. Any other Chinese voice (zh-TW, zh, cmn)
 */
export function findChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const prefixes = ["zh-CN", "zh-TW", "zh", "cmn"];
  const candidates: SpeechSynthesisVoice[] = [];

  for (const prefix of prefixes) {
    for (const v of voices) {
      if (v.lang === prefix || v.lang.startsWith(prefix + "-")) {
        candidates.push(v);
      }
    }
  }

  if (candidates.length === 0) return undefined;

  // 1. Prefer premium / neural / enhanced voices
  const premium = candidates.find((v) =>
    /premium|enhanced|natural|neural/i.test(v.name),
  );
  if (premium) return premium;

  // 2. Prefer well-known high-quality voices by name
  const googleVoice = candidates.find((v) =>
    /google.*普通话|google.*mandarin|google.*chinese/i.test(v.name),
  );
  if (googleVoice) return googleVoice;

  const tingTing = candidates.find((v) => /ting-ting/i.test(v.name));
  if (tingTing) return tingTing;

  // 3. Prefer zh-CN over other variants
  const zhCN = candidates.find((v) => v.lang === "zh-CN" || v.lang.startsWith("zh-CN"));
  if (zhCN) return zhCN;

  return candidates[0];
}

/** Resolve and cache the best Chinese voice. */
function resolveVoice(): SpeechSynthesisVoice | undefined {
  if (voiceLoaded) return cachedVoice;
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoice = findChineseVoice(voices);
    voiceLoaded = true;
  }
  return cachedVoice;
}

// Eagerly listen for voiceschanged so the cache is warm
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    voiceLoaded = false; // reset so next call re-resolves
    resolveVoice();
  });
}

/**
 * Fire-and-forget: speak the given Chinese text using speechSynthesis.
 */
export function playWordAudio(text: string): void {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;

  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-CN";
  utter.rate = 0.8;
  utter.pitch = 1.0;

  const voice = resolveVoice();
  if (voice) {
    utter.voice = voice;
  }

  synth.speak(utter);
}
