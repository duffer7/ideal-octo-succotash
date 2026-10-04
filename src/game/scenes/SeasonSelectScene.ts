import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI_CSS, WORLD_COLORS } from '../palette';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import {
  addCartoonSky,
  createLockIcon,
  createRibbon,
  glossyPlate,
} from '../ui/gloss';
import { t, getLanguage, type TranslationKey } from '../i18n';
import { ACTIVE_SEASON, SEASON_ORDER, type SeasonId } from '../seasons';
import { playClickSound } from '../audio';

const WORLD_NAME: Record<SeasonId, TranslationKey> = {
  summer: 'season.summer.name',
  autumn: 'season.autumn.name',
  winter: 'season.winter.name',
  spring: 'season.spring.name',
};

/**
 * SeasonSelectScene — выбор сезона.
 * Открыт текущий сезон (лето). Остальные подписаны своими названиями.
 */
export class SeasonSelectScene extends Phaser.Scene {
  constructor() {
    super('SeasonSelectScene');
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 28);
    addCartoonSky(this);

    createRibbon(
      this,
      bounds.centerX,
      bounds.y + 36,
      t('seasonSelect.title'),
      42,
    ).container.setDepth(2);

    createButton(this, bounds.x + 56, bounds.y + 36, {
      width: 88,
      height: 72,
      color: COLORS.danger,
      label: t('common.back'),
      glyph: 'left',
      onClick: () => this.scene.start('MenuScene'),
    }).setDepth(3);

    this.createSeasons(bounds);
  }

  /** Четыре сезона. Зайти можно только в тот, который уже есть в игре. */
  private createSeasons(bounds: Phaser.Geom.Rectangle): void {
    const gap = 22;
    const count = SEASON_ORDER.length;
    const cardW = Math.min(250, (bounds.width - gap * (count - 1)) / count);
    const cardH = Math.min(340, bounds.height * 0.52);
    const total = count * cardW + (count - 1) * gap;
    const startX = bounds.centerX - total / 2 + cardW / 2;
    const y = bounds.centerY + 24;

    SEASON_ORDER.forEach((id, i) => {
      const open = id === ACTIVE_SEASON;
      const x = startX + i * (cardW + gap);
      const plate = glossyPlate(this, cardW, cardH, WORLD_COLORS[id], 'badge');
      if (!open) plate.setAlpha(0.88);

      const label = this.add
        .text(0, open ? 8 : cardH * 0.16, t(WORLD_NAME[id]), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '36px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      withStroke(label, undefined, 5);

      const children: Phaser.GameObjects.GameObject[] = [plate, label];
      if (!open) {
        const lock = createLockIcon(this, cardW * 0.22);
        lock.setPosition(0, -cardH * 0.12);
        children.push(lock);
      }

      const card = this.add.container(x, y, children);
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
            onComplete: () => this.scene.start('LevelSelectScene'),
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
}
