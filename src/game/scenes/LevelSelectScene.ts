import Phaser from 'phaser';
import { COLORS, getMainFont } from '../theme';
import { buildGrid, fontForCell, type GridCell } from '../layout';
import { createButton } from '../ui/Button';
import { Progress } from '../progress';
import { t, getLanguage } from '../i18n';
import { ACTIVE_SEASON, getSeason } from '../seasons';

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
    this.add
      .text(width / 2, 36, t(season.nameKey), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '60px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    // Подзаголовок.
    this.add
      .text(width / 2, 104, t('levelSelect.title'), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '30px',
        color: '#eaf6ff',
      })
      .setOrigin(0.5, 0);

    // Кнопка «назад».
    createButton(this, 100, 60, {
      width: 140,
      height: 72,
      color: COLORS.danger,
      label: t('common.back'),
      onClick: () => this.scene.start('MenuScene'),
    });

    // Адаптивная сетка: 10 уровней — 5 колонок × 2 строки.
    const cells = buildGrid(this, LEVEL_COUNT, {
      maxColumns: 5,
      maxRows: 2,
      padding: 40,
      gap: 20,
    });

    const unlocked = Progress.getUnlocked(ACTIVE_SEASON);
    const seasonColors = [COLORS.accent, COLORS.primary];

    cells.forEach((cell, i) => {
      const level = i + 1;
      const isUnlocked = level <= unlocked;
      const stars = Progress.getStars(level, ACTIVE_SEASON);
      const color = seasonColors[(level - 1) % seasonColors.length];
      this.createLevelCard(cell, level, isUnlocked, stars, color);
    });
  }

  private createLevelCard(
    cell: GridCell,
    level: number,
    unlocked: boolean,
    stars: number,
    color: number,
  ): void {
    const size = Math.min(cell.width, cell.height);
    const radius = size * 0.22;

    const bg = this.add.graphics();
    const cardColor = unlocked ? color : 0x8a8a8a;
    bg.fillStyle(cardColor, unlocked ? 1 : 0.6);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, radius);

    // Номер уровня.
    const num = this.add
      .text(0, unlocked ? -size * 0.08 : 0, unlocked ? String(level) : '🔒', {
        fontFamily: getMainFont(getLanguage()),
        fontSize: `${fontForCell({ ...cell, width: size, height: size }, 0.45)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [bg, num];

    // Звёзды под номером.
    if (unlocked && stars > 0) {
      const starText = this.add
        .text(0, size * 0.25, '★'.repeat(stars) + '☆'.repeat(3 - stars), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: `${size * 0.16}px`,
          color: '#ffe066',
        })
        .setOrigin(0.5);
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
