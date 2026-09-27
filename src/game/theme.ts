/** Единая палитра и шрифты — легко менять в одном месте. */
export const COLORS = {
  primary: 0xff8c42, // оранжевый
  secondary: 0x6bcb77, // зелёный
  accent: 0xffd93d, // жёлтый
  danger: 0xee5253, // красный
  background: 0x4a90d9, // синий фон
} as const;

export const FONTS = {
  main: '"Comic Sans MS", "Arial Rounded MT Bold", system-ui, sans-serif',
  /** Декоративный шрифт для английского языка (DynaPuff из index.html). */
  dynaPuff: '"DynaPuff", "Comic Sans MS", "Arial Rounded MT Bold", system-ui, sans-serif',
} as const;

/**
 * Возвращает основной шрифт для текущего языка.
 * Английский — «DynaPuff» (детский декоративный), русский — системный фолбэк,
 * т.к. DynaPuff не содержит кириллицы.
 */
export function getMainFont(lang: string): string {
  return lang === 'en' ? FONTS.dynaPuff : FONTS.main;
}
