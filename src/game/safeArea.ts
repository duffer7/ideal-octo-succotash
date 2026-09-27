import Phaser from 'phaser';

/**
 * Безопасная зона (safe area) в логических координатах Phaser.
 * Учитывает «бровь», динамический остров и скругления углов.
 */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Пустая безопасная зона (fallback). */
export const EMPTY_INSETS: SafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/**
 * Считывает CSS env(safe-area-inset-*), применённые к #safe-area-probe.
 * Возвращает значения в CSS-пикселях.
 */
function readCssInsets(): SafeAreaInsets {
  const probe = document.getElementById('safe-area-probe');
  if (!probe) return { ...EMPTY_INSETS };

  const style = getComputedStyle(probe);
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
}

/**
 * Переводит безопасную зону из CSS-пикселей в логические координаты Phaser.
 * Учитывает масштаб канваса (Scale.FIT) и центрирование.
 *
 * @param scale - Phaser.Scale.ScaleManager игры
 */
export function getSafeArea(scale: Phaser.Scale.ScaleManager): SafeAreaInsets {
  const css = readCssInsets();

  // Масштаб отображения: сколько реальных (CSS) пикселей приходится
  // на один логический пиксель игры. При центрировании по бокам могут
  // быть «чёрные полосы» (letterbox), поэтому inset делим на displayScale.
  const displayScale = scale.displayScale.x || scale.displayScale.y || 1;

  return {
    top: css.top / displayScale,
    right: css.right / displayScale,
    bottom: css.bottom / displayScale,
    left: css.left / displayScale,
  };
}

/**
 * Возвращает прямоугольник игровой площади, исключая безопасную зону.
 * Удобно использовать как границы для раскладки UI.
 */
export function getSafeBounds(
  scale: Phaser.Scale.ScaleManager,
  minPadding = 24,
): Phaser.Geom.Rectangle {
  const insets = getSafeArea(scale);
  const width = scale.width;
  const height = scale.height;

  const left = Math.max(insets.left, minPadding);
  const right = Math.max(insets.right, minPadding);
  const top = Math.max(insets.top, minPadding);
  const bottom = Math.max(insets.bottom, minPadding);

  return new Phaser.Geom.Rectangle(
    left,
    top,
    width - left - right,
    height - top - bottom,
  );
}
