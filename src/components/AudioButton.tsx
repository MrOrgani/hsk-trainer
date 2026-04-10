import { useCallback, useEffect, useRef, useState } from "react";
import { chunky, type ChunkyVariant } from "./Button";

type AudioState = "idle" | "speaking" | "error" | "unavailable";

interface Props {
  audioFile: string;
  fallbackText: string;
  label?: string;
  variant?: ChunkyVariant;
}

// ---------------------------------------------------------------------------
// In-memory audio cache: text -> HTMLAudioElement (already loaded & decodable)
// ---------------------------------------------------------------------------
const audioCache = new Map<string, HTMLAudioElement>();

/**
 * Build a Google Translate TTS URL for Mandarin Chinese.
 * This uses the unofficial `client=tw-ob` endpoint.  It may stop working at
 * any time, which is fine — we always fall back to speechSynthesis.
 */
function buildGoogleTtsUrl(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-CN&q=${encoded}`;
}

/**
 * Finds the best available Chinese voice from speechSynthesis.
 * Prefers premium / neural voices (they tend to have "Premium", "Enhanced",
 * or "Natural" in their name) over standard ones.
 */
function findChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
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

  // Prefer higher-quality voices when the browser exposes them
  const premium = candidates.find((v) =>
    /premium|enhanced|natural|neural/i.test(v.name),
  );
  return premium ?? candidates[0];
}

export function AudioButton({
  audioFile,
  fallbackText,
  label = "Play",
  variant = "neutral",
}: Props) {
  const [state, setState] = useState<AudioState>(() =>
    typeof window !== "undefined" && window.speechSynthesis
      ? "idle"
      : "unavailable",
  );
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load voices (may be async on some browsers)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const voices = synth.getVoices();
      voiceRef.current = findChineseVoice(voices);
    };

    // Try immediately (Chrome sometimes has them ready)
    loadVoices();

    // Also listen for the async load event
    synth.addEventListener("voiceschanged", loadVoices);
    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /** Last-resort fallback: browser speechSynthesis */
  const speak = useCallback(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) {
      setState("unavailable");
      return;
    }

    synth.cancel();
    const utter = new SpeechSynthesisUtterance(fallbackText);
    utter.lang = "zh-CN";
    utter.rate = 0.8;
    utter.pitch = 1.0;

    if (voiceRef.current) {
      utter.voice = voiceRef.current;
    }

    utter.onstart = () => setState("speaking");
    utter.onend = () => setState("idle");
    utter.onerror = (e) => {
      // "interrupted" fires when we cancel before a new utterance; not a real error
      if (e.error === "interrupted" || e.error === "canceled") {
        setState("idle");
      } else {
        setState("error");
        // Reset back to idle after a short delay
        timeoutRef.current = setTimeout(() => setState("idle"), 2000);
      }
    };

    synth.speak(utter);
  }, [fallbackText]);

  /**
   * Try playing audio via an HTMLAudioElement (local file or remote TTS URL).
   * Returns a promise that resolves to `true` if playback started, `false` otherwise.
   */
  const tryAudioElement = useCallback(
    (src: string): Promise<boolean> =>
      new Promise((resolve) => {
        // Check cache first
        const cached = audioCache.get(src);
        if (cached) {
          const clone = cached.cloneNode() as HTMLAudioElement;
          clone.addEventListener("ended", () => setState("idle"), { once: true });
          setState("speaking");
          clone
            .play()
            .then(() => resolve(true))
            .catch(() => resolve(false));
          return;
        }

        const audio = new Audio(src);
        audio.crossOrigin = "anonymous";

        const fail = () => resolve(false);

        audio.addEventListener("error", fail, { once: true });

        audio.addEventListener(
          "canplaythrough",
          () => {
            // Cache for future use
            audioCache.set(src, audio);
          },
          { once: true },
        );

        audio.addEventListener("ended", () => setState("idle"), { once: true });

        setState("speaking");
        audio.play().then(() => resolve(true)).catch(fail);
      }),
    [],
  );

  const play = useCallback(async () => {
    // 1. Try local audio file (if it exists in /audio/)
    if (await tryAudioElement(`/audio/${audioFile}`)) return;

    // 2. Try Google Translate TTS
    if (await tryAudioElement(buildGoogleTtsUrl(fallbackText))) return;

    // 3. Fall back to browser speechSynthesis
    speak();
  }, [audioFile, fallbackText, tryAudioElement, speak]);

  const isDisabled = state === "unavailable";

  // Icon per state
  const icon =
    state === "speaking"
      ? "\u{1F50A}" // speaker with sound
      : state === "error"
        ? "\u26A0\uFE0F" // warning
        : state === "unavailable"
          ? "\u{1F507}" // muted speaker
          : "\u{1F50A}"; // speaker with sound

  return (
    <div className="relative inline-block group">
      <button
        type="button"
        onClick={play}
        disabled={isDisabled}
        className={chunky(variant, state === "speaking" ? "animate-pulse" : "")}
        aria-label={`Play pronunciation of ${fallbackText}`}
      >
        <span aria-hidden className="text-xl">
          {icon}
        </span>
        {label}
      </button>
      {isDisabled && (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2
            whitespace-nowrap rounded-lg bg-ink-700 px-3 py-1.5 text-xs text-white
            opacity-0 shadow-card transition-opacity group-hover:opacity-100"
        >
          Speech synthesis not available
        </span>
      )}
    </div>
  );
}
