import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import type { StrokeData } from "hanzi-writer";


export interface CompletedChar {
  char: string;
  mistakes: number;
}

export interface CharResult {
  mistakes: number;
  strokeMistakes: number[];
  hintsUsed: number;
  fullRevealUsed: boolean;
}

export function masteryColor(mistakes: number): string {
  if (mistakes === 0) return "#0d9373";
  if (mistakes <= 2) return "#c8951a";
  return "#c93545";
}

interface Props {
  character: string;
  onComplete: (result: CharResult) => void;
  size?: number;
  leniency?: "strict" | "lenient-order";
  completedChars?: CompletedChar[];
}

function computeSize(max: number): number {
  if (typeof window === "undefined") return max;
  const fit = window.innerWidth - 48;
  return Math.max(200, Math.min(max, fit));
}

function leniencyScalar(mode: "strict" | "lenient-order"): number {
  return mode === "strict" ? 1.5 : 2.5;
}

// Pointer movement under this (in px) counts as a stationary tap rather than a stroke.
const TAP_MOVE_THRESHOLD_PX = 8;
const TAP_MAX_DURATION_MS = 300;
const DOUBLE_TAP_MS = 300;

export function DrawingCanvas({
  character,
  onComplete,
  size: maxSize = 260,
  leniency = "strict",
  completedChars = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const [size, setSize] = useState(() => computeSize(maxSize));
  const [completed, setCompleted] = useState(false);
  const writerRef = useRef<HanziWriter | null>(null);
  const currentStrokeRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const fullRevealRef = useRef(false);
  const completedRef = useRef(false);
  const replayingRef = useRef(false);

  // Tap-detection state.
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const tapMovedRef = useRef(false);
  const lastTapAtRef = useRef(0);
  const pendingSingleTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onResize = () => setSize(computeSize(maxSize));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maxSize]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    target.replaceChildren();
    setCompleted(false);
    completedRef.current = false;
    currentStrokeRef.current = 0;
    hintsUsedRef.current = 0;
    fullRevealRef.current = false;

    let mistakes = 0;
    const strokeMistakes: number[] = [];
    const writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 10,
      showCharacter: false,
      showOutline: false,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 50,
      strokeColor: "#1c1917",
      outlineColor: "#d6cdbf",
      highlightColor: "#00c0ff",
      drawingColor: "#999999",
      drawingWidth: 50,
    });
    writerRef.current = writer;

    writer.quiz({
      onMistake: () => {
        mistakes += 1;
      },
      onCorrectStroke: (strokeData: StrokeData) => {
        strokeMistakes.push(strokeData.mistakesOnStroke);
        currentStrokeRef.current = strokeData.strokeNum + 1;
      },
      onComplete: () => {
        const color = masteryColor(mistakes);
        const totalUpdates = 4;
        let done = 0;
        const finish = () => {
          if (++done >= totalUpdates) {
            setCompleted(true);
            completedRef.current = true;
            onCompleteRef.current({
              mistakes,
              strokeMistakes,
              hintsUsed: hintsUsedRef.current,
              fullRevealUsed: fullRevealRef.current,
            });
          }
        };
        writer.updateColor("strokeColor", color, { duration: 300, onComplete: finish });
        writer.updateColor("radicalColor", color, { duration: 300, onComplete: finish });
        writer.updateColor("drawingColor", color, { duration: 300, onComplete: finish });
        writer.updateColor("outlineColor", color, { duration: 300, onComplete: finish });
      },
      showHintAfterMisses: false,
      highlightOnComplete: false,
      acceptBackwardsStrokes: true,
      leniency: leniencyScalar(leniency),
    });

    return () => {
      writer.cancelQuiz();
      writerRef.current = null;
      if (pendingSingleTapRef.current) {
        clearTimeout(pendingSingleTapRef.current);
        pendingSingleTapRef.current = null;
      }
    };
  }, [character, size, leniency]);

  function fireHint() {
    const writer = writerRef.current;
    if (!writer || completedRef.current) return;
    hintsUsedRef.current += 1;
    void writer.highlightStroke(currentStrokeRef.current);
  }

  function fireReveal() {
    const writer = writerRef.current;
    if (!writer || completedRef.current) return;
    if (hintsUsedRef.current === 0 || fullRevealRef.current) return;
    fullRevealRef.current = true;
    void writer.showOutline({ duration: 300 });
    void writer.highlightStroke(currentStrokeRef.current);
  }

  function fireReplay() {
    const writer = writerRef.current;
    if (!writer || !completedRef.current || replayingRef.current) return;
    replayingRef.current = true;
    void writer.animateCharacter({
      onComplete: () => {
        replayingRef.current = false;
      },
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    tapStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    tapMovedRef.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = tapStartRef.current;
    if (!start || tapMovedRef.current) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > TAP_MOVE_THRESHOLD_PX * TAP_MOVE_THRESHOLD_PX) {
      tapMovedRef.current = true;
    }
  }

  function onPointerUp() {
    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (!start || tapMovedRef.current) return;
    if (Date.now() - start.t > TAP_MAX_DURATION_MS) return;

    // Post-completion: taps replay the character; no hint/reveal escalation.
    if (completedRef.current) {
      fireReplay();
      return;
    }

    const now = Date.now();
    const isDouble = now - lastTapAtRef.current < DOUBLE_TAP_MS;
    lastTapAtRef.current = now;

    if (isDouble) {
      if (pendingSingleTapRef.current) {
        clearTimeout(pendingSingleTapRef.current);
        pendingSingleTapRef.current = null;
      }
      // Inkstone: double-tap reveals only after the single-tap budget has been burned.
      fireReveal();
      return;
    }

    // Defer the hint so a trailing tap can upgrade to a double-tap reveal.
    pendingSingleTapRef.current = setTimeout(() => {
      pendingSingleTapRef.current = null;
      fireHint();
    }, DOUBLE_TAP_MS);
  }

  return (
    <div
      className="relative mx-auto rounded-xl hanzi-grid"
      style={{ width: size, height: size }}
    >
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { tapStartRef.current = null; }}
        style={{
          width: size,
          height: size,
          touchAction: "none",
          cursor: completed ? "pointer" : "default",
        }}
      />
    </div>
  );
}
