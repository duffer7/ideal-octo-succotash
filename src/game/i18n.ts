/**
 * Простая система локализации без внешних зависимостей.
 * Поддерживает два языка: английский и русский.
 *
 * Использование:
 *   t('menu.title')            // строка по текущему языку
 *   setLanguage('en')          // сменить язык (сохраняется в localStorage)
 *   onLanguageChange(cb)       // подписка на смену языка
 */

/** Доступные языки. */
export type Language = 'en' | 'ru';

export const LANGUAGES: readonly Language[] = ['ru', 'en'] as const;

/** Человекочитаемые названия языков (для экрана настроек). */
export const LANGUAGE_LABELS: Record<Language, string> = {
  ru: 'Русский',
  en: 'English',
};

/** Флаги-эмодзи для кнопок выбора языка. */
export const LANGUAGE_FLAGS: Record<Language, string> = {
  ru: '🇷🇺',
  en: '🇬🇧',
};

/** Словарь строк. Ключи одинаковы для всех языков. */
type Dictionary = {
  'common.back': string;
  'common.language': string;

  'menu.title': string;
  'menu.play': string;
  'menu.settings': string;

  'settings.title': string;
  'settings.language': string;

  'levelSelect.title': string;
  'levelSelect.season': string;

  'season.summer.name': string;
  'season.summer.cat.sand': string;
  'season.summer.cat.water': string;

  'game.level': string;
  'game.wellDone': string;
  'game.next': string;
  'game.wrong': string;

  'orientation.rotate': string;

  'error.start': string;
};

const DICTIONARIES: Record<Language, Dictionary> = {
  ru: {
    'common.back': '←',
    'common.language': 'Язык',

    'menu.title': 'Обучающая игра',
    'menu.play': 'Играть',
    'menu.settings': 'Настройки',

    'settings.title': 'Настройки',
    'settings.language': 'Язык',

    'levelSelect.title': 'Выбери уровень',
    'levelSelect.season': 'Лето',

    'season.summer.name': 'Лето',
    'season.summer.cat.sand': 'Песок',
    'season.summer.cat.water': 'Вода',

    'game.level': 'Уровень {n}',
    'game.wellDone': 'Молодец! ★★★',
    'game.next': 'Дальше',
    'game.wrong': 'Ой! Попробуй ещё',

    'orientation.rotate': 'Поверните устройство горизонтально',

    'error.start': 'Не удалось запустить игру 😢',
  },
  en: {
    'common.back': '←',
    'common.language': 'Language',

    'menu.title': 'Learning Game',
    'menu.play': 'Play',
    'menu.settings': 'Settings',

    'settings.title': 'Settings',
    'settings.language': 'Language',

    'levelSelect.title': 'Choose a level',
    'levelSelect.season': 'Summer',

    'season.summer.name': 'Summer',
    'season.summer.cat.sand': 'Sand',
    'season.summer.cat.water': 'Water',

    'game.level': 'Level {n}',
    'game.wellDone': 'Well done! ★★★',
    'game.next': 'Next',
    'game.wrong': 'Oops! Try again',

    'orientation.rotate': 'Rotate your device to landscape',

    'error.start': 'Failed to start the game 😢',
  },
};

export type TranslationKey = keyof Dictionary;

const STORAGE_KEY = 'kidsgame.language.v1';

/** Определяет язык по умолчанию: сохранённый -> язык браузера -> английский. */
function detectInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && saved in DICTIONARIES) return saved;
  } catch {
    // localStorage может быть недоступен — игнорируем.
  }

  const browser = (navigator.language || 'en').toLowerCase();
  return browser.startsWith('ru') ? 'ru' : 'en';
}

let currentLanguage: Language = detectInitialLanguage();

type LanguageListener = (lang: Language) => void;
const listeners = new Set<LanguageListener>();

/** Возвращает текущий язык. */
export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Переводит строку по ключу.
 * Подставляет параметры вида {name} из аргумента params.
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let text = DICTIONARIES[currentLanguage][key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

/** Устанавливает язык, сохраняет его и уведомляет подписчиков. */
export function setLanguage(lang: Language): void {
  if (lang === currentLanguage) return;
  currentLanguage = lang;

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Игнорируем ошибки хранилища.
  }

  // Обновляем lang у <html> для доступности.
  document.documentElement.lang = lang;

  listeners.forEach((cb) => cb(lang));
}

/** Подписка на смену языка. Возвращает функцию отписки. */
export function onLanguageChange(cb: LanguageListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Синхронизируем атрибут lang при загрузке.
document.documentElement.lang = currentLanguage;
