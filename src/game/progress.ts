/**
 * Прогресс игрока. Пока хранится в localStorage.
 * Позже легко заменить на @capacitor/preferences (нативное хранилище).
 *
 * Прогресс привязан к сезону: у каждого сезона своя разблокировка и звёзды.
 */
import { ACTIVE_SEASON, getSeason, type SeasonId } from './seasons';

const STORAGE_KEY = 'kidsgame.progress.v2';

/** Прогресс одного сезона. */
interface SeasonProgress {
  /** Максимальный доступный уровень (1-based). */
  unlocked: number;
  /** Звёзды за каждый уровень (индекс = уровень - 1). */
  stars: number[];
}

/** Прогресс всех сезонов. */
type ProgressData = Record<string, SeasonProgress>;

const DEFAULT_SEASON_PROGRESS: SeasonProgress = {
  unlocked: 1,
  stars: [],
};

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressData;
  } catch {
    return {};
  }
}

function save(data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[Progress] Не удалось сохранить прогресс:', err);
  }
}

function getSeasonProgress(
  data: ProgressData,
  seasonId: SeasonId,
): SeasonProgress {
  return data[seasonId] ?? { ...DEFAULT_SEASON_PROGRESS };
}

export const Progress = {
  /** Максимальный доступный уровень в сезоне (по умолчанию — активном). */
  getUnlocked(seasonId: SeasonId = ACTIVE_SEASON): number {
    const data = load();
    return getSeasonProgress(data, seasonId).unlocked;
  },

  /** Звёзды за уровень в сезоне (0..3). */
  getStars(level: number, seasonId: SeasonId = ACTIVE_SEASON): number {
    const data = load();
    const sp = getSeasonProgress(data, seasonId);
    return sp.stars[level - 1] ?? 0;
  },

  /**
   * Отмечает уровень пройденным, сохраняет звёзды (0..3) и открывает следующий.
   * Не открывает уровень выше количества уровней в сезоне.
   */
  setResult(
    level: number,
    stars: number,
    seasonId: SeasonId = ACTIVE_SEASON,
  ): void {
    const data = load();
    const sp = getSeasonProgress(data, seasonId);
    sp.stars[level - 1] = Math.max(sp.stars[level - 1] ?? 0, stars);

    const maxLevel = getSeason(seasonId).levelCount;
    if (level >= sp.unlocked && sp.unlocked < maxLevel) {
      sp.unlocked = level + 1;
    }

    data[seasonId] = sp;
    save(data);
  },

  /** Сброс прогресса сезона (или всех, если id не указан). */
  reset(seasonId?: SeasonId): void {
    if (!seasonId) {
      save({});
      return;
    }
    const data = load();
    delete data[seasonId];
    save(data);
  },
};
