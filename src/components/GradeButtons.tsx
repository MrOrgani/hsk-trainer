import type { Grade } from "@/db/schema";
import { chunky, type ChunkyVariant } from "./Button";

interface Props {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const LABELS: Array<{ grade: Grade; label: string; variant: ChunkyVariant }> = [
  { grade: "again", label: "Again", variant: "danger" },
  { grade: "hard", label: "Hard", variant: "warning" },
  { grade: "good", label: "Good", variant: "success" },
  { grade: "easy", label: "Easy", variant: "info" },
];

export function GradeButtons({ onGrade, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-xl mx-auto">
      {LABELS.map(({ grade, label, variant }) => (
        <button
          key={grade}
          type="button"
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className={chunky(variant, "w-full")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
