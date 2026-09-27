import type { Season, LevelConfig, Category, Basket, FallingItem } from './types';

/**
 * Сезон «Лето».
 *
 * Уровни 1–5: фон — пляж и море.
 *   Корзины: Жёлтая (Песок) и Синяя (Вода).
 *   Падают: жёлтые ракушки и синие морские звёзды.
 *
 * Уровни 6–10: заготовка (будет наполнена позже).
 *
 * Картинки пока не подключены — указывайте их через image.path / background.path
 * и регистрируйте текстуры в PreloadScene. Пока рисуются цветные заглушки.
 */

/** Категории лета: песок и вода. */
const CAT_SAND = 'sand';
const CAT_WATER = 'water';

const summerCategories: Category[] = [
  { id: CAT_SAND, color: 0xffd93d, labelKey: 'season.summer.cat.sand' },
  { id: CAT_WATER, color: 0x3d7ad9, labelKey: 'season.summer.cat.water' },
];

/** Две корзины: жёлтая (песок) и синяя (вода). */
const summerBaskets: Basket[] = [
  {
    categoryId: CAT_SAND,
    color: 0xffd93d,
    labelKey: 'season.summer.cat.sand',
    // image: { path: 'assets/images/summer/basket-sand.png' },
  },
  {
    categoryId: CAT_WATER,
    color: 0x3d7ad9,
    labelKey: 'season.summer.cat.water',
    // image: { path: 'assets/images/summer/basket-water.png' },
  },
];

/** Объекты лета: жёлтые ракушки (песок) и синие морские звёзды (вода). */
const summerItemDefs: FallingItem[] = [
  {
    categoryId: CAT_SAND,
    color: 0xffd93d,
    // image: { path: 'assets/images/summer/shell-yellow.png' },
  },
  {
    categoryId: CAT_WATER,
    color: 0x3d7ad9,
    // image: { path: 'assets/images/summer/star-blue.png' },
  },
];

/** Фон пляжа/моря (пока — цвета-заглушки). */
const beachBackground = {
  color: 0x4fc3f7, // небесно-голубой
  // path: 'assets/images/summer/background-beach.png',
};

/** Базовый уровень лета с прогрессией сложности. */
function makeSummerLevel(
  number: number,
  overrides: Partial<LevelConfig> = {},
): LevelConfig {
  // Прогрессия: чем выше уровень, тем больше целей, чаще и быстрее падают.
  const target = 6 + number; // ур.1 -> 7, ур.5 -> 11
  const interval = Math.max(1200 - number * 90, 600);
  const speed = 90 + number * 18;

  return {
    number,
    background: { ...beachBackground },
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
