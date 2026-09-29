import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI, UI_CSS, PALETTE } from '../palette';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import { Progress } from '../progress';
import { t, getLanguage } from '../i18n';
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
  /** Счётчик неправильных попаданий (промахов) в HUD. */
  private missesText!: Phaser.GameObjects.Text;

  private items: FallingObject[] = [];
  private baskets = new Map<
    string,
    {
      x: number;
      y: number;
      radius: number;
      container: Phaser.GameObjects.Container;
      /** Мягкое свечение вокруг корзины при наведении перетаскиваемой ракушки. */
      highlight: Phaser.GameObjects.Image;
    }
  >();
  private spawnTimer?: Phaser.Time.TimerEvent;
  private bounds!: Phaser.Geom.Rectangle;
  /** Категория корзины, подсвеченной сейчас (null — ничего не подсвечено). */
  private highlightedCategory: string | null = null;

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
    this.highlightedCategory = null;

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
      icon: 'arrow-back',
      onClick: () => this.scene.start('LevelSelectScene'),
    });
  }

  private createHud(): void {
    const season = getSeason(ACTIVE_SEASON);
    const centerX = this.bounds.centerX;

    withStroke(
      this.add
        .text(centerX, this.bounds.y, t('game.level', { n: this.level }), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '44px',

          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0)
        .setDepth(20),
    );

    withStroke(
      this.add
        .text(centerX, this.bounds.y + 50, t(season.nameKey), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '28px',

          color: UI_CSS.onSurfaceMuted,
        })
        .setOrigin(0.5, 0)
        .setDepth(20),
    );

    this.scoreText = this.add
      .text(
        this.bounds.right,
        this.bounds.y,
        `${this.sorted} / ${this.config.targetCount}`,
        {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '44px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        },
      )
      .setOrigin(1, 0)
      .setDepth(20);
    withStroke(this.scoreText);

    // Счётчик неправильных попаданий под основным счётом, справа.
    this.missesText = this.add
      .text(this.bounds.right, this.bounds.y + 56, this.missesLabel(), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '30px',
        color: UI_CSS.onSurface,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(20);
    withStroke(this.missesText);
  }

  /** Текст счётчика неправильных попаданий. */
  private missesLabel(): string {
    return t('game.misses', { n: this.mistakes });
  }

  /**
   * Создаёт (один раз) текстуру мягкого круглого свечения — радиальный градиент
   * от центра к краю. Используется как ореол вокруг корзины при перетаскивании.
   */
  private ensureGlowTexture(): string {
    const key = 'softGlow';
    if (this.textures.exists(key)) return key;

    const size = 256;
    const tex = this.textures.createCanvas(key, size, size);
    if (!tex) return key;
    const ctx = tex.getContext();
    const r = size / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    // Плотное ядро и плавное затухание к полностью прозрачному краю.
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.12)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();

    return key;
  }

  /** Две корзины-приёмника внизу экрана. */
  private createBaskets(): void {
    const { baskets } = this.config;
    const basketSize = Math.min(this.bounds.height * 0.7, 400);
    // Разносим корзины к краям экрана (по n% от ширины от центра).
    const spread = this.bounds.width * 0.2;
    const y = this.bounds.bottom - basketSize * 0.4;
    // Наклон к центральной оси: чем дальше от центра, тем сильнее поворот.
    const tilt = -10;

    baskets.forEach((basket, i) => {
      // Раскладываем симметрично относительно центра.
      const dir = i === 0 ? -1 : 1;
      const x = this.bounds.centerX + dir * spread;
      // Наклоняем корзины «навстречу» центру.
      const rotation = Phaser.Math.DegToRad(dir * tilt);
      this.createBasket(x, y, basketSize, basket, rotation);
    });
  }

  private createBasket(
    x: number,
    y: number,
    size: number,
    basket: LevelConfig['baskets'][number],
    rotation = 0,
  ): void {
    const children: Phaser.GameObjects.GameObject[] = [];

    // Мягкое круглое свечение вокруг корзины (скрыто по умолчанию):
    // показывается, когда к корзине тащат ракушку, — чтобы было понятно,
    // что можно отпускать. Не рамка, а лёгкий ореол светлым светом.
    const highlight = this.add.image(0, 0, this.ensureGlowTexture());
    const glowSize = size * 1.8;
    highlight.setDisplaySize(glowSize, glowSize);
    highlight.setTint(UI.onSurface);
    highlight.setBlendMode(Phaser.BlendModes.ADD);
    highlight.setAlpha(0);
    highlight.setVisible(false);
    children.push(highlight);

    if (basket.image?.key && this.textures.exists(basket.image.key)) {
      const img = this.add.image(0, 0, basket.image.key);
      img.setDisplaySize(size, size);
      children.push(img);
    } else {
      // Заглушка-корзина: скруглённый «ящик» с цветом категории.
      const g = this.add.graphics();
      g.fillStyle(basket.color, 1);
      g.fillRoundedRect(-size / 2, -size / 2, size, size, size * 0.16);

      g.lineStyle(6, UI.stroke, 0.9);
      g.strokeRoundedRect(-size / 2, -size / 2, size, size, size * 0.16);
      children.push(g);
    }

    // Метка корзины: картинка-ракушка нужной категории, а если её нет —
    // текстовая подпись (Песок / Вода). Метку держим внутри границ корзины.
    let label: Phaser.GameObjects.Container | Phaser.GameObjects.Text;
    let labelRotation = 0;
    const labelSize = size * 0.42;

    if (basket.labelImage?.key && this.textures.exists(basket.labelImage.key)) {
      // Ракушку на корзине рисуем с обводкой как у текста/иконок,
      // но вдвое тоньше (относительно прежнего варианта).
      label = this.makeOutlinedImage(
        basket.labelImage.key,
        labelSize,
        PALETTE.deepPurple,
        Math.max(0.75, labelSize * 0.01),
      );
      // Центрируем метку внутри корзины, чтобы она не выходила за края.
      label.setPosition(0, 0);
      // Разворачиваем метку обратно, чтобы ракушка смотрела ровно.
      labelRotation = -rotation;
    } else {
      label = this.add
        .text(0, 0, t(basket.labelKey), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: `${size * 0.16}px`,
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      withStroke(label);
      labelRotation = -rotation;
    }
    children.push(label);

    const container = this.add.container(x, y, children).setDepth(5);
    // Поворачиваем корзину к центру; метку разворачиваем обратно, чтобы
    // она оставалась ровной и читаемой.
    container.setRotation(rotation);
    label.setRotation(labelRotation);

    this.baskets.set(basket.categoryId, {
      x,
      y,
      radius: size / 2,
      container,
      highlight,
    });
  }

  /** Анимация корзины при верном попадании: радостный «подскок». */
  private animateBasketCorrect(categoryId: string): void {
    const basket = this.baskets.get(categoryId);
    if (!basket) return;
    const { container } = basket;
    // Сохраняем исходные углы, чтобы вернуть корзину на место.
    const baseRotation = container.rotation;
    this.tweens.add({
      targets: container,
      scale: 1.15,
      rotation: baseRotation - Phaser.Math.DegToRad(4),
      duration: 120,
      ease: 'Quad.out',
      yoyo: true,
      onComplete: () => {
        container.setScale(1);
        container.setRotation(baseRotation);
      },
    });
  }

  /** Анимация корзины при неверном попадании: «дрожь» + красная вспышка. */
  private animateBasketWrong(categoryId: string): void {
    const basket = this.baskets.get(categoryId);
    if (!basket) return;
    const { container } = basket;
    const baseX = container.x;
    const baseRotation = container.rotation;

    // Быстрое покачивание влево-вправо вокруг исходной точки.
    this.tweens.add({
      targets: container,
      x: baseX - 10,
      rotation: baseRotation - Phaser.Math.DegToRad(6),
      duration: 60,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        container.setX(baseX);
        container.setRotation(baseRotation);
      },
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

    // Навешиваем «живое» падение (гравитация + покачивание + лёгкий крен).
    this.startFall(record);

    container.on(
      'drag',
      (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (record.done) return;
        // Останавливаем падение, пока объект тащат.
        this.pauseFall(container);
        // Сбрасываем крен: во время перетаскивания ракушка смотрит ровно.
        container.setRotation(0);
        container.x = dragX;
        container.y = dragY;
        // Подсвечиваем корзину, над которой сейчас находится ракушка.
        this.updateBasketHighlight(record.categoryId, dragX, dragY);
      },
    );

    container.on('dragend', () => {
      this.clearBasketHighlight();
      this.onDrop(record);
    });
  }

  /**
   * Запускает «живое» падение объекта от текущей позиции до низа экрана.
   *
   * Состоит из трёх наложенных tween:
   *  - основной вертикальный с ускорением (`Sine.in`) — имитация гравитации;
   *  - горизонтальное покачивание (плавный синус туда-обратно) — объект
   *    «плывёт», а не падает по линейке;
   *  - лёгкий крен (наклон влево-вправо), синхронный с покачиванием.
   *
   * Основной tween кладём в `fallTween`, остальные — в `fallAuxTweens`,
   * чтобы их можно было разом поставить на паузу и снять при перетаскивании.
   */
  private startFall(record: FallingObject): void {
    const { container } = record;
    const fallTargetY = this.bounds.bottom - 20;
    const distance = fallTargetY - container.y;
    if (distance <= 0) {
      this.onMissed(record);
      return;
    }

    // Убираем возможные прошлые aux-tween перед запуском новых.
    this.clearAuxTweens(container);

    const duration = (distance / this.config.fallSpeed) * 1000;

    // Основное падение: чуть ускоряется к низу (гравитация).
    const tween = this.tweens.add({
      targets: container,
      y: fallTargetY,
      duration,
      ease: 'Sine.in',
      onComplete: () => this.onMissed(record),
    });
    container.setData('fallTween', tween);

    // Покачивание и крен масштабируем: у мелких падений размах меньше.
    const swayAmp = Phaser.Math.Clamp(distance * 0.06, 10, 46);
    const swayDuration = Phaser.Math.Clamp(duration * 0.35, 700, 1600);
    const baseX = container.x;
    const dir = Math.random() < 0.5 ? -1 : 1;

    // Горизонтальное покачивание: плавный синус от базы, туда-обратно.
    const sway = this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: swayDuration,
      repeat: -1,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        container.x = baseX + Math.sin(v) * swayAmp * dir;
        // Лёгкий крен «по ветру», совпадающий с направлением движения.
        container.setRotation(Math.cos(v) * Phaser.Math.DegToRad(6) * dir);
      },
    });

    container.setData('fallAuxTweens', [sway]);
  }

  /** Ставит на паузу все tween падения объекта (основной + вспомогательные). */
  private pauseFall(container: Phaser.GameObjects.Container): void {
    (container.getData('fallTween') as Phaser.Tweens.Tween | null)?.pause();
    const aux = container.getData('fallAuxTweens') as
      | Phaser.Tweens.Tween[]
      | undefined;
    aux?.forEach((t) => t.pause());
  }

  /** Снимает вспомогательные tween падения (покачивание/крен). */
  private clearAuxTweens(container: Phaser.GameObjects.Container): void {
    const aux = container.getData('fallAuxTweens') as
      | Phaser.Tweens.Tween[]
      | undefined;
    aux?.forEach((t) => t.remove());
    container.setData('fallAuxTweens', []);
  }

  /** Полностью останавливает и убирает анимацию падения объекта. */
  private stopFall(container: Phaser.GameObjects.Container): void {
    (container.getData('fallTween') as Phaser.Tweens.Tween | null)?.remove();
    container.setData('fallTween', null);
    this.clearAuxTweens(container);
  }

  /**
   * Картинка с обводкой по контуру PNG.
   *
   * Непрозрачную форму обводят несколько копий картинки, тинтованных в цвет
   * контура и слегка смещённых по кругу, а сверху кладётся сама картинка.
   * Работает и в WebGL, и в Canvas (в отличие от FX-контуров).
   */
  private makeOutlinedImage(
    key: string,
    size: number,
    outlineColor: number,
    thickness: number,
  ): Phaser.GameObjects.Container {
    const children: Phaser.GameObjects.GameObject[] = [];

    // Копии-контур, равномерно разнесённые по кругу.
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const dx = Math.cos(angle) * thickness;
      const dy = Math.sin(angle) * thickness;
      const shadow = this.add.image(dx, dy, key).setDisplaySize(size, size);
      shadow.setTint(outlineColor);
      children.push(shadow);
    }

    // Сама картинка поверх контура.
    const main = this.add.image(0, 0, key).setDisplaySize(size, size);
    children.push(main);

    return this.add.container(0, 0, children);
  }

  /** Рисует визуал объекта (картинка с обводкой или цветная заглушка). */
  private createItemVisual(
    x: number,
    y: number,
    def: FallingItem,
  ): Phaser.GameObjects.Container {
    // Ракушки делаем заметно крупнее — так их проще хватать детям.
    const size = Math.min(this.bounds.height * 0.2, 150);
    let visual: Phaser.GameObjects.GameObject;

    if (def.image?.key && this.textures.exists(def.image.key)) {
      // Обводка по контуру ракушки — того же цвета, что у текста/иконок,
      // но вдвое тоньше: спрайт крупный, жирный контур выглядел грубо.
      visual = this.makeOutlinedImage(
        def.image.key,
        size,
        PALETTE.deepPurple,
        Math.max(2, size * 0.0175),
      );
    } else {
      // Заглушка: круг с контуром в цвете категории.
      const c = this.add.circle(0, 0, size / 2, def.color);

      c.setStrokeStyle(6, UI.stroke, 0.85);
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
    return { categoryId: chosen, color: cat?.color ?? UI.onSurface };
  }

  // ---------------------------------------------------------------------------
  // Обработка перетаскивания
  // ---------------------------------------------------------------------------

  /**
   * Подсвечивает корзину под перетаскиваемой ракушкой.
   *
   * Подсказка показывается всегда, когда ракушка нависает над любой корзиной,
   * но цвет и лёгкий «подскок» зависят от совпадения категории: правильная
   * корзина светится зелёным и подрастает («можно отпускать»), неправильная —
   * приглушённым цветом.
   */
  private updateBasketHighlight(
    itemCategoryId: string,
    x: number,
    y: number,
  ): void {
    let target: string | null = null;
    for (const [categoryId, basket] of this.baskets) {
      const dist = Phaser.Math.Distance.Between(x, y, basket.x, basket.y);
      if (dist < basket.radius) {
        target = categoryId;
        break;
      }
    }

    if (target === this.highlightedCategory) return;

    // Снимаем подсветку со старой корзины.
    if (this.highlightedCategory) {
      this.setBasketHighlight(this.highlightedCategory, false, false);
    }
    // Включаем на новой (если попали в какую-то корзину).
    if (target) {
      const isCorrect = target === itemCategoryId;
      this.setBasketHighlight(target, true, isCorrect);
    }
    this.highlightedCategory = target;
  }

  /** Полностью убирает подсветку со всех корзин. */
  private clearBasketHighlight(): void {
    if (!this.highlightedCategory) return;
    const basket = this.baskets.get(this.highlightedCategory);
    if (basket) {
      // Гасим свечение и останавливаем пульс, возвращая корзину к обычному
      // размеру без анимации, чтобы не мешать «подскоку» при попадании.
      const pulseKey = `glowPulse-${this.highlightedCategory}`;
      (basket.container.getData(pulseKey) as Phaser.Tweens.Tween | null)?.remove();
      basket.container.setData(pulseKey, null);
      basket.highlight.setVisible(false);
      basket.highlight.setAlpha(0);
      basket.container.setScale(1);
    }
    this.highlightedCategory = null;
  }

  /**
   * Включает/выключает подсветку конкретной корзины.
   * `correct` — совпадает ли категория ракушки с корзиной (правильная цель).
   */
  private setBasketHighlight(
    categoryId: string,
    on: boolean,
    correct: boolean,
  ): void {
    const basket = this.baskets.get(categoryId);
    if (!basket) return;
    const { highlight } = basket;

    // Правильную цель светим мягким тёплым светом, неправильную — белым.
    highlight.setTint(correct ? UI.reward : UI.onSurface);

    // Останавливаем прежний пульс и возвращаем свечение к базовому масштабу.
    const pulseKey = `glowPulse-${categoryId}`;
    (basket.container.getData(pulseKey) as Phaser.Tweens.Tween | null)?.remove();
    basket.container.setData(pulseKey, null);

    if (on) {
      highlight.setVisible(true);
      highlight.setAlpha(0);
      this.tweens.add({
        targets: highlight,
        alpha: correct ? 0.95 : 0.6,
        duration: 160,
        ease: 'Quad.out',
      });

      // Лёгкое «дыхание» свечения — притягивает взгляд к цели.
      const pulse = this.tweens.add({
        targets: highlight,
        scale: { from: 1, to: 1.08 },
        duration: 620,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: -1,
      });
      basket.container.setData(pulseKey, pulse);
    } else {
      this.tweens.add({
        targets: highlight,
        alpha: 0,
        duration: 140,
        ease: 'Quad.out',
        onComplete: () => highlight.setVisible(false),
      });
    }

    // Лёгкий «подскок» правильной корзины, чтобы притягивала взгляд.
    const { container } = basket;
    this.tweens.add({
      targets: container,
      scale: on && correct ? 1.1 : 1,
      duration: 130,
      ease: 'Quad.out',
    });
  }

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
      this.onCorrect(record, hitCategory);
    } else {
      this.onWrong(record, hitCategory);
    }
  }

  /** Продолжает падение объекта с текущей высоты. */
  private resumeFall(record: FallingObject): void {
    // Пересоздаём анимацию падения от текущей позиции.
    this.stopFall(record.container);
    this.startFall(record);
  }

  private onCorrect(record: FallingObject, basketCategoryId: string): void {
    record.done = true;
    this.input.setDraggable(record.container, false);
    record.container.disableInteractive();

    // Останавливаем всё падение (основной tween + покачивание/крен).
    this.stopFall(record.container);

    // Корзина радостно «подпрыгивает» при верном попадании.
    this.animateBasketCorrect(basketCategoryId);

    // Сама ракушка «вспыхивает» и уменьшается, улетая в корзину.
    this.animateItemCorrect(record.container);

    this.sorted += 1;
    this.updateHud();

    this.tweens.add({
      targets: record.container,
      scale: 0.2,
      alpha: 0,
      duration: 220,
      delay: 140,
      onComplete: () => {
        record.container.destroy();
        this.items = this.items.filter((it) => it !== record);
      },
    });

    if (this.sorted >= this.config.targetCount) {
      this.finishLevel();
    }
  }

  /**
   * Анимация-выделение ракушки при верном попадании: короткая вспышка-подсветка
   * (золотой пульс картинки) и лёгкий поворот — помимо уменьшения корзины.
   */
  private animateItemCorrect(container: Phaser.GameObjects.Container): void {
    // Собираем все картинки внутри (учёт вложенной обводки-контейнера).
    const images: Phaser.GameObjects.Image[] = [];
    const collect = (obj: Phaser.GameObjects.GameObject): void => {
      if (obj instanceof Phaser.GameObjects.Image) {
        images.push(obj);
      } else if (obj instanceof Phaser.GameObjects.Container) {
        obj.list.forEach(collect);
      }
    };
    container.list.forEach(collect);

    // Подсвечиваем ракушку золотой заливкой — отмечаем правильный выбор.
    images.forEach((img) => img.setTintFill(UI.reward));

    // Лёгкое «покачивание» радости (масштаб не трогаем — им управляет
    // исчезновение объекта).
    this.tweens.add({
      targets: container,
      angle: { from: -14, to: 14 },
      duration: 90,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: 1,
    });

    // Гасим вспышку обратно к исходному виду перед исчезновением.
    this.time.delayedCall(140, () => {
      images.forEach((img) => img.clearTint());
    });
  }

  private onWrong(record: FallingObject, basketCategoryId: string): void {
    // Считаем только неверно распределённые предметы (попавшие не в ту корзину).
    this.mistakes += 1;
    this.updateHud();
    this.pulseMissesCounter();

    // Корзина «отряхивается» при неверном попадании.
    this.animateBasketWrong(basketCategoryId);

    this.cameras.main.flash(200, 255, 80, 80);

    // Возвращаем объект наверх и продолжаем падение.
    const { container } = record;
    this.stopFall(container);
    const startY = this.bounds.y + 40;
    this.tweens.add({
      targets: container,
      y: startY,
      duration: 300,
      ease: 'Back.out',
      onComplete: () => this.resumeFall(record),
    });
  }

  /** Короткая вспышка-подскок счётчика неверно распределённых предметов. */
  private pulseMissesCounter(): void {
    this.tweens.add({
      targets: this.missesText,
      scale: { from: 1.25, to: 1 },
      duration: 260,
      ease: 'Back.out',
    });
  }

  /**
   * Объект упал ниже последней корзины. Больше не подкидываем его наверх —
   * он продолжает падать, улетает вниз за пределы экрана и удаляется.
   *
   * Упущенный предмет НЕ засчитывается в счётчик неверно распределённых:
   * его просто не поймали, корзины он не коснулся.
   */
  private onMissed(record: FallingObject): void {
    if (record.done) return;
    record.done = true;

    const { container } = record;
    // Отключаем взаимодействие — предмет уже упущен.
    this.input.setDraggable(container, false);
    container.disableInteractive();

    // Досылаем предмет за нижний край экрана и убираем.
    const offscreenY = this.scale.height + container.height;
    const remaining = offscreenY - container.y;
    const duration = Math.max(200, (remaining / this.config.fallSpeed) * 1000);

    this.stopFall(container);
    this.tweens.add({
      targets: container,
      y: offscreenY,
      duration,
      ease: 'Sine.in',
      onComplete: () => {
        container.destroy();
        this.items = this.items.filter((it) => it !== record);
      },
    });
  }

  private updateHud(): void {
    this.scoreText.setText(`${this.sorted} / ${this.config.targetCount}`);
    this.missesText?.setText(this.missesLabel());
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

    this.showVictoryPanel(stars);
  }

  /**
   * Панель победы: затемнение экрана, «дышащее» свечение, анимированные звёзды
   * и кнопка перехода. Появляется каскадом снизу вверх для живости.
   */
  private showVictoryPanel(stars: number): void {
    const { centerX, centerY } = this.bounds;
    const panelW = Math.min(this.bounds.width * 0.86, 680);
    const panelH = Math.min(this.bounds.height * 0.72, 560);
    const radius = panelH * 0.09;
    const depth = 30;

    // 1. Затемняем игровое поле, чтобы фокус был на результате.
    const dim = this.add
      .rectangle(centerX, centerY, this.scale.width, this.scale.height, UI.overlay, 0.55)
      .setDepth(depth)
      .setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 220 });

    // 2. Панель с закруглёнными углами, рамкой и мягкой тенью.
    const panel = this.add.graphics().setDepth(depth + 1);
    panel.fillStyle(UI.shadow, 0.18);
    panel.fillRoundedRect(
      -panelW / 2,
      -panelH / 2 + 10,
      panelW,
      panelH,
      radius,
    );
    panel.fillStyle(UI.primary, 1);
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);
    panel.lineStyle(Math.max(6, panelW * 0.012), UI.stroke, 0.95);
    panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);

    const panelContainer = this.add
      .container(centerX, centerY, [panel])
      .setDepth(depth + 1);
    panelContainer.setScale(0.8);
    panelContainer.setAlpha(0);
    this.tweens.add({
      targets: panelContainer,
      scale: 1,
      alpha: 1,
      duration: 320,
      ease: 'Back.out',
    });

    // 3. Заголовок «Молодец!».
    const title = withStroke(
      this.add
        .text(centerX, centerY - panelH * 0.3, t('game.wellDone'), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: `${Math.round(panelH * 0.14)}px`,
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(depth + 2),
    );
    title.setAlpha(0);

    // 4. Ряд звёзд под заголовком — рисуем векторно и анимируем каскадом.
    const starSize = panelH * 0.2;
    const gap = starSize * 1.12;
    const starsY = centerY + panelH * 0.02;
    this.createVictoryStars(
      centerX,
      starsY,
      stars,
      starSize,
      gap,
      depth + 2,
    );

    // 5. Кнопка перехода.
    const season = getSeason(ACTIVE_SEASON);
    const isLast = this.level >= season.levelCount;
    const nextLabel = isLast ? t('common.back') : t('game.next');

    const next = createButton(this, centerX, centerY + panelH * 0.32, {
      width: 300,
      height: 84,
      color: COLORS.secondary,
      label: nextLabel,
      onClick: () => this.scene.start('LevelSelectScene'),
    });
    next.setDepth(depth + 2);
    next.setAlpha(0);
    next.setScale(0.8);

    // Заголовок и кнопка «выезжают» после появления панели.
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 260,
      delay: 180,
    });
    this.tweens.add({
      targets: next,
      alpha: 1,
      scale: 1,
      duration: 320,
      delay: 520,
      ease: 'Back.out',
    });
  }

  /**
   * Рисует ряд звёзд результата (заполненные — заработанные, контурные —
   * оставшиеся). Каждая звезда появляется каскадом с «подскоком», а
   * заработанные мягко пульсируют — так акцент на достижении заметнее.
   */
  private createVictoryStars(
    centerX: number,
    centerY: number,
    earned: number,
    size: number,
    gap: number,
    depth: number,
  ): void {
    const count = 3;
    const startX = centerX - gap * (count - 1) * 0.5;

    for (let i = 0; i < count; i++) {
      const filled = i < earned;
      const star = this.createStarShape(size, filled)
        .setPosition(startX + i * gap, centerY)
        .setDepth(depth)
        .setAlpha(0)
        .setScale(0);

      // Каскадное появление: слева направо, с «отскоком».
      this.tweens.add({
        targets: star,
        alpha: 1,
        scale: 1,
        duration: 320,
        delay: 260 + i * 160,
        ease: 'Back.out',
      });

      // Заработанная звезда мягко «дышит» — знак успеха.
      if (filled) {
        this.tweens.add({
          targets: star,
          scale: 1.12,
          duration: 700,
          delay: 600 + i * 160,
          ease: 'Sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  /**
   * Одна звезда как контейнер: пятиконечная форма с обводкой.
   * Заработанная — золотая с бликом, оставшаяся — приглушённый контур.
   */
  private createStarShape(
    size: number,
    filled: boolean,
  ): Phaser.GameObjects.Container {
    const outer = size / 2;
    const inner = outer * 0.45;
    const points: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      // Верхний угол — вверх (−90°), дальше по кругу.
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    const g = this.add.graphics();
    const fillColor = filled ? UI.reward : UI.onSurface;
    const fillAlpha = filled ? 1 : 0.15;

    g.fillStyle(fillColor, fillAlpha);
    g.beginPath();
    g.moveTo(points[0].x!, points[0].y!);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x!, points[i].y!);
    }
    g.closePath();
    g.fillPath();

    g.lineStyle(Math.max(3, size * 0.06), UI.stroke, 0.95);
    g.strokePath();

    return this.add.container(0, 0, [g]);
  }
}
