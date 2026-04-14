/**
 * Shared audio utilities for Chinese speech synthesis.
 * Uses easy-speech for cross-browser compatibility (especially iOS Safari).
 */

import EasySpeech from "easy-speech";

let initialized = false;
let initializing = false;

/**
 * Initialize easy-speech. Safe to call multiple times — only runs once.
 * Returns true if speech synthesis is available.
 */
export async function initSpeech(): Promise<boolean> {
  if (initialized) return true;
  if (initializing) {
    // Wait for the in-flight init
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!initializing) {
          clearInterval(check);
          resolve(initialized);
        }
      }, 50);
    });
  }

  initializing = true;
  try {
    const detected = EasySpeech.detect();
    if (!detected.speechSynthesis) {
      initialized = false;
      return false;
    }

    await EasySpeech.init({ maxTimeout: 5000, interval: 250, quiet: true });

    // Set defaults for Chinese speech
    const voices = EasySpeech.voices();
    const voice = findChineseVoice(voices);
    EasySpeech.defaults({
      voice: voice ?? undefined,
      rate: 0.8,
      pitch: 1.0,
      volume: 1.0,
    });

    initialized = true;
    return true;
  } catch {
    initialized = false;
    return false;
  } finally {
    initializing = false;
  }
}

/**
 * Finds the best available Chinese voice.
 *
 * Priority order:
 * 1. Premium / Neural / Enhanced voices
 * 2. Well-known high-quality voices (Google, Ting-Ting)
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

  const premium = candidates.find((v) =>
    /premium|enhanced|natural|neural/i.test(v.name),
  );
  if (premium) return premium;

  const googleVoice = candidates.find((v) =>
    /google.*普通话|google.*mandarin|google.*chinese/i.test(v.name),
  );
  if (googleVoice) return googleVoice;

  const tingTing = candidates.find((v) => /ting-ting/i.test(v.name));
  if (tingTing) return tingTing;

  const zhCN = candidates.find((v) => v.lang === "zh-CN" || v.lang.startsWith("zh-CN"));
  if (zhCN) return zhCN;

  return candidates[0];
}

// ---------------------------------------------------------------------------
// In-memory audio cache: url -> HTMLAudioElement (already loaded & decodable)
// ---------------------------------------------------------------------------
const audioCache = new Map<string, HTMLAudioElement>();

/**
 * Try playing a local mp3 from public/audio via HTMLAudioElement.
 * Resolves true on successful playback start, false on any failure
 * (missing file, autoplay blocked, decode error, etc.).
 */
export function tryPlayAudioFile(
  audioFile: string,
  opts?: { onEnded?: () => void },
): Promise<boolean> {
  return new Promise((resolve) => {
    const src = `${import.meta.env.BASE_URL}audio/${audioFile}`;
    const cached = audioCache.get(src);
    if (cached) {
      const clone = cached.cloneNode() as HTMLAudioElement;
      if (opts?.onEnded) clone.addEventListener("ended", opts.onEnded, { once: true });
      clone.play().then(() => resolve(true)).catch(() => resolve(false));
      return;
    }

    const audio = new Audio(src);
    audio.crossOrigin = "anonymous";
    audio.addEventListener("error", () => resolve(false), { once: true });
    audio.addEventListener(
      "canplaythrough",
      () => audioCache.set(src, audio),
      { once: true },
    );
    if (opts?.onEnded) audio.addEventListener("ended", opts.onEnded, { once: true });
    audio.play().then(() => resolve(true)).catch(() => resolve(false));
  });
}

/**
 * Play word audio: local mp3 first, fall back to TTS.
 * Safe to call from a useEffect — silently does nothing if autoplay is blocked.
 */
export async function playWordAudio(audioFile: string, fallbackText: string): Promise<void> {
  if (await tryPlayAudioFile(audioFile)) return;
  try {
    await speakChinese(fallbackText);
  } catch {
    // ignore — browser may block autoplay without user gesture
  }
}

/**
 * Speak the given Chinese text. Initializes easy-speech on first call.
 * Returns a promise that resolves when speech ends.
 */
export async function speakChinese(text: string): Promise<void> {
  const available = await initSpeech();
  if (!available) return;

  EasySpeech.cancel();
  await EasySpeech.speak({
    text,
    rate: 0.8,
    pitch: 1.0,
    force: true,
    infiniteResume: true,
  });
}
