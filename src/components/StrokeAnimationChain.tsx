import { useEffect, useRef, useState, useCallback } from "react";
import HanziWriter from "hanzi-writer";

interface Props {
  characters: string[];
  size?: number;
  onAllDone?: () => void;
}

type CharState = "waiting" | "animating" | "done";

/**
 * Renders a sequence of characters and animates their strokes one at a time.
 * When character N finishes, character N+1 begins automatically.
 */
export function StrokeAnimationChain({ characters, size = 200, onAllDone }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const onAllDoneRef = useRef(onAllDone);
  useEffect(() => { onAllDoneRef.current = onAllDone; }, [onAllDone]);

  const handleCharDone = useCallback(() => {
    setActiveIndex((prev) => {
      const next = prev + 1;
      if (next >= characters.length) {
        // All characters finished — fire callback on next tick
        setTimeout(() => onAllDoneRef.current?.(), 0);
      }
      return next;
    });
  }, [characters.length]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {characters.map((char, i) => {
        let state: CharState = "waiting";
        if (i < activeIndex) state = "done";
        else if (i === activeIndex) state = "animating";

        return (
          <ChainedChar
            key={`${char}:${i}`}
            character={char}
            size={size}
            state={state}
            onDone={handleCharDone}
          />
        );
      })}
    </div>
  );
}

interface ChainedCharProps {
  character: string;
  size: number;
  state: CharState;
  onDone: () => void;
}

function ChainedChar({ character, size, state, onDone }: ChainedCharProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    target.replaceChildren();

    if (state === "waiting") {
      // Show only the outline — character hidden
      HanziWriter.create(target, character, {
        width: size,
        height: size,
        padding: 8,
        showOutline: true,
        showCharacter: false,
        strokeColor: "#c93545",
        outlineColor: "#d6cdbf",
      });
      return () => { target.replaceChildren(); };
    }

    if (state === "done") {
      // Show the fully drawn character
      HanziWriter.create(target, character, {
        width: size,
        height: size,
        padding: 8,
        showOutline: true,
        showCharacter: true,
        strokeColor: "#c93545",
        outlineColor: "#d6cdbf",
      });
      return () => { target.replaceChildren(); };
    }

    // state === "animating"
    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 8,
      showOutline: true,
      showCharacter: false,
      strokeColor: "#c93545",
      outlineColor: "#d6cdbf",
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 120,
    });

    writer.animateCharacter({
      onComplete: () => onDoneRef.current?.(),
    });

    return () => { target.replaceChildren(); };
  }, [character, size, state]);

  // Ring styling per state
  const ringClass =
    state === "animating"
      ? "ring-2 ring-gold-400 shadow-lg shadow-gold-200/40"
      : state === "done"
        ? "ring-1 ring-jade-300/60"
        : "ring-1 ring-ink-200/40 opacity-60";

  return (
    <div
      ref={containerRef}
      aria-label={`Stroke order for ${character}`}
      className={`mx-auto rounded-xl transition-all duration-300 ${ringClass}`}
      style={{ width: size, height: size }}
    />
  );
}
