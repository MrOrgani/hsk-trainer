import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";

interface Props {
  character: string;
  /** Called once when the user has drawn every stroke of the character. */
  onComplete: (result: { mistakes: number }) => void;
  /** Square size in px — defaults to a mobile-friendly 260. */
  size?: number;
}

/**
 * Imperative bridge to hanzi-writer's quiz mode. The library owns the SVG DOM;
 * React owns the outer `<div>` ref and the lifecycle.
 *
 * We key the effect on `character` so that navigating to the next character
 * in a multi-char word tears down the previous writer cleanly.
 */
export function DrawingCanvas({ character, onComplete, size = 260 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest onComplete without retriggering the effect.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    // Clear any previous SVG between re-mounts (safe: no user content).
    target.replaceChildren();

    let mistakes = 0;
    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 10,
      showCharacter: false,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 50,
      strokeColor: "#15803d", // tailwind green-700
      outlineColor: "#e5e7eb", // tailwind gray-200
      highlightColor: "#22c55e", // tailwind green-500
    });

    writer.quiz({
      onMistake: () => {
        mistakes += 1;
      },
      onComplete: () => {
        onCompleteRef.current({ mistakes });
      },
    });

    return () => {
      writer.cancelQuiz();
    };
  }, [character, size]);

  return (
    <div
      ref={containerRef}
      aria-label={`Draw the character ${character}`}
      className="mx-auto rounded-2xl bg-white border-2 border-b-4 border-gray-200"
      style={{ width: size, height: size, touchAction: "none" }}
    />
  );
}
