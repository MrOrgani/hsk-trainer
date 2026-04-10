import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";

interface Props {
  character: string;
  size?: number;
  onDone?: () => void;
}

export function StrokeAnimation({ character, size = 200, onDone }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    target.replaceChildren();

    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 8,
      showOutline: true,
      strokeColor: "#c93545",    // vermillion-500 — animated stroke
      outlineColor: "#d6cdbf",   // ink-200 — warm outline
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 120,
    });

    writer.animateCharacter({ onComplete: () => onDoneRef.current?.() });

    return () => {
      target.replaceChildren();
    };
  }, [character, size]);

  return (
    <div
      ref={containerRef}
      aria-label={`Stroke order for ${character}`}
      className="mx-auto rounded-xl hanzi-grid"
      style={{ width: size, height: size }}
    />
  );
}
