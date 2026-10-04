import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI, UI_CSS, PALETTE } from '../palette';
import { buildGrid, fontForCell, type GridCell } from '../layout';
import { createButton } from '../ui/Button';
import {
  addCartoonSky,
  createLockIcon,
  createRibbon,
  createStars,
  glossyPlate,
} from '../ui/gloss';
import { Progress } from '../progress';
import { t, getLanguage } from '../i18n';
import { ACTIVE_SEASON, getSeason } from '../seasons';
import { playClickSound } from '../audio';
import { Daily } from '../daily';

/**
 * LevelSelectScene — выбор уровня.
 * Показывает уровни активного сезона.
 */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create(): void {
    const { width } = this.scale;
    const season = getSeason(ACTIVE_SEASON);
    const LEVEL_COUNT = season.levelCount;
    addCartoonSky(this);

    createRibbon(this, width / 2, 58, t(season.nameKey), 42).container.setDepth(2);

    withStroke(
      this.add
        .text(width / 2, 108, t('levelSelect.title'), {
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

    // Кнопка «назад».
    createButton(this, 100, 52, {
      width: 88,
      height: 72,
      color: COLORS.danger,
      label: t('common.back'),
      glyph: 'left',
      onClick: () => this.scene.start('SeasonSelectScene'),
    }).setDepth(3);

    createButton(this, width - 130, 52, {
      width: 200,
      height: 64,
      color: COLORS.primary,
      label: t('levelSelect.album'),
      fontSize: 26,
      onClick: () => this.scene.start('AlbumScene'),
    }).setDepth(3);

    this.createDaily(width);

    // Адаптивная сетка: 10 уровней — 5 колонок × 2 строки.
    const cells = buildGrid(this, LEVEL_COUNT, {
      maxColumns: 5,
      maxRows: 2,
      padding: 36,
      gap: 16,
      // Шапка: заголовок и ежедневное задание.
      topOffset: 230,
    });

    const unlocked = Progress.getUnlocked(ACTIVE_SEASON);
    const seasonColors = [
      COLORS.play,
      COLORS.primary,
      COLORS.options,
      COLORS.confirm,
      PALETTE.pink,
    ];

    cells.forEach((cell, i) => {
      const level = i + 1;
      const isUnlocked = level <= unlocked;
      const stars = Progress.getStars(level, ACTIVE_SEASON);
      const superStar = Progress.getSuper(level, ACTIVE_SEASON);
      const color = seasonColors[(level - 1) % seasonColors.length];
      this.createLevelCard(cell, level, isUnlocked, stars, superStar, color);
    });
  }

  /** Кнопка ежедневного задания. */
  private createDaily(width: number): void {
    const done = Daily.isDone();
    createButton(this, width / 2, 190, {
      width: Math.min(520, width * 0.46),
      height: 58,
      color: done ? COLORS.confirm : COLORS.accent,
      label: done
        ? t('levelSelect.dailyDone')
        : t('levelSelect.daily', { n: Daily.target }),
      fontSize: 22,
      onClick: () => this.scene.start('GameScene', { mode: 'daily' }),
    }).setDepth(3);
  }

  private createLevelCard(
    cell: GridCell,
    level: number,
    unlocked: boolean,
    stars: number,
    superStar: boolean,
    color: number,
  ): void {
    const size = Math.min(cell.width, cell.height);
    const bg = glossyPlate(
      this,
      size,
      size,
      unlocked ? color : UI.disabled,
      'badge',
    );
    if (!unlocked) bg.setAlpha(0.75);

    const num = this.add
      .text(0, unlocked ? size * 0.08 : 0, unlocked ? String(level) : '', {
        fontFamily: getMainFont(getLanguage()),
        fontSize: `${fontForCell({ ...cell, width: size, height: size }, 0.42)}px`,
        color: UI_CSS.onSurface,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    withStroke(num, undefined, 5);

    const children: Phaser.GameObjects.GameObject[] = [bg, num];

    if (!unlocked) {
      children.push(createLockIcon(this, size * 0.46));
    } else {
      children.push(createStars(this, 0, -size * 0.28, 3, stars, size * 0.16));
      if (superStar) {
        children.push(createStars(this, size * 0.32, -size * 0.32, 1, 1, size * 0.18));
      }
    }

    const container = this.add.container(cell.x, cell.y, children);
    container.setDepth(2);
    container.setSize(size, size);

    if (unlocked) {
      container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, size, size),
        Phaser.Geom.Rectangle.Contains,
      );
      container.input!.cursor = 'pointer';
      container.on('pointerdown', () => {
        playClickSound(this);
        this.tweens.add({
          targets: container,
          scale: 0.92,
          duration: 80,
          yoyo: true,
          onComplete: () => {
            this.scene.start('GameScene', { level });
          },
        });
      });
    } else {
      // Лёгкое «покачивание», чтобы показать недоступность.
      this.tweens.add({
        targets: container,
        angle: { from: -3, to: 3 },
        duration: 120,
        yoyo: true,
        repeat: 2,
        onComplete: () => container.setAngle(0),
      });
    }
  }
}
