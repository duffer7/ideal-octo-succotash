/**
 * Ежедневное задание: правильно рассортировать N предметов без ошибок.
 * Хранится отдельно от прогресса уровней, сбрасывается по календарной дате.
 */

const STORAGE_KEY = 'kidsgame.daily.v1';

/** Сколько предметов нужно разложить без единой ошибки. */
export const DAILY_TARGET = 15;

interface DailyData {
  /** Локальная дата `YYYY-MM-DD`, когда задание засчитали. */
  date: string;
  done: boolean;
}

function todayKey(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function load(): DailyData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyData;
  } catch {
    return null;
  }
}

export const Daily = {
  target: DAILY_TARGET,

  /** Задание на сегодня уже выполнено. */
  isDone(): boolean {
    const data = load();
    return data?.date === todayKey() && data.done;
  },

  /** Отмечает сегодняшний зачёт. Повторный вызов ничего не портит. */
  markDone(): void {
    try {
      const payload: DailyData = { date: todayKey(), done: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Игнорируем ошибки хранилища.
    }
  },
};
