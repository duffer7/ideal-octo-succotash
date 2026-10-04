import Phaser from 'phaser';
import { getMainFont, withStroke } from '../theme';
import { UI_CSS } from '../palette';
import { getLanguage } from '../i18n';
import { playClickSound } from '../audio';
import { createGlyph, glossyPlate, type Glyph } from './gloss';

export interface ButtonOptions {
  /** Ширина контейнера. */
  width: number;
  /** Высота контейнера. */
  height: number;
  /** Цвет фона. */
  color: number;
  /** Текст на кнопке. */
  label: string;
  /**
   * Ключ текстуры-иконки. Если задан и текстура загружена — вместо текста
   * рисуется картинка по центру кнопки (например, стрелка «назад»).
   */
  icon?: string;
  /** Векторная пиктограмма поверх глянцевой кнопки. */
  glyph?: Glyph;
  /** Размер шрифта (по умолчанию — от высоты кнопки). */
  fontSize?: number;
  /** Колбэк по нажатию. */
  onClick: () => void;
}

/**
 * Крупная глянцевая кнопка: широкая — пилюля, почти квадратная — значок.
 * Возвращает Phaser-контейнер, который можно позиционировать где угодно.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: ButtonOptions,
): Phaser.GameObjects.Container {
  const { width: w, height: h, color, label, onClick } = options;
  const fontSize = options.fontSize ?? Math.min(h * 0.38, 48);
  const shape = w / h < 1.45 ? 'badge' : 'pill';

  const bg = glossyPlate(scene, w, h, color, shape);

  const useIcon = !!options.icon && scene.textures.exists(options.icon);
  let content: Phaser.GameObjects.GameObject;

  if (options.glyph) {
    content = createGlyph(scene, options.glyph, Math.min(w, h) * 0.72);
  } else if (useIcon) {
    content = scene.add
      .image(0, -2, options.icon!)
      .setDisplaySize(h * 0.5, h * 0.5);
  } else {
    content = scene.add
      .text(0, -2, label.toLocaleUpperCase(), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: `${fontSize}px`,
        color: UI_CSS.onSurface,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    withStroke(
      content as Phaser.GameObjects.Text,
      undefined,
      Math.max(4, fontSize * 0.14),
    );
  }

  const container = scene.add.container(x, y, [bg, content]);
  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, w, h),
    Phaser.Geom.Rectangle.Contains,
  );
  if (scene.input.manager.canvas) {
    container.input!.cursor = 'pointer';
  }

  container.on('pointerdown', () => {
    playClickSound(scene);
    scene.tweens.add({
      targets: container,
      scale: 0.94,
      duration: 80,
      yoyo: true,
      onComplete: onClick,
    });
  });

  return container;
}
