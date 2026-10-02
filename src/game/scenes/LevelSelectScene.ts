import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI, UI_CSS, PALETTE, WORLD_COLORS } from '../palette';
import { buildGrid, fontForCell, type GridCell } from '../layout';
import { createButton } from '../ui/Button';
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

    // Заголовок сезона.
    withStroke(
      this.add
        .text(width / 2, 36, t(season.nameKey), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '60px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0),
    );

    // Подзаголовок.
    withStroke(
      this.add
        .text(width / 2, 104, t('levelSelect.title'), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '30px',
          color: UI_CSS.onSurfaceMuted,
        })
        .setOrigin(0.5, 0),
    );

    // Кнопка «назад».
    createButton(this, 100, 52, {
      width: 120,
      height: 64,
      color: COLORS.danger,
      label: t('common.back'),
      icon: 'arrow-back',
      onClick: () => this.scene.start('MenuScene'),
    });

    createButton(this, width - 130, 52, {
      width: 200,
      height: 64,
      color: COLORS.secondary,
      label: t('levelSelect.album'),
      fontSize: 28,
      onClick: () => this.scene.start('AlbumScene'),
    });

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
    const seasonColors = [COLORS.accent, COLORS.primary];

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
      const g = this.add.graphics();
      g.fillStyle(WORLD_COLORS[id], open ? 1 : 0.45);
      g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
      g.lineStyle(open ? 5 : 3, open ? PALETTE.white : UI.disabled, 0.95);
      g.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);

      const label = this.add
        .text(0, 0, open ? t(WORLD_NAME[id]) : t('levelSelect.soon'), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '26px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      withStroke(label, undefined, 5);

      const card = this.add.container(x, y, [g, label]);
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
      color: done ? COLORS.secondary : COLORS.accent,
      label: done
        ? t('levelSelect.dailyDone')
        : t('levelSelect.daily', { n: Daily.target }),
      fontSize: 24,
      onClick: () => this.scene.start('GameScene', { mode: 'daily' }),
    });
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
    const radius = size * 0.22;

    const bg = this.add.graphics();
    const cardColor = unlocked ? color : UI.disabled;
    bg.fillStyle(cardColor, unlocked ? 1 : 0.6);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, radius);

    // Номер уровня / замок для закрытых.
    const num = this.add
      .text(0, unlocked ? -size * 0.08 : 0, unlocked ? String(level) : '', {
        fontFamily: getMainFont(getLanguage()),
        fontSize: `${fontForCell({ ...cell, width: size, height: size }, 0.45)}px`,
        color: UI_CSS.onSurface,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    withStroke(num);

    const children: Phaser.GameObjects.GameObject[] = [bg, num];

    // Иконка замка для закрытых уровней.
    if (!unlocked) {
      // Коэф размера иконки замка
      const coeff = 0.7;
      const lock = this.add
        .image(0, 0, 'lock')
        .setDisplaySize(size * coeff, size * coeff);
      children.push(lock);
    }

    // Звёзды под номером.
    if (unlocked && stars > 0) {
      const starLabel =
        '★'.repeat(stars) + '☆'.repeat(3 - stars) + (superStar ? ' ✦' : '');
      const starText = this.add
        .text(0, size * 0.28, starLabel, {
          fontFamily: getMainFont(getLanguage()),
          fontSize: `${size * 0.16}px`,
          color: UI_CSS.reward,
        })
        .setOrigin(0.5);
      withStroke(starText);
      children.push(starText);
    }

    const container = this.add.container(cell.x, cell.y, children);
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
