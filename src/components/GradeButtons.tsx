import type { Grade } from "@/db/schema";

interface Props {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const LABELS: Array<{ grade: Grade; label: string; className: string }> = [
  { grade: "again", label: "Again", className: "bg-rose-600 hover:bg-rose-700" },
  { grade: "hard", label: "Hard", className: "bg-amber-500 hover:bg-amber-600" },
  { grade: "good", label: "Good", className: "bg-emerald-600 hover:bg-emerald-700" },
  { grade: "easy", label: "Easy", className: "bg-sky-600 hover:bg-sky-700" },
];

export function GradeButtons({ onGrade, disabled }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {LABELS.map(({ grade, label, className }) => (
        <button
          key={grade}
          type="button"
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className={`rounded px-3 py-2 text-white text-sm font-medium disabled:opacity-40 ${className}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
