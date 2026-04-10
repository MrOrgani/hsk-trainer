import type { Grade } from "@/db/schema";
import { chunky, type ChunkyVariant } from "./Button";
import { useTranslation, type TranslationKey } from "@/lib/i18n";

interface Props {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const LABELS: Array<{ grade: Grade; labelKey: TranslationKey; variant: ChunkyVariant }> = [
  { grade: "again", labelKey: "grade.again", variant: "danger" },
  { grade: "hard", labelKey: "grade.hard", variant: "warning" },
  { grade: "good", labelKey: "grade.good", variant: "success" },
  { grade: "easy", labelKey: "grade.easy", variant: "info" },
];

export function GradeButtons({ onGrade, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-xl mx-auto">
      {LABELS.map(({ grade, labelKey, variant }) => (
        <button
          key={grade}
          type="button"
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className={chunky(variant, "w-full")}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
