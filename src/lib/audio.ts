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
// Persistent audio element — unlocked once inside a user gesture, then reused
// by swapping `src` for every subsequent play. Required for iOS Safari / PWA
// where per-element transient activation does not survive await boundaries.
// ---------------------------------------------------------------------------

// 100ms silent MP3 (base64). iOS decodes real MP3; WAV/empty buffers fail.
const SILENT_MP3 =
  "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA" +
  "gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA" +
  "gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP////////////////////////////////" +
  "//////////////////////////////////////////////////////8AAAA5TEFNRTMuMTAw" +
  "AZYAAAAALkAAABRGJAJAQgAARgAAAnGMHbcMAAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1F" +
  "My4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVV//sQxFODwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDEph8AAAGkAAAAIAAA" +
  "NIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";

let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;
let playToken = 0;
let currentOnEnded: (() => void) | null = null;

function ensureElement(): HTMLAudioElement {
  if (!sharedAudio) {
    const el = new Audio();
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    // No crossOrigin — mp3s are same-origin; setting it can break SW cache hits.
    el.addEventListener("ended", () => {
      currentOnEnded?.();
      currentOnEnded = null;
    });
    sharedAudio = el;
  }
  return sharedAudio;
}

/**
 * Must be called from within a user-gesture handler (click/touchend).
 * Primes the shared <audio> element and easy-speech for later gesture-free
 * playback. Safe to call multiple times.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  const el = ensureElement();
  el.src = SILENT_MP3;
  const p = el.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      el.pause();
      unlocked = true;
    }).catch(() => {
      // Leave unlocked=false so we retry on the next gesture.
    });
  }
  void speakChinese(" ").catch(() => {});
}

/**
 * Try playing a local mp3 from public/audio via the shared audio element.
 * Resolves true on successful playback start, false on any failure.
 */
export function tryPlayAudioFile(
  audioFile: string,
  opts?: { onEnded?: () => void; caller?: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    const src = `${import.meta.env.BASE_URL}audio/${audioFile}`;
    const caller = opts?.caller ?? "unknown";
    const el = ensureElement();
    const token = ++playToken;

    try {
      el.pause();
    } catch {
      // jsdom throws; ignore.
    }
    currentOnEnded = opts?.onEnded
      ? () => {
          if (token === playToken) opts.onEnded?.();
        }
      : null;

    el.src = src;
    const p = el.play();
    if (!p || typeof p.then !== "function") {
      resolve(false);
      return;
    }
    p.then(() => {
      if (import.meta.env.DEV) console.log(`🔊 [${caller}] play OK`, { src });
      resolve(true);
    }).catch((err: DOMException) => {
      console.warn(`🔊 [${caller}] play FAIL`, {
        src,
        name: err?.name,
        message: err?.message,
        readyState: el.readyState,
      });
      if (token === playToken) currentOnEnded = null;
      resolve(false);
    });
  });
}

// Re-unlock on PWA resume: iOS can invalidate the audio session when the app
// is backgrounded. Reset the flag so the next gesture re-primes the element.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlocked = false;
  });
}

/**
 * Play word audio: local mp3 first, fall back to TTS.
 * Safe to call from a useEffect — silently does nothing if autoplay is blocked.
 */
export async function playWordAudio(audioFile: string, fallbackText: string): Promise<void> {
  console.log(`🔊 [playWordAudio] start`, {
    audioFile,
    fallbackText,
    hasUserActivation: navigator.userActivation?.isActive,
  });
  if (await tryPlayAudioFile(audioFile, { caller: "playWordAudio" })) return;
  console.log(`🔊 [playWordAudio] mp3 failed, falling back to TTS`, { fallbackText });
  try {
    await speakChinese(fallbackText);
    console.log(`🔊 [playWordAudio] TTS OK`);
  } catch (err) {
    console.warn(`🔊 [playWordAudio] TTS FAIL`, {
      name: (err as Error)?.name,
      message: (err as Error)?.message,
    });
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
