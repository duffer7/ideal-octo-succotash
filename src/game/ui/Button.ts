import Phaser from 'phaser';
import { getMainFont, withStroke } from '../theme';
import { UI, UI_CSS } from '../palette';
import { getLanguage } from '../i18n';
import { playClickSound } from '../audio';

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
  /** Размер шрифта (по умолчанию — от высоты кнопки). */
  fontSize?: number;
  /** Колбэк по нажатию. */
  onClick: () => void;
}

/**
 * Крупная скруглённая кнопка, удобная для детских пальцев.
 * Возвращает Phaser-контейнер, который можно позиционировать где угодно.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: ButtonOptions,
): Phaser.GameObjects.Container {
  const { width: w, height: h, color, label, onClick } = options;
  const fontSize = options.fontSize ?? Math.min(h * 0.42, 56);

  const bg = scene.add.graphics();
  bg.fillStyle(color, 1);
  bg.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(h / 2, w / 2));
  // Лёгкая «тень» снизу для объёма.
  bg.fillStyle(UI.shadow, 0.15);
  bg.fillRoundedRect(-w / 2, h / 2 - h * 0.18, w, h * 0.18, {
    tl: 0,
    tr: 0,
    bl: Math.min(h / 2, w / 2),
    br: Math.min(h / 2, w / 2),
  });

  // Иконка вместо текста: рисуем картинку по центру кнопки.
  const useIcon = !!options.icon && scene.textures.exists(options.icon);
  let content: Phaser.GameObjects.GameObject;

  if (useIcon) {
    content = scene.add
      .image(0, 0, options.icon!)
      .setDisplaySize(h * 0.55, h * 0.55);
  } else {
    content = scene.add
      .text(0, 0, label, {
        fontFamily: getMainFont(getLanguage()),
        fontSize: `${fontSize}px`,
        color: UI_CSS.onSurface,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    withStroke(content as Phaser.GameObjects.Text);
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


