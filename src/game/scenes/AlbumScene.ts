import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI_CSS, PALETTE } from '../palette';
import { buildGrid, type GridCell } from '../layout';
import { createButton } from '../ui/Button';
import { createRibbon } from '../ui/gloss';
import { t, getLanguage } from '../i18n';
import { Progress } from '../progress';
import type { BonusStarRank } from '../scoring';
import { ACTIVE_SEASON } from '../seasons';
import {
  SUMMER_STICKERS,
  createStickerIcon,
  isStickerUnlocked,
} from '../stickers';
import { playClickSound } from '../audio';

/**
 * Альбом открыток. Карточка открывается, когда уровень пройден хотя бы раз.
 * Цветная звезда отмечает открытку рамкой своего ранга.
 */
export class AlbumScene extends Phaser.Scene {
  constructor() {
    super('AlbumScene');
  }

  create(): void {
    const { width } = this.scale;
    const unlocked = SUMMER_STICKERS.filter((s) => isStickerUnlocked(s.level)).length;

    createRibbon(this, width / 2, 52, t('album.title'), 40).container.setDepth(2);

    withStroke(
      this.add
        .text(width / 2, 100, `${unlocked} / ${SUMMER_STICKERS.length}`, {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '28px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0)
        .setDepth(2),
      undefined,
      5,
    );

    createButton(this, 88, 52, {
      width: 88,
      height: 72,
      color: COLORS.danger,
      label: t('common.back'),
      glyph: 'left',
      onClick: () => this.scene.start('LevelSelectScene'),
    }).setDepth(3);

    const cells = buildGrid(this, SUMMER_STICKERS.length, {
      maxColumns: 5,
      maxRows: 2,
      padding: 36,
      gap: 18,
      topOffset: 150,
    });

    SUMMER_STICKERS.forEach((sticker, i) => {
      const cell = cells[i];
      if (!cell) return;
      const open = isStickerUnlocked(sticker.level);
      const bonus = Progress.getBonus(sticker.level, ACTIVE_SEASON);
      this.createCard(cell, sticker.level, open, bonus);
    });
  }

  private createCard(
    cell: GridCell,
    level: number,
    open: boolean,
    bonus: BonusStarRank | null,
  ): void {
    const sticker = SUMMER_STICKERS[level - 1];
    if (!sticker) return;
    const size = Math.min(cell.width, cell.height) * 0.92;
    const icon = createStickerIcon(this, sticker, size * 0.72, !open);
    icon.setY(open ? -size * 0.08 : 0);

    const children: Phaser.GameObjects.GameObject[] = [icon];

    if (bonus && open) {
      const ring = this.add.graphics();
      const ringColor =
        bonus === 'epic' ? PALETTE.violet : bonus === 'rare' ? PALETTE.blue : PALETTE.green;
      ring.lineStyle(Math.max(4, size * 0.035), ringColor, 1);
      ring.strokeRoundedRect(
        -size * 0.36,
        -size * 0.44,
        size * 0.72,
        size * 0.72,
        size * 0.12,
      );
      children.push(ring);
    }

    if (open) {
      const name = this.add
        .text(0, size * 0.34, t(sticker.nameKey), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: `${Math.max(16, size * 0.12)}px`,
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      withStroke(name, undefined, 5);
      children.push(name);
    }

    const card = this.add.container(cell.x, cell.y, children);
    if (!open) return;

    card.setSize(size, size);
    card.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, size, size),
      Phaser.Geom.Rectangle.Contains,
    );
    card.input!.cursor = 'pointer';
    card.on('pointerdown', () => {
      playClickSound(this);
      this.tweens.add({
        targets: card,
        scale: 1.08,
        duration: 120,
        yoyo: true,
        ease: 'Quad.out',
      });
    });
  }
}
