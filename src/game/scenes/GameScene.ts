import Phaser from 'phaser';
import { COLORS, FONTS } from '../theme';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import { Progress } from '../progress';

const TOTAL_TARGETS = 3;

interface GameSceneData {
  level?: number;
}

/**
 * GameScene — демонстрационная игровая сцена.
 * Механика: перетащить фигуры в цель. Раскладка учитывает safe area.
 */
export class GameScene extends Phaser.Scene {
  private level = 1;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.level = data.level ?? 1;
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 24);
    this.score = 0;

    // Кнопка «назад» — в левом верхнем углу безопасной зоны.
    createButton(this, bounds.x + 50, bounds.y + 50, {
      width: 90,
      height: 72,
      color: COLORS.danger,
      label: '←',
      onClick: () => this.scene.start('LevelSelectScene'),
    });

    // Заголовок уровня и счёт.
    this.add
      .text(bounds.centerX, bounds.y, `Уровень ${this.level}`, {
        fontFamily: FONTS.main,
        fontSize: '44px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.scoreText = this.add
      .text(bounds.right, bounds.y, `0 / ${TOTAL_TARGETS}`, {
        fontFamily: FONTS.main,
        fontSize: '44px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);

    // Перетаскиваемые фигуры — колонка слева (внутри safe area).
    const colors = [COLORS.primary, COLORS.secondary, COLORS.accent];
    const leftX = bounds.x + bounds.width * 0.15;
    colors.forEach((color, i) => {
      this.createDraggableCircle(
        leftX,
        bounds.y + bounds.height * 0.35 + i * (bounds.height * 0.22),
        color,
      );
    });

    // Цель — справа.
    const target = this.add.circle(
      bounds.x + bounds.width * 0.8,
      bounds.centerY,
      Math.min(bounds.height * 0.22, 140),
      0xffffff,
      0.25,
    );
    target.setStrokeStyle(6, 0xffffff, 0.8);
    target.setName('target');
  }

  private createDraggableCircle(x: number, y: number, color: number): void {
    const radius = Math.min(this.scale.height * 0.09, 64);
    const circle = this.add.circle(x, y, radius, color);
    circle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(circle);

    circle.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      circle.x = dragX;
      circle.y = dragY;
    });

    circle.on('dragend', () => {
      const target = this.children.getByName('target') as
        | Phaser.GameObjects.Arc
        | null;
      if (!target) return;

      const dist = Phaser.Math.Distance.Between(
        circle.x,
        circle.y,
        target.x,
        target.y,
      );

      if (dist < target.radius) {
        this.onCorrectDrop(circle);
      } else {
        this.returnCircle(circle, x, y);
      }
    });
  }

  /** Если фигуру уронили не туда — плавно возвращаем её на место. */
  private returnCircle(
    circle: Phaser.GameObjects.Arc,
    homeX: number,
    homeY: number,
  ): void {
    this.tweens.add({
      targets: circle,
      x: homeX,
      y: homeY,
      duration: 220,
      ease: 'Back.out',
    });
  }

  private onCorrectDrop(circle: Phaser.GameObjects.Arc): void {
    // Отключаем повторное перетаскивание и ввод.
    this.input.setDraggable(circle, false);
    circle.disableInteractive();

    this.score += 1;
    this.scoreText.setText(`${this.score} / ${TOTAL_TARGETS}`);

    this.tweens.add({
      targets: circle,
      scale: 1.3,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        this.tweens.add({
          targets: circle,
          alpha: 0,
          scale: 0,
          duration: 250,
          onComplete: () => circle.destroy(),
        });
      },
    });

    if (this.score >= TOTAL_TARGETS) {
      this.finishLevel();
    }
  }

  /** Уровень пройден: сохраняем прогресс и показываем результат. */
  private finishLevel(): void {
    const stars = 3; // упрощённо; позже — по числу ошибок/времени
    Progress.setResult(this.level, stars);

    const bounds = getSafeBounds(this.scale, 24);

    const panel = this.add
      .rectangle(bounds.centerX, bounds.centerY, 520, 240, 0x000000, 0.6)
      .setStrokeStyle(4, 0xffffff, 0.8);

    const text = this.add
      .text(bounds.centerX, bounds.centerY - 40, 'Молодец! ★★★', {
        fontFamily: FONTS.main,
        fontSize: '56px',
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const next = createButton(this, bounds.centerX, bounds.centerY + 60, {
      width: 280,
      height: 80,
      color: COLORS.secondary,
      label: 'Дальше',
      onClick: () => this.scene.start('LevelSelectScene'),
    });

    panel.setDepth(10);
    text.setDepth(11);
    next.setDepth(11);
  }
}
