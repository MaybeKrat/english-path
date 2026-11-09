// Small pieces shared by the screens.
import type { Stage } from "./lib/insights";

export const stageNames: Record<Stage, string> = {
  new: "Новые",
  learning: "Учу",
  familiar: "Знакомые",
  confident: "Уверенно",
  mastered: "Закреплено",
};
/** Filled segments of the four-step memory meter. */
export const stageLevel: Record<Stage, number> = { new: 0, learning: 1, familiar: 2, confident: 3, mastered: 4 };

export function quantity(n: number, one: string, few: string, many: string) {
  return n % 10 === 1 && n % 100 !== 11
    ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? few
      : many;
}

export function intervalLabel(days: number) {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} мин`;
  if (days < 1) return `${Math.round(days * 24)} ч`;
  return `${Math.round(days)} ${quantity(Math.round(days), "день", "дня", "дней")}`;
}

export function MemoryMeter({ stage }: { stage: Stage }) {
  return (
    <span className={`memory memory-${stageLevel[stage]}`} title={stageNames[stage]}>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
