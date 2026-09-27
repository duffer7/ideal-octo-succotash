/**
 * Прогресс игрока. Пока хранится в localStorage.
 * Позже легко заменить на @capacitor/preferences (нативное хранилище).
 */

const STORAGE_KEY = 'kidsgame.progress.v1';

interface ProgressData {
  /** Максимальный доступный уровень (1-based). */
  unlocked: number;
  /** Звёзды за каждый уровень (индекс = уровень - 1). */
  stars: number[];
}

const DEFAULT_PROGRESS: ProgressData = {
  unlocked: 1,
  stars: [],
};

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return {
      unlocked: parsed.unlocked ?? 1,
      stars: parsed.stars ?? [],
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function save(data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[Progress] Не удалось сохранить прогресс:', err);
  }
}

export const Progress = {
  getUnlocked(): number {
    return load().unlocked;
  },

  getStars(level: number): number {
    const data = load();
    return data.stars[level - 1] ?? 0;
  },

  /** Отмечает уровень пройденным, сохраняет звёзды (0..3) и открывает следующий. */
  setResult(level: number, stars: number): void {
    const data = load();
    data.stars[level - 1] = Math.max(data.stars[level - 1] ?? 0, stars);
    if (level >= data.unlocked) {
      data.unlocked = level + 1;
    }
    save(data);
  },

  /** Сброс прогресса (например, родительский контроль). */
  reset(): void {
    save({ ...DEFAULT_PROGRESS });
  },
};
