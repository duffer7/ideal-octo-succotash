import type { Season, LevelConfig, Category, Basket, FallingItem, AssetRef } from './types';
import { SEASON_COLORS, SEASON_BG_COLORS } from '../palette';

/**
 * Сезон «Лето».
 *
 * Уровни 1–5: фон — пляж и море.
 *   Корзины: Жёлтая (Песок) и Синяя (Вода).
 *   Падают: жёлтые ракушки и синие морские звёзды.
 *
 * Уровни 6–10: заготовка (будет наполнена позже).
 *
 * Картинки падающих объектов (ракушек) подключены через image.path и
 * загружаются в PreloadScene из summerAssets.
 *
 * Цвета берутся из палитры (palette.ts), а не задаются hex-литералами.
 */

/** Категории лета: песок и вода. */
const CAT_SAND = 'sand';
const CAT_WATER = 'water';

const summerCategories: Category[] = [
  { id: CAT_SAND, color: SEASON_COLORS.summer.sand, labelKey: 'season.summer.cat.sand' },
  { id: CAT_WATER, color: SEASON_COLORS.summer.water, labelKey: 'season.summer.cat.water' },
];

/** Картинка корзины-приёмника (общая для обеих категорий). */
const basketImage = {
  key: 'basket',
  path: 'assets/images/levels/basket.png',
};

/** Картинки падающих объектов: жёлтая (песок) и синяя (вода) ракушки. */
const clamSandImage = {
  key: 'clam1',
  path: 'assets/images/levels/clam1.png',
};
const clamWaterImage = {
  key: 'clam2',
  path: 'assets/images/levels/clam2.png',
};

/** Две корзины: жёлтая (песок) и синяя (вода). */
const summerBaskets: Basket[] = [
  {
    categoryId: CAT_SAND,
    color: SEASON_COLORS.summer.sand,
    labelKey: 'season.summer.cat.sand',
    image: { ...basketImage },
    labelImage: { ...clamSandImage },
  },
  {
    categoryId: CAT_WATER,
    color: SEASON_COLORS.summer.water,
    labelKey: 'season.summer.cat.water',
    image: { ...basketImage },
    labelImage: { ...clamWaterImage },
  },
];

/** Объекты лета: жёлтые ракушки (песок) и синие морские звёзды (вода). */
const summerItemDefs: FallingItem[] = [
  {
    categoryId: CAT_SAND,
    color: SEASON_COLORS.summer.sand,
    image: { ...clamSandImage },
  },
  {
    categoryId: CAT_WATER,
    color: SEASON_COLORS.summer.water,
    image: { ...clamWaterImage },
  },
];

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
  { key: clamSandImage.key, path: clamSandImage.path },
  { key: clamWaterImage.key, path: clamWaterImage.path },
];

/** Базовый уровень лета с прогрессией сложности. */
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

  return {
    number,
    background: { ...beachBackground },
    clouds: { ...beachClouds },
    categories: summerCategories,
    baskets: summerBaskets,
    spawnWeights: { [CAT_SAND]: 0.5, [CAT_WATER]: 0.5 },
    targetCount: target,
    spawnIntervalMs: interval,
    fallSpeed: speed,
    ...overrides,
  };
}

/** Уровни 1–5: пляж, песок и вода. */
const beachLevels: LevelConfig[] = [1, 2, 3, 4, 5].map((n) =>
  makeSummerLevel(n),
);

/** Уровни 6–10: заготовки (пока те же правила, позже заменим). */
const placeholderLevels: LevelConfig[] = [6, 7, 8, 9, 10].map((n) =>
  makeSummerLevel(n),
);

export const summer: Season = {
  id: 'summer',
  nameKey: 'season.summer.name',
  levelCount: 10,
  levels: [...beachLevels, ...placeholderLevels],
};

/** Падающие объекты сезона «Лето» (для GameScene). */
export const summerItems: FallingItem[] = [...summerItemDefs];

