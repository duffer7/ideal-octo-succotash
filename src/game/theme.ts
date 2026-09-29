import type Phaser from 'phaser';
import { UI, PALETTE, toCss } from './palette';

/**
 * Тема — семантика поверх палитры: цвета UI, шрифты, обводка текста.
 *
 * Все конкретные hex-значения живут в `palette.ts`. Здесь — только имена,
 * удобные приложению. `COLORS` оставлен для обратной совместимости и просто
 * указывает на семантические токены палитры.
 */
export const COLORS = UI;

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

/** Параметры обводки текста по умолчанию (тёмный контур для читаемости). */
export const TEXT_STROKE = {
  color: toCss(PALETTE.deepPurple),
  thickness: 8,
} as const;

/**
 * Наносит контур на текст, чтобы он оставался читаемым на любом фоне.
 * Возвращает тот же объект — удобно для цепочек создания текста.
 */
export function withStroke<T extends Phaser.GameObjects.Text>(
  text: T,
  color: string = TEXT_STROKE.color,
  thickness: number = TEXT_STROKE.thickness,
): T {
  text.setStroke(color, thickness);
  text.setShadow(0, 0, `${toCss(PALETTE.black)}55`, 0);
  return text;
}

