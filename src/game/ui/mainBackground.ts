import Phaser from 'phaser';
import { assetUrl } from '../assets';
import { getLanguage, type Language } from '../i18n';
import { getSafeBounds } from '../safeArea';

/**
 * Слои стартового неба из public/assets/images/backgrounds/main.
 * Нижний слой — картинка градиента. На загрузке виден только он.
 * `main-background-without-stuff.png` — плоская склейка неба, облаков и звёзд.
 * На экран кладём отдельные слои, чтобы каждый мог двигаться.
 */
const DIR = 'assets/images/backgrounds/main';

export const MAIN_GRADIENT = {
  key: 'main-bg-gradient',
  path: `${DIR}/main-background-only-gradient.png`,
} as const;

export const MAIN_CLOUDS = {
  key: 'main-bg-clouds',
  path: `${DIR}/main-background-only-clouds.png`,
} as const;

export const MAIN_BACKGROUND_ASSETS = [
  MAIN_GRADIENT,
  MAIN_CLOUDS,
  { key: 'main-bg-stars', path: `${DIR}/main-background-only-stars.png` },
  { key: 'main-bg-stuff', path: `${DIR}/main-background-only-stuff.png` },
  { key: 'main-logo-en', path: `${DIR}/main-logo-en.png` },
  { key: 'main-logo-ru', path: `${DIR}/main-logo-ru.png` },
] as const;

const DEPTH = {
  gradient: -40,
  stars: -30,
  clouds: -20,
  stuff: -10,
  logo: 1,
} as const;

export interface MainBackgroundOptions {
  /** Лента-логотип текущего языка. Только стартовый экран. */
  logo?: boolean;
  /**
   * Первое появление главного экрана: облака и сокровища выезжают с краёв,
   * звёзды зажигаются на месте.
   */
  cloudsFromEdges?: boolean;
  /** Градиент, облака и звёзды уже живут в SkyScene и здесь не рисуются. */
  skipSky?: boolean;
}

export interface MainBackground {
  setLanguage(lang: Language): void;
  /** Облака встали на место. Если анимации нет — вызывается сразу. */
  onCloudsReady(callback: () => void): void;
}

type BobTarget = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

let cloudEntrancePlayed = false;

/** Выезд облаков только один раз — когда игра впервые открывает главный экран. */
export function openingCloudEntrance(): boolean {
  if (cloudEntrancePlayed) return false;
  cloudEntrancePlayed = true;
  return true;
}

/** Кладёт файлы фона в очередь загрузчика. */
export function queueMainBackground(
  loader: Phaser.Loader.LoaderPlugin,
  options: { gradient?: boolean } = {},
): void {
  for (const asset of MAIN_BACKGROUND_ASSETS) {
    if (!options.gradient && asset.key === MAIN_GRADIENT.key) continue;
    if (loader.scene.textures.exists(asset.key)) continue;
    loader.image(asset.key, assetUrl(asset.path));
  }
}

/** Только картинка градиента на весь экран. Экран загрузки. */
export function showGradientBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Image | undefined {
  const image = addLayer(scene, MAIN_GRADIENT.key, DEPTH.gradient);
  if (!image) return undefined;

  const layout = (): void => {
    placeCover(scene, image);
  };
  layout();
  scene.scale.on(Phaser.Scale.Events.RESIZE, layout);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, layout);
  });
  return image;
}

function logoKey(lang: Language): string {
  return lang === 'ru' ? 'main-logo-ru' : 'main-logo-en';
}

/**
 * Собирает главный фон: градиент, звёзды, облака, сокровища и, по желанию, логотип.
 * Слои слегка покачиваются. Облака можно вывезти с левого и правого края.
 */
export function addMainBackground(
  scene: Phaser.Scene,
  options: MainBackgroundOptions = {},
): MainBackground {
  const gradient = options.skipSky ? undefined : addLayer(scene, MAIN_GRADIENT.key, DEPTH.gradient);
  const stars = options.skipSky ? undefined : addLayer(scene, 'main-bg-stars', DEPTH.stars);
  const reveal = options.cloudsFromEdges === true;
  const stuff = reveal ? undefined : addLayer(scene, 'main-bg-stuff', DEPTH.stuff);

  const clouds = options.skipSky ? undefined : addSplit(scene, 'main-bg-clouds', DEPTH.clouds);
  const stuffHalves = reveal ? addSplit(scene, 'main-bg-stuff', DEPTH.stuff) : undefined;

  const logo = options.logo ? addLayer(scene, logoKey(getLanguage()), DEPTH.logo) : undefined;

  const waiters: Array<() => void> = [];
  let alive = true;
  let cloudsSettled = false;
  let entranceT = reveal ? 0 : 1;
  let starsLit = !reveal;
  let entranceTween: Phaser.Tweens.Tween | undefined;
  let starTween: Phaser.Tweens.Tween | undefined;
  const floatStarted = scene.time.now;
  const floaters: Floater[] = [];

  const trackFloat = (
    target: BobTarget,
    ampX: number,
    ampY: number,
    period: number,
  ): void => {
    const now = scene.time.now - floatStarted;
    const angle = (now / period) * Math.PI * 2;
    const baseX = target.x - Math.sin(angle) * ampX;
    const baseY = target.y - Math.cos(angle) * ampY;
    const existing = floaters.find((item) => item.target === target);
    if (existing) {
      existing.baseX = baseX;
      existing.baseY = baseY;
      return;
    }
    floaters.push({ target, baseX, baseY, ampX, ampY, period });
  };

  const applyFloat = (): void => {
    if (!alive) return;
    const now = scene.time.now - floatStarted;
    for (const item of floaters) {
      if (!item.target.active) continue;
      const angle = (now / item.period) * Math.PI * 2;
      item.target.x = item.baseX + Math.sin(angle) * item.ampX;
      item.target.y = item.baseY + Math.cos(angle) * item.ampY;
    }
  };

  const placeHalves = (halves: SplitLayer | undefined): void => {
    if (!halves) return;
    const viewW = scene.scale.width;
    const viewH = scene.scale.height;
    const bleed = 36;
    const scale = Math.max(
      (viewW + bleed * 2) / halves.left.frame.realWidth,
      (viewH + bleed * 2) / halves.left.frame.realHeight,
    );
    halves.root.setPosition(viewW / 2, viewH / 2);
    halves.left.setScale(scale);
    halves.right.setScale(scale);
    halves.left.x = Phaser.Math.Linear(-viewW / 2, 0, entranceT);
    halves.right.x = Phaser.Math.Linear(viewW / 2, 0, entranceT);
    halves.left.y = 0;
    halves.right.y = 0;
  };

  const placeLogo = (): void => {
    if (!logo || !logo.active) return;
    const bounds = getSafeBounds(scene.scale, 32);
    const aspect = logo.frame.realWidth / logo.frame.realHeight;
    const btnH = Math.min(bounds.height * 0.16, 108);
    const firstButtonY = bounds.centerY + bounds.height * 0.06;
    const limitBottom = firstButtonY - btnH / 2 - 16;
    const top = bounds.y + 4;
    const maxH = Math.max(72, limitBottom - top);
    const maxW = Math.min(bounds.width * 0.7, 820);
    let width = maxW;
    let height = width / aspect;
    if (height > maxH) {
      height = maxH;
      width = height * aspect;
    }
    logo.setDisplaySize(width, height);
    logo.setPosition(bounds.centerX, top + height / 2);
  };

  const layout = (): void => {
    if (!alive) return;
    if (gradient) placeCover(scene, gradient);
    if (stars) placeCover(scene, stars);
    if (stuff) placeCover(scene, stuff);
    placeHalves(clouds);
    placeHalves(stuffHalves);
    placeLogo();
    if (stars && starsLit) trackFloat(stars, 4, 5, 7200);
    if (stuff && entranceT >= 1) trackFloat(stuff, 5, 6, 5800);
    if (stuffHalves && entranceT >= 1) trackFloat(stuffHalves.root, 5, 6, 5800);
    if (clouds && entranceT >= 1) trackFloat(clouds.root, 3, 4, 8400);
    applyFloat();
  };

  const settleClouds = (): void => {
    if (cloudsSettled) return;
    cloudsSettled = true;
    const pending = waiters.splice(0);
    for (const callback of pending) callback();
  };

  if (reveal && stars) stars.setAlpha(0);
  layout();

  if (reveal && stars) {
    starTween = scene.tweens.add({
      targets: stars,
      alpha: 1,
      duration: 1800,
      delay: 350,
      ease: 'Sine.easeOut',
      onComplete: () => {
        starsLit = true;
        if (!alive || !stars.active) return;
        trackFloat(stars, 4, 5, 7200);
      },
    });
  }

  if (reveal && (clouds || stuffHalves)) {
    const ride = { t: 0 };
    entranceTween = scene.tweens.add({
      targets: ride,
      t: 1,
      duration: 1200,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        entranceT = ride.t;
        if (!alive) return;
        const viewW = scene.scale.width;
        const slide = (halves: SplitLayer | undefined): void => {
          if (!halves) return;
          halves.left.x = Phaser.Math.Linear(-viewW / 2, 0, entranceT);
          halves.right.x = Phaser.Math.Linear(viewW / 2, 0, entranceT);
        };
        slide(clouds);
        slide(stuffHalves);
      },
      onComplete: () => {
        entranceT = 1;
        if (!alive) return;
        placeHalves(clouds);
        placeHalves(stuffHalves);
        if (clouds) trackFloat(clouds.root, 3, 4, 8400);
        if (stuffHalves) trackFloat(stuffHalves.root, 5, 6, 5800);
        settleClouds();
      },
    });
  } else {
    settleClouds();
  }

  const onResize = (): void => layout();
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.on(Phaser.Scenes.Events.UPDATE, applyFloat);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    alive = false;
    entranceTween?.stop();
    starTween?.stop();
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    scene.events.off(Phaser.Scenes.Events.UPDATE, applyFloat);
  });

  return {
    setLanguage(lang: Language): void {
      if (!logo || !alive) return;
      const key = logoKey(lang);
      if (!scene.textures.exists(key)) return;
      logo.setTexture(key);
      layout();
    },
    onCloudsReady(callback: () => void): void {
      if (cloudsSettled) callback();
      else waiters.push(callback);
    },
  };
}

interface Floater {
  target: BobTarget;
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  period: number;
}

export interface SplitLayer {
  root: Phaser.GameObjects.Container;
  left: Phaser.GameObjects.Image;
  right: Phaser.GameObjects.Image;
}

/** Делит картинку пополам, чтобы левая и правая части могли выехать с краёв. */
export function addSplit(
  scene: Phaser.Scene,
  key: string,
  depth: number,
): SplitLayer | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const left = scene.add.image(0, 0, key).setOrigin(0.5);
  const right = scene.add.image(0, 0, key).setOrigin(0.5);
  const frameW = left.frame.realWidth;
  const frameH = left.frame.realHeight;
  const half = Math.floor(frameW / 2);
  left.setCrop(0, 0, half, frameH);
  right.setCrop(half, 0, frameW - half, frameH);
  const root = scene.add.container(0, 0, [left, right]).setDepth(depth);
  return { root, left, right };
}

export function placeCover(scene: Phaser.Scene, image: Phaser.GameObjects.Image): void {
  const viewW = scene.scale.width;
  const viewH = scene.scale.height;
  const bleed = 36;
  const scale = Math.max(
    (viewW + bleed * 2) / image.frame.realWidth,
    (viewH + bleed * 2) / image.frame.realHeight,
  );
  image.setScale(scale);
  image.setPosition(viewW / 2, viewH / 2);
}

export function addLayer(
  scene: Phaser.Scene,
  key: string,
  depth: number,
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(key)) return undefined;
  return scene.add.image(0, 0, key).setOrigin(0.5).setDepth(depth);
}
