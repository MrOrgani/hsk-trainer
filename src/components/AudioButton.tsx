import { useCallback, useEffect, useRef, useState } from "react";
import { chunky, type ChunkyVariant } from "./Button";

type AudioState = "idle" | "speaking" | "error" | "unavailable";

interface Props {
  audioFile: string;
  fallbackText: string;
  label?: string;
  variant?: ChunkyVariant;
}

/**
 * Finds the best available Chinese voice from speechSynthesis.
 * Prefers zh-CN, then zh, then cmn prefixed voices.
 */
function findChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const prefixes = ["zh-CN", "zh-TW", "zh", "cmn"];
  for (const prefix of prefixes) {
    const match = voices.find(
      (v) => v.lang === prefix || v.lang.startsWith(prefix + "-"),
    );
    if (match) return match;
  }
  return undefined;
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

  const play = useCallback(() => {
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      speak();
    };
    const audio = new Audio(`/audio/${audioFile}`);
    audio.addEventListener("error", fallback, { once: true });
    audio.play().catch(fallback);
  }, [audioFile, speak]);

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
