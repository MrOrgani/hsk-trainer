import { useCallback, useEffect, useRef, useState } from "react";
import { findChineseVoice } from "@/lib/audio";

type AudioState = "idle" | "speaking" | "error" | "unavailable";

interface Props {
  audioFile: string;
  fallbackText: string;
  label?: string;
  variant?: "inline" | "button";
}

// ---------------------------------------------------------------------------
// In-memory audio cache: url -> HTMLAudioElement (already loaded & decodable)
// ---------------------------------------------------------------------------
const audioCache = new Map<string, HTMLAudioElement>();


export function AudioButton({
  audioFile,
  fallbackText,
  label,
  variant = "inline",
}: Props) {
  const [state, setState] = useState<AudioState>("idle");
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load voices (may be async on some browsers)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setState("unavailable");
      return;
    }

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

    // iOS workaround: cancel any pending speech first
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

    // iOS workaround: speechSynthesis can get stuck in "pending" state
    // Force resume after a short delay
    setTimeout(() => {
      if (synth.paused) synth.resume();
    }, 100);
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
            .catch(() => {
              setState("idle");
              resolve(false);
            });
          return;
        }

        const audio = new Audio(src);
        audio.crossOrigin = "anonymous";

        const fail = () => {
          setState("idle");
          resolve(false);
        };

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
    if (state === "speaking") return;

    // 1. Try local audio file (if it exists in /audio/)
    if (await tryAudioElement(`${import.meta.env.BASE_URL}audio/${audioFile}`)) return;

    // 2. Use browser speechSynthesis
    speak();
  }, [audioFile, tryAudioElement, speak, state]);

  const isDisabled = state === "unavailable";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={play}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
          state === "speaking"
            ? "bg-vermillion-100 text-vermillion-500"
            : "bg-ink-100 text-ink-400 active:bg-ink-200"
        } ${isDisabled ? "opacity-30" : ""}`}
        aria-label={`Play pronunciation of ${fallbackText}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4.5 h-4.5"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      </button>
    );
  }

  // "button" variant — larger, with optional label
  return (
    <button
      type="button"
      onClick={play}
      disabled={isDisabled}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
        state === "speaking"
          ? "bg-vermillion-100 text-vermillion-600"
          : "bg-ink-100 text-ink-600 active:bg-ink-200"
      } ${isDisabled ? "opacity-30" : ""}`}
      aria-label={`Play pronunciation of ${fallbackText}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4.5 h-4.5"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
      {label}
    </button>
  );
}
