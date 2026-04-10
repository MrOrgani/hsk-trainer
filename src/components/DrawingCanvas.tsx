import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";

interface Props {
  character: string;
  onComplete: (result: { mistakes: number }) => void;
  size?: number;
}

export function DrawingCanvas({ character, onComplete, size = 260 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
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
      strokeColor: "#1c1917",    // ink-900 — true ink black
      outlineColor: "#d6cdbf",   // ink-200 — warm gray outline
      highlightColor: "#c93545", // vermillion-500 — highlight strokes
      drawingColor: "#3d352a",   // ink-600 — dark ink drawing
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
      className="mx-auto rounded-xl card"
      style={{ width: size, height: size, touchAction: "none" }}
    />
  );
}
