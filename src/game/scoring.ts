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
