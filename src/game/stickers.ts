/**
 * Открытки альбома. Одна на уровень лета.
 * Пока файла нет — рисуется простая фигура. Когда картинка загружена, она заменяет фигуру.
 */
import Phaser from 'phaser';
import type { TranslationKey } from './i18n';
import { PALETTE, UI } from './palette';
import { Progress } from './progress';
import { ACTIVE_SEASON } from './seasons';
import { createLockIcon } from './ui/gloss';

export type StickerGlyph =
  | 'shell'
  | 'star'
  | 'pebble'
  | 'wave'
  | 'sun'
  | 'bucket'
  | 'crab'
  | 'bird'
  | 'palm'
  | 'castle';

export interface StickerDef {
  /** Уровень, после которого открытка попадает в альбом (1-based). */
  level: number;
  nameKey: TranslationKey;
  /** Ключ текстуры. Файл можно положить позже — игра не сломается. */
  imageKey: string;
  glyph: StickerGlyph;
  color: number;
}

export const SUMMER_STICKERS: StickerDef[] = [
  { level: 1, nameKey: 'sticker.shell', imageKey: 'sticker-shell', glyph: 'shell', color: PALETTE.sand },
  { level: 2, nameKey: 'sticker.star', imageKey: 'sticker-star', glyph: 'star', color: PALETTE.sea },
  { level: 3, nameKey: 'sticker.pebble', imageKey: 'sticker-pebble', glyph: 'pebble', color: PALETTE.rock },
  { level: 4, nameKey: 'sticker.wave', imageKey: 'sticker-wave', glyph: 'wave', color: PALETTE.skyBlue },
  { level: 5, nameKey: 'sticker.sun', imageKey: 'sticker-sun', glyph: 'sun', color: PALETTE.gold },
  { level: 6, nameKey: 'sticker.bucket', imageKey: 'sticker-bucket', glyph: 'bucket', color: PALETTE.orange },
  { level: 7, nameKey: 'sticker.crab', imageKey: 'sticker-crab', glyph: 'crab', color: PALETTE.red },
  { level: 8, nameKey: 'sticker.bird', imageKey: 'sticker-bird', glyph: 'bird', color: PALETTE.offWhite },
  { level: 9, nameKey: 'sticker.palm', imageKey: 'sticker-palm', glyph: 'palm', color: PALETTE.green },
  { level: 10, nameKey: 'sticker.castle', imageKey: 'sticker-castle', glyph: 'castle', color: PALETTE.sand },
];

/** Пути картинок открыток — для предзагрузки. Пока файлов нет, рисуются заглушки. */
export const STICKER_ASSETS: { key: string; path: string }[] = SUMMER_STICKERS.map(
  (s) => ({
    key: s.imageKey,
    path: `assets/images/stickers/${s.imageKey}.png`,
  }),
);

export function stickerForLevel(level: number): StickerDef | undefined {
  return SUMMER_STICKERS.find((s) => s.level === level);
}

export function isStickerUnlocked(level: number): boolean {
  return Progress.getStars(level, ACTIVE_SEASON) > 0;
}

/** Рисует открытку: картинку, если она загружена, иначе простую фигуру. */
export function createStickerIcon(
  scene: Phaser.Scene,
  sticker: StickerDef,
  size: number,
  locked = false,
): Phaser.GameObjects.Container {
  const children: Phaser.GameObjects.GameObject[] = [];
  const plate = scene.add.graphics();
  plate.fillStyle(locked ? UI.disabled : PALETTE.white, locked ? 0.35 : 1);
  plate.fillRoundedRect(-size / 2, -size / 2, size, size, size * 0.18);
  plate.lineStyle(Math.max(3, size * 0.04), locked ? UI.disabled : UI.stroke, 0.95);
  plate.strokeRoundedRect(-size / 2, -size / 2, size, size, size * 0.18);
  children.push(plate);

  if (!locked && scene.textures.exists(sticker.imageKey)) {
    const img = scene.add.image(0, 0, sticker.imageKey);
    img.setDisplaySize(size * 0.78, size * 0.78);
    children.push(img);
  } else if (locked && scene.textures.exists('lock')) {
    children.push(createLockIcon(scene, size * 0.62));
  } else {
    children.push(drawGlyph(scene, sticker, size * 0.62, locked));
  }

  return scene.add.container(0, 0, children);
}

function drawGlyph(
  scene: Phaser.Scene,
  sticker: StickerDef,
  size: number,
  locked: boolean,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const color = locked ? UI.onSurface : sticker.color;
  const alpha = locked ? 0.35 : 1;
  g.fillStyle(color, alpha);
  g.lineStyle(Math.max(2, size * 0.06), locked ? UI.onSurface : PALETTE.deepPurple, locked ? 0.25 : 0.9);

  const r = size / 2;
  switch (sticker.glyph) {
    case 'shell':
      g.fillEllipse(0, 4, size * 0.85, size * 0.7);
      g.strokeEllipse(0, 4, size * 0.85, size * 0.7);
      break;
    case 'star':
      fillStar(g, 0, 0, r, r * 0.45);
      break;
    case 'pebble':
      g.fillEllipse(0, 2, size * 0.7, size * 0.55);
      g.strokeEllipse(0, 2, size * 0.7, size * 0.55);
      break;
    case 'wave':
      g.lineStyle(Math.max(4, size * 0.1), color, alpha);
      g.beginPath();
      g.arc(-r * 0.45, 0, r * 0.45, Math.PI, 0, true);
      g.strokePath();
      g.beginPath();
      g.arc(r * 0.45, 0, r * 0.45, Math.PI, 0, true);
      g.strokePath();
      break;
    case 'sun':
      g.fillCircle(0, 0, r * 0.45);
      g.strokeCircle(0, 0, r * 0.45);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.lineBetween(
          Math.cos(a) * r * 0.6,
          Math.sin(a) * r * 0.6,
          Math.cos(a) * r,
          Math.sin(a) * r,
        );
      }
      break;
    case 'bucket':
      g.fillRoundedRect(-r * 0.55, -r * 0.2, size * 0.55, size * 0.55, 6);
      g.strokeRoundedRect(-r * 0.55, -r * 0.2, size * 0.55, size * 0.55, 6);
      g.strokeCircle(0, -r * 0.35, r * 0.38);
      break;
    case 'crab':
      g.fillEllipse(0, 4, size * 0.55, size * 0.4);
      g.fillCircle(-r * 0.55, 0, r * 0.22);
      g.fillCircle(r * 0.55, 0, r * 0.22);
      break;
    case 'bird':
      g.fillEllipse(-4, 4, size * 0.7, size * 0.4);
      g.fillTriangle(r * 0.2, 0, r * 0.85, -r * 0.15, r * 0.2, r * 0.25);
      break;
    case 'palm':
      g.fillRect(-r * 0.08, -r * 0.1, size * 0.12, size * 0.55);
      g.fillCircle(-r * 0.35, -r * 0.25, r * 0.28);
      g.fillCircle(r * 0.35, -r * 0.25, r * 0.28);
      g.fillCircle(0, -r * 0.5, r * 0.28);
      break;
    case 'castle':
      g.fillRect(-r * 0.7, -r * 0.15, size * 0.7, size * 0.5);
      g.fillRect(-r * 0.7, -r * 0.55, size * 0.18, size * 0.4);
      g.fillRect(-r * 0.09, -r * 0.55, size * 0.18, size * 0.4);
      g.fillRect(r * 0.52, -r * 0.55, size * 0.18, size * 0.4);
      break;
  }
  return g;
}

function fillStar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
  g.strokePath();
}
