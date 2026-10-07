import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI_CSS, WORLD_COLORS } from '../palette';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import {
  createLockIcon,
  createRibbon,
  glossyPlate,
} from '../ui/gloss';
import { t, getLanguage, type TranslationKey } from '../i18n';
import { ACTIVE_SEASON, SEASON_ORDER, type SeasonId } from '../seasons';
import { autumnCardImage } from '../seasons/autumn';
import { summerCardImage } from '../seasons/summer';
import { winterCardImage } from '../seasons/winter';
import { springCardImage } from '../seasons/spring';
import { playClickSound } from '../audio';

const CARD_ART: Partial<Record<SeasonId, string>> = {
  summer: summerCardImage.key,
  autumn: autumnCardImage.key,
  winter: winterCardImage.key,
  spring: springCardImage.key,
};

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

  /**
   * Лицо карточки сезона: картинка со скруглёнными углами, как у цветных пластин.
   * Если текстура ещё не загружена — null, и рисуется цветная пластина.
   */
  private seasonCardFace(
    cardW: number,
    cardH: number,
    srcKey: string,
  ): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(srcKey)) return null;

    const width = Math.max(8, Math.round(cardW));
    const height = Math.max(8, Math.round(cardH));
    const lineWidth = Math.max(3, Math.min(width, height) * 0.055);
    // Обводка рисуется по центру контура, поэтому вокруг тела нужен запас,
    // иначе внешняя половина рамки и скругления срезаются краем текстуры.
    const margin = Math.ceil(lineWidth / 2) + 2;
    const tw = width + margin * 2;
    const th = height + margin * 2;
    const key = `${srcKey}-face-v2-${width}x${height}`;

    if (!this.textures.exists(key)) {
      const src = this.textures.get(srcKey).getSourceImage() as CanvasImageSource & {
        width: number;
        height: number;
      };
      const tex = this.textures.createCanvas(key, tw, th);
      const ctx = tex?.getContext();
      if (tex && ctx && src.width > 0 && src.height > 0) {
        const radius = Math.min(width, height) * 0.28;
        const r = Math.max(0, Math.min(radius, width / 2, height / 2));
        const trace = (): void => {
          ctx.beginPath();
          ctx.moveTo(margin + r, margin);
          ctx.arcTo(margin + width, margin, margin + width, margin + height, r);
          ctx.arcTo(margin + width, margin + height, margin, margin + height, r);
          ctx.arcTo(margin, margin + height, margin, margin, r);
          ctx.arcTo(margin, margin, margin + width, margin, r);
          ctx.closePath();
        };

        ctx.clearRect(0, 0, tw, th);
        ctx.save();
        trace();
        ctx.clip();
        const scale = Math.max(width / src.width, height / src.height);
        const dw = src.width * scale;
        const dh = src.height * scale;
        ctx.drawImage(
          src,
          margin + (width - dw) / 2,
          margin + (height - dh) / 2,
          dw,
          dh,
        );
        ctx.restore();

        trace();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.stroke();
        tex.refresh();
      }
    }

    if (!this.textures.exists(key)) return null;
    const image = this.add.image(0, 0, key);
    image.setOrigin((margin + width / 2) / tw, (margin + height / 2) / th);
    return image;
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
      const artKey = CARD_ART[id];
      const art = artKey ? this.seasonCardFace(cardW, cardH, artKey) : null;
      const plate = art ?? glossyPlate(this, cardW, cardH, WORLD_COLORS[id], 'badge');
      if (!open && !art) plate.setAlpha(0.88);

      const label = this.add
        .text(0, art ? cardH * 0.36 : open ? 8 : cardH * 0.16, t(WORLD_NAME[id]), {
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
