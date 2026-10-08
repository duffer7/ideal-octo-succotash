/**
 * Очки за сортировку.
 *
 * У предмета есть своя цена. Верный сбор начисляет её с множителем серии,
 * ошибка снимает половину. Звёзды — по доле очков, которую удалось сохранить.
 */

/** Множитель серии: с 3 верных подряд сбор дороже, с 6 — ещё дороже. */
export function comboMultiplier(combo: number): number {
  if (combo >= 6) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

/** Очки за верную корзину. */
export function collectPoints(base: number, combo: number): number {
  return Math.round(base * comboMultiplier(combo));
}

/** Штраф за неверную корзину: половина цены предмета, но не меньше 5. */
export function mistakeCost(base: number): number {
  return Math.max(5, Math.round(base * 0.5));
}

/**
 * 3 звезды — сохранено от 90% начисленного,
 * 2 — от 65%, иначе 1. Уровень при этом всё равно пройден.
 */
export function starsFromScore(gained: number, lost: number): 1 | 2 | 3 {
  if (gained <= 0) return 1;
  const kept = Math.max(0, gained - lost) / gained;
  if (kept >= 0.9) return 3;
  if (kept >= 0.65) return 2;
  return 1;
}

/** Цветная звезда за скорость. Чем быстрее проход, тем выше ранг. */
export type BonusStarRank = 'basic' | 'rare' | 'epic';

export interface BonusLimits {
  /** Секунды, до которых ещё даётся этот ранг (включительно). */
  epic: number;
  rare: number;
  basic: number;
}

const BONUS_SCORE: Record<BonusStarRank, number> = {
  basic: 1,
  rare: 2,
  epic: 3,
};

/**
 * Пороги времени на уровень.
 * Нижняя оценка — предметы появляются по интервалу спавна, плюс запас на последний.
 * Превосходно близко к этому темпу, обычно — заметно спокойнее.
 */
export function bonusLimits(
  targetCount: number,
  spawnIntervalMs: number,
): BonusLimits {
  const floorMs = Math.max(0, targetCount - 1) * spawnIntervalMs + 4000;
  const seconds = (factor: number) => Math.ceil((floorMs * factor) / 1000);
  const epic = seconds(1.35);
  const rare = Math.max(epic + 4, seconds(2));
  const basic = Math.max(rare + 6, seconds(2.8));
  return { epic, rare, basic };
}

/** Ранг за уже заработанные 3 звезды и время прохождения в секундах. */
export function bonusRankForSeconds(
  seconds: number,
  limits: BonusLimits,
): BonusStarRank | null {
  if (seconds <= limits.epic) return 'epic';
  if (seconds <= limits.rare) return 'rare';
  if (seconds <= limits.basic) return 'basic';
  return null;
}

/** Доли одного уровня: 3 звезды и эпическая суперзвезда весят поровну. */
function completionUnits(stars: number, bonus: BonusStarRank | null): number {
  const starPart = Math.max(0, Math.min(3, Math.floor(stars)));
  const bonusPart = bonus ? BONUS_SCORE[bonus] : 0;
  return starPart + bonusPart;
}

/**
 * Доля прохождения сезона.
 * 100% — каждый уровень на 3 звезды и с эпической суперзвездой.
 */
export function seasonCompletionPercent(
  levelCount: number,
  stars: readonly number[],
  bonuses: readonly (BonusStarRank | null)[],
): number {
  if (levelCount <= 0) return 0;
  let gained = 0;
  for (let i = 0; i < levelCount; i++) {
    gained += completionUnits(stars[i] ?? 0, bonuses[i] ?? null);
  }
  return Math.round((gained / (levelCount * 6)) * 100);
}

/** Лучший из двух рангов. Пустой не затирает уже полученный. */
export function bestBonusRank(
  current: BonusStarRank | null,
  next: BonusStarRank | null,
): BonusStarRank | null {
  if (!current) return next;
  if (!next) return current;
  return BONUS_SCORE[current] >= BONUS_SCORE[next] ? current : next;
}

/** Старые сохранения хранили `true` вместо ранга — это обычная звезда. */
export function coerceBonusRank(value: unknown): BonusStarRank | null {
  if (value === 'basic' || value === 'rare' || value === 'epic') return value;
  if (value === true) return 'basic';
  return null;
}

/** `65` → `1:05`. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
