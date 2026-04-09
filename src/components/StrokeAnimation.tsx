import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";

interface Props {
  character: string;
  size?: number;
  /** Called once the animation has played through all strokes. */
  onDone?: () => void;
}

/**
 * Plays the stroke animation for a single character. Auto-starts on mount.
 * Study flow uses this to show the user the correct stroke order before
 * handing off to a DrawingCanvas for the first attempt.
 */
export function StrokeAnimation({ character, size = 200, onDone }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    target.replaceChildren();

    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 8,
      showOutline: true,
      strokeColor: "#0ea5e9", // tailwind sky-500
      outlineColor: "#e5e7eb",
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 120,
    });

    writer.animateCharacter({ onComplete: () => onDone?.() });

    return () => {
      target.replaceChildren();
    };
  }, [character, size, onDone]);

  return (
    <div
      ref={containerRef}
      aria-label={`Stroke order for ${character}`}
      className="mx-auto"
      style={{ width: size, height: size }}
    />
  );
}
