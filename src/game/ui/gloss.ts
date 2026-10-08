import Phaser from 'phaser';
import { PALETTE, SKY_GRADIENT, toCss } from '../palette';
import type { BonusStarRank } from '../scoring';
import { getMainFont, withStroke } from '../theme';
import { getLanguage } from '../i18n';

/**
 * Глянцевые элементы в духе мультяшного мобильного UI:
 * пилюли с бликом, ленты, полосатый прогресс, звёзды, шестерёнка.
 * Рисуются на canvas один раз и кэшируются как текстуры Phaser.
 */

export type GlossShape = 'pill' | 'badge' | 'panel';
export type Glyph = 'left' | 'right' | 'check' | 'cross' | 'replay';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function mix(color: number, target: number, t: number): number {
  const channel = (c: number, dst: number) => Math.round(c + (dst - c) * t);
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const tr = (target >> 16) & 255;
  const tg = (target >> 8) & 255;
  const tb = target & 255;
  return (channel(r, tr) << 16) | (channel(g, tg) << 8) | channel(b, tb);
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function shapeRadius(shape: GlossShape, w: number, h: number): number {
  if (shape === 'pill') return Math.min(w, h) / 2;
  if (shape === 'badge') return Math.min(w, h) * 0.28;
  return Math.min(28, Math.min(w, h) * 0.1);
}

/**
 * Глянцевая пластина. Возвращается картинка, чей визуальный центр
 * совпадает с телом кнопки (тень выступает вниз и не сдвигает хитбокс).
 */
export function glossyPlate(
  scene: Phaser.Scene,
  w: number,
  h: number,
  color: number,
  shape: GlossShape = 'pill',
): Phaser.GameObjects.Image {
  const width = Math.max(8, Math.round(w));
  const height = Math.max(8, Math.round(h));
  const pad = 12;
  const bodyX = 4;
  const bodyY = 2;
  const tw = width + pad;
  const th = height + pad;
  const key = `ui-gloss-${shape}-${color}-${width}x${height}`;

  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, tw, th);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      const radius = shapeRadius(shape, width, height);
      const light = hex(mix(color, 0xffffff, shape === 'panel' ? 0.22 : 0.42));
      const mid = hex(color);
      const dark = hex(mix(color, 0x2a1848, 0.38));

      ctx.clearRect(0, 0, tw, th);

      ctx.save();
      ctx.shadowColor = 'rgba(48, 24, 84, 0.28)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 5;
      traceRoundRect(ctx, bodyX, bodyY, width, height, radius);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.restore();

      ctx.save();
      traceRoundRect(ctx, bodyX, bodyY, width, height, radius);
      ctx.clip();
      const grad = ctx.createLinearGradient(0, bodyY, 0, bodyY + height);
      grad.addColorStop(0, light);
      grad.addColorStop(0.42, mid);
      grad.addColorStop(1, dark);
      ctx.fillStyle = grad;
      ctx.fillRect(bodyX, bodyY, width, height);

      ctx.fillStyle =
        shape === 'panel' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(
        bodyX + width / 2,
        bodyY + height * 0.3,
        width * 0.36,
        height * 0.2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();

      ctx.save();
      traceRoundRect(ctx, bodyX, bodyY, width, height, radius);
      ctx.lineWidth = Math.max(3, Math.min(width, height) * (shape === 'panel' ? 0.035 : 0.055));
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.stroke();
      ctx.restore();

      tex.refresh();
    }
  }

  const image = scene.add.image(0, 0, key);
  image.setOrigin((bodyX + width / 2) / tw, (bodyY + height / 2) / th);
  return image;
}

/** Вертикальное небо приложения: #239acf → #4fc3f7 → #e1f5fe. */
export function paintSkyGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, toCss(SKY_GRADIENT.top));
  sky.addColorStop(0.5, toCss(SKY_GRADIENT.mid));
  sky.addColorStop(1, toCss(SKY_GRADIENT.bottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

/** Небо с мягкими облаками — фон меню и экранов выбора. */
export function addCartoonSky(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const width = Math.max(2, Math.round(scene.scale.width));
  const height = Math.max(2, Math.round(scene.scale.height));
  const key = `ui-sky-${width}x${height}`;

  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, width, height);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      paintSkyGradient(ctx, width, height);

      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      const clouds: Array<[number, number, number, number]> = [
        [width * 0.18, height * 0.16, 90, 36],
        [width * 0.72, height * 0.12, 120, 42],
        [width * 0.46, height * 0.22, 70, 28],
      ];
      for (const [x, y, rx, ry] of clouds) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + rx * 0.45, y + 6, rx * 0.55, ry * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      tex.refresh();
    }
  }

  return scene.add.image(width / 2, height / 2, key).setDepth(-20);
}

function paintStripes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const stripe = 16;
  for (let x = -h; x < w + h; x += stripe) {
    const band = Math.round(x / stripe);
    ctx.fillStyle = band % 2 === 0 ? hex(PALETTE.violet) : hex(PALETTE.pink);
    ctx.beginPath();
    ctx.moveTo(x, h + 2);
    ctx.lineTo(x + h, -2);
    ctx.lineTo(x + h + stripe, -2);
    ctx.lineTo(x + stripe, h + 2);
    ctx.closePath();
    ctx.fill();
  }
  const gloss = ctx.createLinearGradient(0, 0, 0, h);
  gloss.addColorStop(0, 'rgba(255,255,255,0.45)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  gloss.addColorStop(1, 'rgba(80, 20, 120, 0.12)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, w, h);
}

let stripeSeq = 0;

export interface StripedBar {
  setValue: (value: number) => void;
  setDepth: (depth: number) => void;
}

/** Горизонтальная полоска с диагональными фиолетово-розовыми полосами. */
export function createStripedBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  initial = 0,
): StripedBar {
  const width = Math.max(24, Math.round(w));
  const height = Math.max(16, Math.round(h));
  const innerW = Math.max(8, width - 14);
  const innerH = Math.max(8, height - 12);

  const track = glossyPlate(scene, width, height, PALETTE.offWhite, 'pill');
  track.setPosition(x, y);

  const key = `ui-stripes-${++stripeSeq}`;
  const tex = scene.textures.createCanvas(key, innerW, innerH);
  const ctx = tex?.getContext();
  if (tex && ctx) {
    paintStripes(ctx, innerW, innerH);
    tex.refresh();
  }

  const fill = scene.add.image(x, y, key);
  const maskG = scene.make.graphics({ x: 0, y: 0 }, false);
  fill.setMask(maskG.createGeometryMask());

  const apply = (value: number): void => {
    const amount = Phaser.Math.Clamp(value, 0, 1);
    maskG.clear();
    if (amount <= 0.02) return;
    const fw = Math.max(innerH, innerW * amount);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRoundedRect(
      x - innerW / 2,
      y - innerH / 2,
      Math.min(fw, innerW),
      innerH,
      innerH / 2,
    );
  };

  apply(initial);

  return {
    setValue: apply,
    setDepth: (depth: number) => {
      track.setDepth(depth);
      fill.setDepth(depth + 1);
    },
  };
}

export interface Ribbon {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
}

/** Жёлтая лента-баннер с ласточкиным хвостом по краям. */
export function createRibbon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize = 40,
): Ribbon {
  const upper = text.toLocaleUpperCase();
  const width = Math.round(
    Math.min(820, Math.max(300, upper.length * fontSize * 0.66 + 120)),
  );
  const height = Math.round(Math.max(64, fontSize * 1.7));
  const key = `ui-ribbon-${width}x${height}`;

  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, width, height);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      const tail = Math.min(28, width * 0.06);
      const midY = height / 2;
      ctx.beginPath();
      ctx.moveTo(tail, 4);
      ctx.lineTo(width - tail, 4);
      ctx.lineTo(width - 4, midY);
      ctx.lineTo(width - tail, height - 6);
      ctx.lineTo(tail, height - 6);
      ctx.lineTo(4, midY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#fff1a8');
      grad.addColorStop(0.45, hex(PALETTE.yellow));
      grad.addColorStop(1, '#f0a202');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
      tex.refresh();
    }
  }

  const plate = scene.add.image(0, 0, key);
  const label = scene.add
    .text(0, -2, upper, {
      fontFamily: getMainFont(getLanguage()),
      fontSize: `${fontSize}px`,
      color: toCss(PALETTE.deepPurple),
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  withStroke(label, '#fff8e0', Math.max(4, fontSize * 0.12));
  if (label.width > width - 100) {
    label.setFontSize(fontSize * ((width - 100) / label.width));
  }

  const container = scene.add.container(x, y, [plate, label]);
  return { container, label };
}

/** Подгоняет подпись ленты под новый текст (смена языка). */
export function fitRibbonLabel(
  label: Phaser.GameObjects.Text,
  text: string,
  fontSize: number,
  maxWidth: number,
): void {
  label.setFontSize(fontSize);
  label.setText(text.toLocaleUpperCase());
  if (label.width > maxWidth) {
    label.setFontSize(fontSize * (maxWidth / label.width));
  }
}

const STAR_SCORE = 'star-score';
const STAR_SCORE_EMPTY = 'star-score-inactive';
const BONUS_STAR: Record<BonusStarRank, string> = {
  basic: 'star-score-basic',
  rare: 'star-score-rare',
  epic: 'star-score-epic',
};

/** Цветная звезда за скорость: зелёная, синяя или фиолетовая. */
export function createBonusStar(
  scene: Phaser.Scene,
  rank: BonusStarRank,
  size: number,
): Phaser.GameObjects.Image {
  const star = scene.add.image(0, 0, BONUS_STAR[rank]);
  star.setDisplaySize(size, size * (star.height / star.width));
  return star;
}

/** Одна звезда счёта: золотая, если заработана, иначе пустая. */
export function createScoreStar(
  scene: Phaser.Scene,
  filled: boolean,
  size: number,
): Phaser.GameObjects.Image {
  const star = scene.add.image(0, 0, filled ? STAR_SCORE : STAR_SCORE_EMPTY);
  star.setDisplaySize(size, size * (star.height / star.width));
  return star;
}

/** Ряд звёзд счёта. `filled` — сколько из них заработано. */
export function createStars(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
  filled: number,
  size: number,
): Phaser.GameObjects.Container {
  const gap = size * 1.15;
  const start = -gap * (count - 1) * 0.5;
  const stars: Phaser.GameObjects.Image[] = [];

  for (let i = 0; i < count; i++) {
    const star = createScoreStar(scene, i < filled, size);
    star.setPosition(start + i * gap, 0);
    stars.push(star);
  }

  return scene.add.container(x, y, stars);
}

const LOCK = 'lock';

/** Замок для закрытых уровней, сезонов и открыток. */
export function createLockIcon(
  scene: Phaser.Scene,
  size: number,
): Phaser.GameObjects.Image {
  const lock = scene.add.image(0, 0, LOCK);
  lock.setDisplaySize(size, size);
  return lock;
}

/** Шестерёнка в шапке экрана настроек. */
export function createGear(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
): Phaser.GameObjects.Container {
  const teeth: Phaser.GameObjects.Rectangle[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const tooth = scene.add
      .rectangle(
        Math.cos(angle) * radius * 0.78,
        Math.sin(angle) * radius * 0.78,
        radius * 0.52,
        radius * 0.32,
        PALETTE.gold,
      )
      .setRotation(angle);
    teeth.push(tooth);
  }
  const body = scene.add.circle(0, 0, radius * 0.58, PALETTE.gold);
  const hole = scene.add.circle(0, 0, radius * 0.24, PALETTE.panel);
  return scene.add.container(x, y, [...teeth, body, hole]);
}

/** Белая пиктограмма поверх цветной кнопки. */
export function createGlyph(
  scene: Phaser.Scene,
  kind: Glyph,
  size: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const stroke = Math.max(5, size * 0.11);
  g.lineStyle(stroke, 0xffffff, 1);
  g.fillStyle(0xffffff, 1);

  if (kind === 'left' || kind === 'right') {
    const tip = kind === 'left' ? -1 : 1;
    g.beginPath();
    g.moveTo(-tip * size * 0.1, -size * 0.22);
    g.lineTo(tip * size * 0.2, 0);
    g.lineTo(-tip * size * 0.1, size * 0.22);
    g.strokePath();
  } else if (kind === 'check') {
    g.beginPath();
    g.moveTo(-size * 0.24, size * 0.02);
    g.lineTo(-size * 0.06, size * 0.2);
    g.lineTo(size * 0.28, -size * 0.18);
    g.strokePath();
  } else if (kind === 'cross') {
    const a = size * 0.2;
    g.beginPath();
    g.moveTo(-a, -a);
    g.lineTo(a, a);
    g.moveTo(a, -a);
    g.lineTo(-a, a);
    g.strokePath();
  } else {
    g.beginPath();
    g.arc(0, 0, size * 0.26, 0.5, Math.PI * 1.85, false);
    g.strokePath();
    g.fillTriangle(
      size * 0.12,
      -size * 0.28,
      size * 0.34,
      -size * 0.08,
      size * 0.08,
      -size * 0.02,
    );
  }

  return g;
}
