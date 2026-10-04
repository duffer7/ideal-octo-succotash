/**
 * Простая система локализации без внешних зависимостей.
 * Поддерживает два языка: английский и русский.
 *
 * Использование:
 *   t('menu.title')            // строка по текущему языку
 *   setLanguage('en')          // сменить язык (сохраняется в localStorage)
 *   onLanguageChange(cb)       // подписка на смену языка
 */

import { ensureFontsLoaded } from './fonts';

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
  'settings.music': string;
  'settings.sounds': string;
  'settings.credits': string;

  'credits.title': string;
  'credits.developer': string;
  'credits.developerName': string;
  'credits.music': string;
  'credits.musicName': string;

  'seasonSelect.title': string;

  'levelSelect.title': string;
  'levelSelect.season': string;
  'levelSelect.album': string;
  'levelSelect.daily': string;
  'levelSelect.dailyDone': string;
  'levelSelect.soon': string;

  'season.summer.name': string;
  'season.autumn.name': string;
  'season.winter.name': string;
  'season.spring.name': string;
  'season.summer.cat.sand': string;
  'season.summer.cat.water': string;
  'season.summer.cat.trash': string;

  'game.level': string;
  'game.wellDone': string;
  'game.next': string;
  'game.wrong': string;
  'game.misses': string;
  'game.missesShort': string;
  'game.combo': string;
  'game.frozen': string;
  'game.superStar': string;
  'game.dailyTitle': string;
  'game.dailyWin': string;
  'game.dailyAlmost': string;
  'game.retry': string;
  'game.newSticker': string;
  'game.score': string;

  'guide.goal': string;
  'guide.dailyGoal': string;
  'guide.stars': string;
  'guide.skip': string;
  'guide.any': string;
  'guide.tip.match': string;
  'guide.tip.daily': string;
  'guide.tip.rocks': string;
  'guide.tip.freeze': string;
  'guide.tip.trash': string;
  'guide.tip.combo': string;
  'guide.start': string;

  'exit.title': string;
  'exit.body': string;
  'exit.stay': string;
  'exit.leave': string;

  'album.title': string;

  'sticker.shell': string;
  'sticker.star': string;
  'sticker.pebble': string;
  'sticker.wave': string;
  'sticker.sun': string;
  'sticker.bucket': string;
  'sticker.crab': string;
  'sticker.bird': string;
  'sticker.palm': string;
  'sticker.castle': string;

  'orientation.rotate': string;

  'error.start': string;
};

const DICTIONARIES: Record<Language, Dictionary> = {
  ru: {
    'common.back': '←',
    'common.language': 'Язык',

    'menu.title': 'Небесная Охота: Поймай Сокровище',
    'menu.play': 'Играть',
    'menu.settings': 'Настройки',

    'settings.title': 'Настройки',
    'settings.language': 'Язык',
    'settings.music': 'Музыка',
    'settings.sounds': 'Звуки',
    'settings.credits': 'Авторы',

    'credits.title': 'Авторы',
    'credits.developer': 'Разработчик',
    'credits.developerName': 'GAV Entertainment',
    'credits.music': 'Музыка',
    'credits.musicName': 'AtlasAudio',

    'seasonSelect.title': 'Выбери сезон',

    'levelSelect.title': 'Выбери уровень',
    'levelSelect.season': 'Лето',
    'levelSelect.album': 'Альбом',
    'levelSelect.daily': 'Сегодня: {n} без ошибок',
    'levelSelect.dailyDone': 'Сегодня готово!',
    'levelSelect.soon': 'Скоро',

    'season.summer.name': 'Лето',
    'season.autumn.name': 'Осень',
    'season.winter.name': 'Зима',
    'season.spring.name': 'Весна',
    'season.summer.cat.sand': 'Песок',
    'season.summer.cat.water': 'Вода',
    'season.summer.cat.trash': 'Мусор',

    'game.level': 'Уровень {n}',
    'game.wellDone': 'Готово!',
    'game.next': 'Дальше',
    'game.wrong': 'Ой! Попробуй ещё',
    'game.misses': 'Неверно: {n}',
    'game.missesShort': '✕ {n}',
    'game.combo': 'Комбо ×{n}!',
    'game.frozen': 'Заморозка!',
    'game.superStar': 'Супер-звезда!',
    'game.dailyTitle': 'Сегодня',
    'game.dailyWin': 'Чисто!',
    'game.dailyAlmost': 'Почти! Нужно без ошибок',
    'game.retry': 'Ещё раз',
    'game.newSticker': 'Новая открытка!',
    'game.score': 'Очки: {n}',

    'guide.goal': 'Нужно {n} очков',
    'guide.dailyGoal': '{n} без ошибок',
    'guide.stars': 'Меньше ошибок — больше звёзд',
    'guide.skip': 'мимо',
    'guide.any': 'любая',
    'guide.tip.match': 'Клади в корзину с такой же картинкой. Коснись — подскажу.',
    'guide.tip.daily': 'Нужно без единой ошибки.',
    'guide.tip.rocks': 'Камни не лови.',
    'guide.tip.freeze': 'Лёд — в любую корзину, и всё замедлится.',
    'guide.tip.trash': 'Бутылки и банки — в мусорку сбоку.',
    'guide.tip.combo': 'Три подряд дают больше очков.',
    'guide.start': 'Вперёд!',

    'exit.title': 'Выйти?',
    'exit.body': 'Прогресс уровня не сохранится.',
    'exit.stay': 'Остаться',
    'exit.leave': 'Выйти',

    'album.title': 'Альбом',

    'sticker.shell': 'Ракушка',
    'sticker.star': 'Звезда',
    'sticker.pebble': 'Камешек',
    'sticker.wave': 'Волна',
    'sticker.sun': 'Солнце',
    'sticker.bucket': 'Ведёрко',
    'sticker.crab': 'Краб',
    'sticker.bird': 'Чайка',
    'sticker.palm': 'Пальма',
    'sticker.castle': 'Замок',

    'orientation.rotate': 'Поверните устройство горизонтально',

    'error.start': 'Не удалось запустить игру 😢',
  },
  en: {
    'common.back': '←',
    'common.language': 'Language',

    'menu.title': 'Sky Bounty: Catch The Treasure',
    'menu.play': 'Play',
    'menu.settings': 'Options',

    'settings.title': 'Options',
    'settings.language': 'Language',
    'settings.music': 'Music',
    'settings.sounds': 'Sounds',
    'settings.credits': 'Credits',

    'credits.title': 'Credits',
    'credits.developer': 'Developer',
    'credits.developerName': 'GAV Entertainment',
    'credits.music': 'Music',
    'credits.musicName': 'AtlasAudio',

    'seasonSelect.title': 'Choose a season',

    'levelSelect.title': 'Choose a level',
    'levelSelect.season': 'Summer',
    'levelSelect.album': 'Album',
    'levelSelect.daily': 'Today: {n} with no mistakes',
    'levelSelect.dailyDone': 'Today is done!',
    'levelSelect.soon': 'Soon',

    'season.summer.name': 'Summer',
    'season.autumn.name': 'Autumn',
    'season.winter.name': 'Winter',
    'season.spring.name': 'Spring',
    'season.summer.cat.sand': 'Sand',
    'season.summer.cat.water': 'Water',
    'season.summer.cat.trash': 'Trash',

    'game.level': 'Level {n}',
    'game.wellDone': 'Completed',
    'game.next': 'Next',
    'game.wrong': 'Oops! Try again',
    'game.misses': 'Wrong: {n}',
    'game.missesShort': '✕ {n}',
    'game.combo': 'Combo ×{n}!',
    'game.frozen': 'Freeze!',
    'game.superStar': 'Super star!',
    'game.dailyTitle': 'Today',
    'game.dailyWin': 'Perfect!',
    'game.dailyAlmost': 'Almost! No mistakes needed',
    'game.retry': 'Again',
    'game.newSticker': 'New postcard!',
    'game.score': 'Score: {n}',

    'guide.goal': 'Score {n} points',
    'guide.dailyGoal': '{n} with no mistakes',
    'guide.stars': 'Fewer mistakes, more stars',
    'guide.skip': 'skip',
    'guide.any': 'any',
    'guide.tip.match': 'Drop it on the matching picture. Tap it for a hint.',
    'guide.tip.daily': 'No mistakes at all.',
    'guide.tip.rocks': 'Let the stones fall past.',
    'guide.tip.freeze': 'Ice fits any basket and slows the fall.',
    'guide.tip.trash': 'Bottles and cans go in the side bin.',
    'guide.tip.combo': 'Three in a row score more.',
    'guide.start': "Let's go!",

    'exit.title': 'Leave?',
    'exit.body': "This level's progress won't be saved.",
    'exit.stay': 'Stay',
    'exit.leave': 'Leave',

    'album.title': 'Album',

    'sticker.shell': 'Shell',
    'sticker.star': 'Starfish',
    'sticker.pebble': 'Pebble',
    'sticker.wave': 'Wave',
    'sticker.sun': 'Sun',
    'sticker.bucket': 'Bucket',
    'sticker.crab': 'Crab',
    'sticker.bird': 'Seagull',
    'sticker.palm': 'Palm',
    'sticker.castle': 'Castle',

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

  // Обновляем lang у <html> для доступности и заголовок вкладки.
  document.documentElement.lang = lang;
  document.title = DICTIONARIES[lang]['menu.title'];

  // Не дожидаясь загрузки веб-шрифта, чтобы при смене языка на английский
  // текст сразу отрисовался нужным шрифтом, а не фолбэком.
  void ensureFontsLoaded().finally(() => {
    listeners.forEach((cb) => cb(lang));
  });
}

/** Подписка на смену языка. Возвращает функцию отписки. */
export function onLanguageChange(cb: LanguageListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Синхронизируем атрибут lang и заголовок вкладки при загрузке.
document.documentElement.lang = currentLanguage;
document.title = DICTIONARIES[currentLanguage]['menu.title'];
