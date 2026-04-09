import { chunky, type ChunkyVariant } from "./Button";

interface Props {
  /** Filename in /public/audio (Plan 3). If missing, speech synthesis is used. */
  audioFile: string;
  /** Text spoken by the synthesis fallback — the Chinese characters. */
  fallbackText: string;
  label?: string;
  variant?: ChunkyVariant;
}

/**
 * Plays pronunciation for a word. Prefers the bundled MP3 (shipping in Plan 3);
 * if the file is missing (404 or decode error) falls back to
 * `window.speechSynthesis` with the Mandarin voice.
 */
export function AudioButton({
  audioFile,
  fallbackText,
  label = "Play",
  variant = "info",
}: Props) {
  function speak() {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(fallbackText);
    utter.lang = "zh-CN";
    utter.rate = 0.85;
    synth.speak(utter);
  }

  function play() {
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      speak();
    };
    const audio = new Audio(`/audio/${audioFile}`);
    audio.addEventListener("error", fallback, { once: true });
    audio.play().catch(fallback);
  }

  return (
    <button
      type="button"
      onClick={play}
      className={chunky(variant)}
      aria-label={`Play pronunciation of ${fallbackText}`}
    >
      <span aria-hidden className="text-2xl">🔊</span>
      {label}
    </button>
  );
}
