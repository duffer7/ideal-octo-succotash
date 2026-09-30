import type { Season, LevelConfig, Basket, FallingItem, AssetRef } from './types';
import { SEASON_COLORS, SEASON_BG_COLORS } from '../palette';

/**
 * Сезон «Лето».
 *
 * Уровни 1–5: фон — пляж и море.
 *   Корзины: Жёлтая (Песок) и Синяя (Вода).
 *   Падают: жёлтые ракушки и синие морские звёзды.
 *   С 3-го уровня появляются камни и новая ракушка (clam3).
 *
 * Уровни 6–10: добавляется мусорная корзина и мусор (бутылка, банка).
 *   С 7-го уровня появляется ещё одна ракушка (special-clam).
 *
 * Картинки падающих объектов подключены через image.path и загружаются в
 * PreloadScene из summerAssets.
 *
 * Цвета берутся из палитры (palette.ts), а не задаются hex-литералами.
 */

/** С какого уровня появляется мусор и его корзина. */
const TRASH_FROM_LEVEL = 6;

/** Картинка корзины-приёмника (общая для всех категорий). */
const basketImage = {
  key: 'basket',
  path: 'assets/images/levels/basket.png',
};

/** Картинка мусорной корзины (контейнер, куда скидывают мусор). */
const trashBinImage = {
  key: 'trash-bin',
  path: 'assets/images/levels/trash-bin.png',
};

/** Картинки падающих объектов: ракушки (песок/вода), камни и мусор. */
const clamSandImage = {
  key: 'clam1',
  path: 'assets/images/levels/clam1.png',
};
const clamWaterImage = {
  key: 'clam2',
  path: 'assets/images/levels/clam2.png',
};
/** Морская звезда — появляется с 7-го уровня. */
const starImage = {
  key: 'star',
  path: 'assets/images/levels/star.png',
};
/** Новая ракушка — появляется с 3-го уровня. */
const clamSandImage2 = {
  key: 'clam3',
  path: 'assets/images/levels/clam3.png',
};
/** Ещё одна ракушка — появляется с 7-го уровня. */
const specialClamImage = {
  key: 'special-clam',
  path: 'assets/images/levels/special-clam.png',
};

/** Камни (песок) — появляются с 3-го уровня. */
const rockImages = [1, 2, 3, 4].map((n) => ({
  key: `rock${n}`,
  path: `assets/images/levels/rock${n}.png`,
}));

/** Мусор (бутылка, банка) — появляется с 6-го уровня. */
const trashImages = [
  { key: 'bottle', path: 'assets/images/levels/bottle.png' },
  { key: 'can', path: 'assets/images/levels/can.png' },
];

/**
 * Объекты лета. У каждого предмета — СВОЯ корзина, поэтому id предмета
 * совпадает с itemId его корзины.
 *
 * Ниже описаны предметы вместе с их корзинами; `fromLevel` задаёт, с какого
 * уровня предмет начинает падать.
 */
interface SummerEntity {
  /** Идентификатор предмета (совпадает с Basket.itemId). */
  id: string;
  /** Ключ локализации названия корзины. */
  labelKey: Basket['labelKey'];
  /** Цвет-заглушка. */
  color: number;
  /** Картинка падающего объекта. */
  image: AssetRef;
  /** Картинка корзины (опционально). */
  basketImage?: AssetRef;
  /**
   * Доп. картинки того же предмета (например, разные камни): при появлении
   * выбирается случайная из полного набора [image, ...altImages].
   */
  altImages?: AssetRef[];
  /** Вес появления (чем больше — тем чаще падает). */
  weight?: number;
  /** С какого уровня предмет доступен. */
  fromLevel?: number;
}

/** Рак ушка-песок (базовая). */
const entities: SummerEntity[] = [
  {
    id: 'clam1',
    labelKey: 'season.summer.cat.sand',
    color: SEASON_COLORS.summer.sand,
    image: { ...clamSandImage },
    basketImage: { ...basketImage },
  },
  {
    id: 'clam3',
    labelKey: 'season.summer.cat.sand',
    color: SEASON_COLORS.summer.sand,
    image: { ...clamSandImage2 },
    basketImage: { ...basketImage },
    fromLevel: 3,
  },
  {
    id: 'special-clam',
    labelKey: 'season.summer.cat.sand',
    color: SEASON_COLORS.summer.sand,
    image: { ...specialClamImage },
    basketImage: { ...basketImage },
    fromLevel: 7,
  },
  {
    id: 'rock',
    labelKey: 'season.summer.cat.sand',
    color: SEASON_COLORS.summer.sand,
    image: { ...rockImages[0] },
    basketImage: { ...basketImage },
    altImages: rockImages.slice(1).map((img) => ({ ...img })),
    fromLevel: 3,
  },
  {
    id: 'clam2',
    labelKey: 'season.summer.cat.water',
    color: SEASON_COLORS.summer.water,
    image: { ...clamWaterImage },
    basketImage: { ...basketImage },
  },
  {
    id: 'star',
    labelKey: 'season.summer.cat.water',
    color: SEASON_COLORS.summer.water,
    image: { ...starImage },
    basketImage: { ...basketImage },
    fromLevel: 7,
  },
  {
    id: 'bottle',
    labelKey: 'season.summer.cat.trash',
    color: SEASON_COLORS.summer.trash,
    image: { ...trashImages[0] },
    basketImage: { ...trashBinImage },
    fromLevel: TRASH_FROM_LEVEL,
  },
  {
    id: 'can',
    labelKey: 'season.summer.cat.trash',
    color: SEASON_COLORS.summer.trash,
    image: { ...trashImages[1] },
    basketImage: { ...trashBinImage },
    fromLevel: TRASH_FROM_LEVEL,
  },
];

/** Падающие объекты (id + картинки + вес + порог уровня). */
const summerItemDefs: FallingItem[] = entities.map((e) => {
  const allImages = [e.image, ...(e.altImages ?? [])];
  return {
    id: e.id,
    color: e.color,
    // Одна картинка — через image, несколько — через images (случайный выбор).
    image: allImages.length === 1 ? allImages[0] : undefined,
    images: allImages.length > 1 ? allImages : undefined,
    weight: e.weight,
    fromLevel: e.fromLevel,
  };
});

/** Одна корзина на каждый предмет. */
const summerBasketsAll: Basket[] = entities.map((e) => ({
  itemId: e.id,
  color: e.color,
  labelKey: e.labelKey,
  image: e.basketImage ? { ...e.basketImage } : undefined,
  labelImage: { ...e.image },
}));

/** Фон пляжа/моря. */
const beachBackground = {
  color: SEASON_BG_COLORS.summer, // фолбэк, пока картинка не загружена
  key: 'summer_bg',
  path: 'assets/images/backgrounds/summer_background.jpg',
};

/** Слой облаков поверх фона (отдельная картинка с прозрачностью). */
const beachClouds = {
  key: 'summer_clouds',
  path: 'assets/images/backgrounds/summer_clouds.png',
};

/**
 * Ассеты лета для загрузки в PreloadScene.
 * Держим пути здесь — рядом с уровнями, которые их используют.
 */
export const summerAssets: AssetRef[] = [
  { key: beachBackground.key, path: beachBackground.path },
  { key: beachClouds.key, path: beachClouds.path },
  { key: basketImage.key, path: basketImage.path },
  { key: trashBinImage.key, path: trashBinImage.path },
  { key: clamSandImage.key, path: clamSandImage.path },
  { key: clamWaterImage.key, path: clamWaterImage.path },
  { key: starImage.key, path: starImage.path },
  { key: clamSandImage2.key, path: clamSandImage2.path },
  { key: specialClamImage.key, path: specialClamImage.path },
  ...rockImages.map((img) => ({ key: img.key, path: img.path })),
  ...trashImages.map((img) => ({ key: img.key, path: img.path })),
];

/**
 * Базовый уровень лета с прогрессией сложности.
 *
 * На уровне доступны только предметы (и их корзины) с `fromLevel <= number`.
 * Так новые предметы вводятся постепенно: камни/ракушка — с 3 ур., мусор —
 * с 6 ур. и т.д.
 */
function makeSummerLevel(
  number: number,
  overrides: Partial<LevelConfig> = {},
): LevelConfig {
  // Прогрессия: чем выше уровень, тем больше целей, чаще и быстрее падают.
  // Скорость намеренно небольшая, чтобы у детей было время среагировать;
  // она мягко растёт с уровнем — это и есть прогрессивная сложность.
  const target = 6 + number; // ур.1 -> 7, ур.5 -> 11
  const interval = Math.max(1200 - number * 90, 600);
  const speed = 55 + number * 11; // ур.1 -> 66, ур.10 -> 165

  // Индексы доступных предметов определяют доступные корзины.
  const available = entities
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.fromLevel === undefined || e.fromLevel <= number);

  const baskets = available.map(({ i }) => summerBasketsAll[i]);

  // Относительный вес появления каждого предмета на уровне.
  const totalWeight = available.reduce((s, { e }) => s + (e.weight ?? 1), 0);
  const spawnWeights: Record<string, number> = {};
  for (const { e } of available) {
    spawnWeights[e.id] = (e.weight ?? 1) / totalWeight;
  }

  return {
    number,
    background: { ...beachBackground },
    clouds: { ...beachClouds },
    categories: [],
    baskets,
    spawnWeights,
    targetCount: target,
    spawnIntervalMs: interval,
    fallSpeed: speed,
    ...overrides,
  };
}

/** Уровни 1–5: пляж, песок и вода (с 3 ур. — камни и новая ракушка). */
const beachLevels: LevelConfig[] = [1, 2, 3, 4, 5].map((n) =>
  makeSummerLevel(n),
);

/** Уровни 6–10: добавляется мусорная корзина и мусор; с 7 ур. — ракушка. */
const trashLevels: LevelConfig[] = [6, 7, 8, 9, 10].map((n) =>
  makeSummerLevel(n),
);

export const summer: Season = {
  id: 'summer',
  nameKey: 'season.summer.name',
  levelCount: 10,
  levels: [...beachLevels, ...trashLevels],
};

/** Падающие объекты сезона «Лето» (для GameScene). */
export const summerItems: FallingItem[] = [...summerItemDefs];

