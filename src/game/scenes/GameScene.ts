import Phaser from 'phaser';
import { COLORS, FONTS } from '../theme';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import { Progress } from '../progress';
import { t } from '../i18n';
import {
  ACTIVE_SEASON,
  getLevel,
  getSeason,
  type FallingItem,
  type LevelConfig,
} from '../seasons';
import { summerItems } from '../seasons/summer';

interface GameSceneData {
  level?: number;
}

/** Падающий объект как игровой объект. */
interface FallingObject {
  container: Phaser.GameObjects.Container;
  categoryId: string;
  /** Заблокирован ли объект (уже успешно перетащен). */
  done: boolean;
}

/**
 * GameScene — уровень сортировки.
 * Сверху падают объекты (ракушки/звёзды), игрок перетаскивает их в нужную
 * корзину. Уровень пройден, когда рассортировано targetCount объектов.
 */
export class GameScene extends Phaser.Scene {
  private level = 1;
  private config!: LevelConfig;
  private sorted = 0;
  private mistakes = 0;

  private scoreText!: Phaser.GameObjects.Text;

  private items: FallingObject[] = [];
  private baskets = new Map<string, { x: number; y: number; radius: number }>();
  private spawnTimer?: Phaser.Time.TimerEvent;
  private bounds!: Phaser.Geom.Rectangle;

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.level = data.level ?? 1;
  }

  create(): void {
    this.config = getLevel(ACTIVE_SEASON, this.level);
    this.bounds = getSafeBounds(this.scale, 24);
    this.sorted = 0;
    this.mistakes = 0;
    this.items = [];
    this.baskets.clear();

    this.createBackground();
    this.createBackButton();
    this.createHud();
    this.createBaskets();

    // Запускаем спавн объектов.
    this.spawnTimer = this.time.addEvent({
      delay: this.config.spawnIntervalMs,
      callback: () => this.spawnItem(),
      loop: true,
    });

    // Небольшая задержка перед первым объектом.
    this.time.delayedCall(600, () => this.spawnItem());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.spawnTimer?.remove();
    });
  }

  // ---------------------------------------------------------------------------
  // Визуальные элементы
  // ---------------------------------------------------------------------------

  /** Фон пляжа/моря (картинка, если загружена, иначе цвет-заглушка). */
  private createBackground(): void {
    const { width, height } = this.scale;
    const bg = this.config.background;

    if (bg.key && this.textures.exists(bg.key)) {
      this.add.image(width / 2, height / 2, bg.key).setDisplaySize(width, height);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, bg.color);
      // Условная «полоса моря» снизу для атмосферы пляжа.
      this.add.rectangle(
        width / 2,
        height * 0.78,
        width,
        height * 0.44,
        COLORS.background,
        0.45,
      );
    }

    // Отдельный слой облаков поверх фона (если картинка облаков загружена).
    const clouds = this.config.clouds;
    if (clouds?.key && this.textures.exists(clouds.key)) {
      this.createClouds(width, height * 0.3);
    }
  }

  /**
   * Кладёт слой облаков поверх фона и заставляет их медленно плыть вбок,
   * заворачиваясь при выходе за край экрана (бесшовный дрейф).
   */
  private createClouds(width: number, cloudsHeight: number): void {
    // Рисуем облака чуть шире экрана, чтобы дрейф был незаметно бесшовным.
    const overlap = width * 0.1;
    const cloudImage = this.add
      .image(0, 0, this.config.clouds!.key!)
      .setOrigin(0, 0)
      .setDisplaySize(width + overlap, cloudsHeight);

    // Плавный дрейф вправо — туда-обратно, без рывков на краях.
    this.tweens.add({
      targets: cloudImage,
      x: -overlap,
      duration: 24000,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Лёгкое вертикальное покачивание, чтобы облака «дышали».
    this.tweens.add({
      targets: cloudImage,
      y: cloudsHeight * 0.03,
      duration: 6000,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private createBackButton(): void {
    createButton(this, this.bounds.x + 50, this.bounds.y + 50, {
      width: 90,
      height: 72,
      color: COLORS.danger,
      label: t('common.back'),
      onClick: () => this.scene.start('LevelSelectScene'),
    });
  }

  private createHud(): void {
    const season = getSeason(ACTIVE_SEASON);
    const centerX = this.bounds.centerX;

    this.add
      .text(centerX, this.bounds.y, t('game.level', { n: this.level }), {
        fontFamily: FONTS.main,
        fontSize: '44px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.add
      .text(centerX, this.bounds.y + 50, t(season.nameKey), {
        fontFamily: FONTS.main,
        fontSize: '28px',
        color: '#eaf6ff',
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.scoreText = this.add
      .text(
        this.bounds.right,
        this.bounds.y,
        `${this.sorted} / ${this.config.targetCount}`,
        {
          fontFamily: FONTS.main,
          fontSize: '44px',
          color: '#ffffff',
          fontStyle: 'bold',
        },
      )
      .setOrigin(1, 0)
      .setDepth(20);
  }

  /** Две корзины-приёмника внизу экрана. */
  private createBaskets(): void {
    const { baskets } = this.config;
    const gap = 60;
    const basketSize = Math.min(this.bounds.height * 0.32, 220);
    const totalW = basketSize * baskets.length + gap * (baskets.length - 1);
    const startX = this.bounds.centerX - totalW / 2 + basketSize / 2;
    const y = this.bounds.bottom - basketSize * 0.55;

    baskets.forEach((basket, i) => {
      const x = startX + i * (basketSize + gap);
      this.createBasket(x, y, basketSize, basket);
    });
  }

  private createBasket(
    x: number,
    y: number,
    size: number,
    basket: LevelConfig['baskets'][number],
  ): void {
    const children: Phaser.GameObjects.GameObject[] = [];

    if (basket.image?.key && this.textures.exists(basket.image.key)) {
      const img = this.add.image(0, 0, basket.image.key);
      img.setDisplaySize(size, size);
      children.push(img);
    } else {
      // Заглушка-корзина: скруглённый «ящик» с цветом категории.
      const g = this.add.graphics();
      g.fillStyle(basket.color, 1);
      g.fillRoundedRect(-size / 2, -size / 2, size, size, size * 0.16);
      g.lineStyle(6, 0xffffff, 0.9);
      g.strokeRoundedRect(-size / 2, -size / 2, size, size, size * 0.16);
      children.push(g);
    }

    // Подпись корзины (Песок / Вода).
    const label = this.add
      .text(0, size * 0.34, t(basket.labelKey), {
        fontFamily: FONTS.main,
        fontSize: `${size * 0.16}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    children.push(label);

    this.add.container(x, y, children).setDepth(5);

    this.baskets.set(basket.categoryId, {
      x,
      y,
      radius: size / 2,
    });
  }

  // ---------------------------------------------------------------------------
  // Падающие объекты
  // ---------------------------------------------------------------------------

  /** Создаёт падающий объект сверху и запускает его движение вниз. */
  private spawnItem(): void {
    const def = this.pickItemDef();
    const x = Phaser.Math.Between(
      Math.round(this.bounds.x + 60),
      Math.round(this.bounds.right - 60),
    );

    const container = this.createItemVisual(x, this.bounds.y + 40, def);
    const record: FallingObject = { container, categoryId: def.categoryId, done: false };
    this.items.push(record);

    this.input.setDraggable(container);

    // Падение как tween; при достижении низа — промах.
    const fallTargetY = this.bounds.bottom - 20;
    const distance = fallTargetY - container.y;
    const duration = (distance / this.config.fallSpeed) * 1000;

    container.setData('fallTween', null);
    const tween = this.tweens.add({
      targets: container,
      y: fallTargetY,
      duration,
      onComplete: () => this.onMissed(record),
    });
    container.setData('fallTween', tween);

    container.on(
      'drag',
      (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (record.done) return;
        // Останавливаем падение, пока объект тащат.
        (container.getData('fallTween') as Phaser.Tweens.Tween | null)?.pause();
        container.x = dragX;
        container.y = dragY;
      },
    );

    container.on('dragend', () => this.onDrop(record));
  }

  /** Рисует визуал объекта (картинка или цветная заглушка). */
  private createItemVisual(
    x: number,
    y: number,
    def: FallingItem,
  ): Phaser.GameObjects.Container {
    const size = Math.min(this.bounds.height * 0.16, 110);
    let visual: Phaser.GameObjects.GameObject;

    if (def.image?.key && this.textures.exists(def.image.key)) {
      const img = this.add.image(0, 0, def.image.key);
      img.setDisplaySize(size, size);
      visual = img;
    } else {
      // Заглушка: круг с контуром в цвете категории.
      const c = this.add.circle(0, 0, size / 2, def.color);
      c.setStrokeStyle(6, 0xffffff, 0.85);
      visual = c;
    }

    const container = this.add.container(x, y, [visual]).setDepth(10);
    container.setSize(size, size);
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, size, size),
      Phaser.Geom.Rectangle.Contains,
    );
    container.input!.cursor = 'pointer';
    return container;
  }

  /** Выбирает определение объекта по весам категорий. */
  private pickItemDef(): FallingItem {
    const defs = summerItems;
    const weights = this.config.spawnWeights;

    if (!weights || defs.length === 0) {
      // Равномерный выбор среди категорий уровня.
      const cat = Phaser.Utils.Array.GetRandom(this.config.categories);
      return {
        categoryId: cat.id,
        color: cat.color,
      };
    }

    const ids = Object.keys(weights);
    const total = ids.reduce((s, id) => s + (weights[id] ?? 0), 0);
    let r = Math.random() * total;
    let chosen = ids[0];
    for (const id of ids) {
      r -= weights[id] ?? 0;
      if (r <= 0) {
        chosen = id;
        break;
      }
    }

    const match = defs.find((d) => d.categoryId === chosen);
    if (match) return match;

    const cat = this.config.categories.find((c) => c.id === chosen);
    return { categoryId: chosen, color: cat?.color ?? 0xffffff };
  }

  // ---------------------------------------------------------------------------
  // Обработка перетаскивания
  // ---------------------------------------------------------------------------

  private onDrop(record: FallingObject): void {
    if (record.done) return;
    const { container } = record;

    // Ищем корзину, в которую попал объект.
    let hitCategory: string | null = null;
    for (const [categoryId, basket] of this.baskets) {
      const dist = Phaser.Math.Distance.Between(
        container.x,
        container.y,
        basket.x,
        basket.y,
      );
      if (dist < basket.radius) {
        hitCategory = categoryId;
        break;
      }
    }

    if (hitCategory === null) {
      // Не попали ни в одну корзину — продолжаем падение.
      this.resumeFall(record);
      return;
    }

    if (hitCategory === record.categoryId) {
      this.onCorrect(record);
    } else {
      this.onWrong(record);
    }
  }

  /** Продолжает падение объекта с текущей высоты. */
  private resumeFall(record: FallingObject): void {
    const { container } = record;
    const tween = container.getData('fallTween') as Phaser.Tweens.Tween | null;
    if (tween) {
      // Пересоздаём tween от текущей позиции до низа.
      tween.remove();
      const fallTargetY = this.bounds.bottom - 20;
      const distance = fallTargetY - container.y;
      if (distance <= 0) {
        this.onMissed(record);
        return;
      }
      const duration = (distance / this.config.fallSpeed) * 1000;
      const newTween = this.tweens.add({
        targets: container,
        y: fallTargetY,
        duration,
        onComplete: () => this.onMissed(record),
      });
      container.setData('fallTween', newTween);
    }
  }

  private onCorrect(record: FallingObject): void {
    record.done = true;
    this.input.setDraggable(record.container, false);
    record.container.disableInteractive();

    (record.container.getData('fallTween') as Phaser.Tweens.Tween | null)?.remove();

    this.sorted += 1;
    this.updateHud();

    this.tweens.add({
      targets: record.container,
      scale: 0.2,
      alpha: 0,
      duration: 220,
      onComplete: () => record.container.destroy(),
    });

    if (this.sorted >= this.config.targetCount) {
      this.finishLevel();
    }
  }

  private onWrong(record: FallingObject): void {
    this.mistakes += 1;
    this.updateHud();

    this.cameras.main.flash(200, 255, 80, 80);

    // Возвращаем объект наверх и продолжаем падение.
    const { container } = record;
    (container.getData('fallTween') as Phaser.Tweens.Tween | null)?.remove();
    const startY = this.bounds.y + 40;
    this.tweens.add({
      targets: container,
      y: startY,
      duration: 300,
      ease: 'Back.out',
      onComplete: () => this.resumeFall(record),
    });
  }

  /** Объект упал за пределы корзин — мягко возвращаем наверх. */
  private onMissed(record: FallingObject): void {
    if (record.done) return;
    const { container } = record;
    const startY = this.bounds.y + 40;
    this.tweens.add({
      targets: container,
      y: startY,
      duration: 250,
      ease: 'Quad.in',
      onComplete: () => this.resumeFall(record),
    });
  }

  private updateHud(): void {
    this.scoreText.setText(`${this.sorted} / ${this.config.targetCount}`);
  }

  // ---------------------------------------------------------------------------
  // Завершение уровня
  // ---------------------------------------------------------------------------

  /** Уровень пройден: сохраняем прогресс и показываем результат. */
  private finishLevel(): void {
    this.spawnTimer?.remove();
    this.time.removeAllEvents();

    // Звёзды: 3 без ошибок, 2 при 1–2 ошибках, 1 при большем числе.
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    Progress.setResult(this.level, stars, ACTIVE_SEASON);

    const { centerX, centerY } = this.bounds;

    this.add
      .rectangle(centerX, centerY, 560, 260, 0x000000, 0.6)
      .setStrokeStyle(4, 0xffffff, 0.8)
      .setDepth(30);

    this.add
      .text(centerX, centerY - 60, t('game.wellDone'), {
        fontFamily: FONTS.main,
        fontSize: '56px',
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(31);

    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add
      .text(centerX, centerY + 10, starStr, {
        fontFamily: FONTS.main,
        fontSize: '56px',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setDepth(31);

    const season = getSeason(ACTIVE_SEASON);
    const isLast = this.level >= season.levelCount;
    const nextLabel = isLast ? t('common.back') : t('game.next');

    const next = createButton(this, centerX, centerY + 90, {
      width: 300,
      height: 80,
      color: COLORS.secondary,
      label: nextLabel,
      onClick: () => this.scene.start('LevelSelectScene'),
    });
    next.setDepth(31);
  }
}
