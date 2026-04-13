import { useCallback, useEffect, useRef, useState } from "react";
import { speakChinese } from "@/lib/audio";

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Try playing audio via an HTMLAudioElement (local file).
   * Returns true if playback started, false otherwise.
   */
  const tryAudioElement = useCallback(
    (src: string): Promise<boolean> =>
      new Promise((resolve) => {
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

    // 1. Try local audio file
    if (await tryAudioElement(`${import.meta.env.BASE_URL}audio/${audioFile}`)) return;

    // 2. Use easy-speech (handles iOS Safari workarounds)
    setState("speaking");
    try {
      await speakChinese(fallbackText);
      setState("idle");
    } catch {
      setState("error");
      timeoutRef.current = setTimeout(() => setState("idle"), 2000);
    }
  }, [audioFile, tryAudioElement, fallbackText, state]);

  const isDisabled = state === "unavailable";

  const speakerIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      className="w-[18px] h-[18px] shrink-0"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      {variant === "inline" && (
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      )}
    </svg>
  );

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
        {speakerIcon}
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
      {speakerIcon}
      {label}
    </button>
  );
}
