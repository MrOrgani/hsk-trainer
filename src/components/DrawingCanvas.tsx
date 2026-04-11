import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";
import type { StrokeData } from "hanzi-writer";


export interface CompletedChar {
  char: string;
  mistakes: number;
}

export function masteryColor(mistakes: number): string {
  if (mistakes === 0) return "#0d9373"; // jade-500
  if (mistakes <= 2) return "#c8951a"; // gold-500
  return "#c93545"; // vermillion-500
}

interface Props {
  character: string;
  onComplete: (result: { mistakes: number; strokeMistakes: number[] }) => void;
  size?: number;
  leniency?: "strict" | "lenient-order";
  showOutline?: boolean;
  /** Previously completed characters — shown small in the top-left corner */
  completedChars?: CompletedChar[];
}

export function DrawingCanvas({ character, onComplete, size = 260, leniency = "strict", showOutline = true, completedChars = [] }: Props) {
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
    const strokeMistakes: number[] = [];
    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 10,
      showCharacter: false,
      showOutline,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 50,
      strokeColor: "#1c1917",    // ink-900 — true ink black
      outlineColor: "#d6cdbf",   // ink-200 — warm gray outline
      highlightColor: "#00c0ff", // cyan — Inkstone-style hint color
      drawingColor: "#999999",   // soft gray while drawing
      drawingWidth: 50,          // bold brush-like strokes (coordinate space is 1024 units)
    });

    writer.quiz({
      onMistake: () => {
        mistakes += 1;
      },
      onCorrectStroke: (strokeData: StrokeData) => {
        strokeMistakes.push(strokeData.mistakesOnStroke);
      },
      onComplete: () => {
        const color = masteryColor(mistakes);
        // Color ALL stroke layers so the entire character shows the mastery color.
        // radicalColor must also be updated: hanzi-writer uses radicalColor for
        // strokes marked as part of the radical (e.g. 父 in 爸). Without this,
        // those strokes stay their original color while the rest change.
        const totalUpdates = 4;
        let done = 0;
        const finish = () => { if (++done >= totalUpdates) onCompleteRef.current({ mistakes, strokeMistakes }); };
        writer.updateColor('strokeColor', color, { duration: 300, onComplete: finish });
        writer.updateColor('radicalColor', color, { duration: 300, onComplete: finish });
        writer.updateColor('drawingColor', color, { duration: 300, onComplete: finish });
        writer.updateColor('outlineColor', color, { duration: 300, onComplete: finish });
      },
      showHintAfterMisses: 3,
      highlightOnComplete: false,
      acceptBackwardsStrokes: leniency === "lenient-order",
      leniency: leniency === "lenient-order" ? 1.2 : 1.0,
    });

    return () => {
      writer.cancelQuiz();
    };
  }, [character, size, leniency, showOutline]);

  return (
    <div
      className="relative mx-auto rounded-xl hanzi-grid"
      style={{ width: size, height: size }}
    >
      {/* Previously completed characters — small in top-left corner */}
      {completedChars.length > 0 && (
        <div className="absolute top-1.5 left-2 flex gap-0.5 z-10 pointer-events-none">
          {completedChars.map((c, i) => (
            <span
              key={i}
              className="font-hanzi font-bold"
              style={{
                fontSize: size * 0.13,
                lineHeight: 1,
                color: masteryColor(c.mistakes),
                opacity: 0.7,
              }}
            >
              {c.char}
            </span>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        aria-label={`Draw the character ${character}`}
        style={{ width: size, height: size, touchAction: "none" }}
      />
    </div>
  );
}
