import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI, UI_CSS, PALETTE, WORLD_COLORS } from '../palette';
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
import { t, getLanguage, type TranslationKey } from '../i18n';
import { ACTIVE_SEASON, SEASON_ORDER, getSeason, type SeasonId } from '../seasons';
import { playClickSound } from '../audio';
import { Daily } from '../daily';

const WORLD_NAME: Record<SeasonId, TranslationKey> = {
  summer: 'season.summer.name',
  autumn: 'season.autumn.name',
  winter: 'season.winter.name',
  spring: 'season.spring.name',
};

/**
 * LevelSelectScene — выбор уровня в горизонтальной сетке.
 * Показывает уровни активного сезона (сейчас — «Лето», 10 уровней).
 * Карточки адаптивно располагаются под размер/безопасную зону экрана.
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
      onClick: () => this.scene.start('MenuScene'),
    }).setDepth(3);

    createButton(this, width - 130, 52, {
      width: 200,
      height: 64,
      color: COLORS.primary,
      label: t('levelSelect.album'),
      fontSize: 26,
      onClick: () => this.scene.start('AlbumScene'),
    }).setDepth(3);

    this.createWorlds(width);
    this.createDaily(width);

    // Адаптивная сетка: 10 уровней — 5 колонок × 2 строки.
    const cells = buildGrid(this, LEVEL_COUNT, {
      maxColumns: 5,
      maxRows: 2,
      padding: 36,
      gap: 16,
      // Шапка: заголовок, миры и ежедневное задание.
      topOffset: 280,
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

  /** Четыре сезона-мира. Открыто пока только лето. */
  private createWorlds(width: number): void {
    const gap = 14;
    const count = SEASON_ORDER.length;
    const cardW = Math.min(220, (width - 80 - gap * (count - 1)) / count);
    const cardH = 62;
    const total = count * cardW + (count - 1) * gap;
    const startX = width / 2 - total / 2 + cardW / 2;
    const y = 168;

    SEASON_ORDER.forEach((id, i) => {
      const open = id === 'summer';
      const x = startX + i * (cardW + gap);
      const plate = glossyPlate(
        this,
        cardW,
        cardH,
        open ? WORLD_COLORS[id] : UI.disabled,
        'pill',
      );
      plate.setAlpha(open ? 1 : 0.7);

      const label = this.add
        .text(0, -1, open ? t(WORLD_NAME[id]) : t('levelSelect.soon'), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '24px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      withStroke(label, undefined, 4);

      const card = this.add.container(x, y, [plate, label]);
      card.setDepth(2);
      card.setSize(cardW, cardH);
      card.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, cardW, cardH),
        Phaser.Geom.Rectangle.Contains,
      );
      card.input!.cursor = 'pointer';
      card.on('pointerdown', () => {
        playClickSound(this);
        if (open) {
          this.tweens.add({
            targets: card,
            scale: 0.94,
            duration: 80,
            yoyo: true,
          });
          return;
        }
        this.tweens.add({
          targets: card,
          angle: { from: -4, to: 4 },
          duration: 70,
          yoyo: true,
          repeat: 2,
          onComplete: () => card.setAngle(0),
        });
      });
    });
  }

  /** Кнопка ежедневного задания. */
  private createDaily(width: number): void {
    const done = Daily.isDone();
    createButton(this, width / 2, 236, {
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
