/**
 * Реестр сезонов. Пока реализован только «Лето» (10 уровней).
 * Остальные сезоны добавляются в SEASONS_REGISTRY по мере готовности.
 */
import type { Season, SeasonId, LevelConfig } from './types';
import { summer } from './summer';

export * from './types';

/** Все доступные сезоны по идентификатору. */
export const SEASONS_REGISTRY: Partial<Record<SeasonId, Season>> = {
  summer,
  // autumn: ...  (позже)
  // winter: ...  (позже)
  // spring: ...  (позже)
};

/** Порядок сезонов в игре. */
export const SEASON_ORDER: SeasonId[] = ['summer', 'autumn', 'winter', 'spring'];

/** Текущий (активный) сезон. Пока всегда лето. */
export const ACTIVE_SEASON: SeasonId = 'summer';

/** Возвращает сезон по id, бросает ошибку, если он ещё не реализован. */
export function getSeason(id: SeasonId): Season {
  const season = SEASONS_REGISTRY[id];
  if (!season) {
    throw new Error(`Сезон "${id}" ещё не реализован`);
  }
  return season;
}

/** Возвращает текущий активный сезон. */
export function getActiveSeason(): Season {
  return getSeason(ACTIVE_SEASON);
}

/** Возвращает параметры уровня сезона по его номеру (1-based). */
export function getLevel(seasonId: SeasonId, number: number): LevelConfig {
  const season = getSeason(seasonId);
  const level = season.levels.find((l) => l.number === number);
  if (!level) {
    throw new Error(`Уровень ${number} не найден в сезоне "${seasonId}"`);
  }
  return level;
}
