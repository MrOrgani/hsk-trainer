import { chunky, type ChunkyVariant } from "./Button";

interface Props {
  audioFile: string;
  fallbackText: string;
  label?: string;
  variant?: ChunkyVariant;
}

export function AudioButton({
  audioFile,
  fallbackText,
  label = "Play",
  variant = "neutral",
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
      <span aria-hidden className="text-xl">🔊</span>
      {label}
    </button>
  );
}
