import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI, UI_CSS, PALETTE, toCss } from '../palette';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import { Progress } from '../progress';
import { t, getLanguage } from '../i18n';
import { playChime } from '../audio';
import { Daily } from '../daily';
import { Helper } from '../characters/Helper';
import { createStickerIcon, stickerForLevel } from '../stickers';
import {
  ACTIVE_SEASON,
  getLevel,
  getSeason,
  type FallingItem,
  type LevelConfig,
} from '../seasons';
import { summerItems } from '../seasons/summer';
import { collectPoints, mistakeCost, starsFromScore } from '../scoring';

interface GameSceneData {
  level?: number;
  /** Ежедневное задание: 15 предметов без ошибок. */
  mode?: 'daily';
}

/** Падающий объект как игровой объект. */
interface FallingObject {
  container: Phaser.GameObjects.Container;
  /** id предмета (совпадает с Basket.itemId его корзины). */
  itemId: string;
  /** Заблокирован ли объект (уже успешно перетащен). */
  done: boolean;
  /** Редкий предмет «заморозка»: любая корзина считается верной. */
  effect?: 'freeze';
  /** Цена предмета в очках. */
  points: number;
}

/**
 * GameScene — уровень сортировки.
 * Сверху падают объекты (ракушки/звёзды), игрок перетаскивает их в нужную
 * корзину. Уровень пройден, когда набрано targetScore очков.
 */
export class GameScene extends Phaser.Scene {
  private level = 1;
  private config!: LevelConfig;
  private sorted = 0;
  /** Начислено за верные сборы, вместе с бонусом серии. */
  private gained = 0;
  /** Снято за неверные корзины. */
  private lost = 0;
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
  /** id корзины, подсвеченной сейчас (null — ничего не подсвечено). */
  private highlightedItem: string | null = null;

  /** Обычный уровень или ежедневное задание. */
  private mode: 'level' | 'daily' = 'level';
  /** Верные ответы подряд. Сбрасывается ошибкой. */
  private combo = 0;
  /** Момент старта уровня — для супер-звезды за быстрый проход. */
  private startedAt = 0;
  /** Множитель скорости падения: 1 обычно, меньше — во время комбо или заморозки. */
  private fallTimeScale = 1;
  private slowTimer?: Phaser.Time.TimerEvent;
  private slowVeil?: Phaser.GameObjects.Rectangle;
  private helper?: Helper;
  /** Чтобы панель победы не открылась дважды. */
  private finished = false;

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.mode = data.mode === 'daily' ? 'daily' : 'level';
    this.level = this.mode === 'daily' ? 4 : (data.level ?? 1);
  }

  create(): void {
    this.config = getLevel(ACTIVE_SEASON, this.level);
    if (this.mode === 'daily') {
      this.config = {
        ...this.config,
        targetCount: Daily.target,
        spawnIntervalMs: 1000,
        fallSpeed: 95,
      };
    }
    this.bounds = getSafeBounds(this.scale, 24);
    this.sorted = 0;
    this.gained = 0;
    this.lost = 0;
    this.mistakes = 0;
    this.combo = 0;
    this.startedAt = this.time.now;
    this.fallTimeScale = 1;
    this.finished = false;
    this.slowTimer = undefined;
    this.slowVeil = undefined;
    this.items = [];
    this.baskets.clear();
    this.highlightedItem = null;

    this.createBackground();
    this.createBackButton();
    this.createHud();
    this.createBaskets();
    this.helper = new Helper(
      this,
      this.bounds.x + 108,
      this.bounds.y + 180,
      104,
    );

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

    const levelTitle =
      this.mode === 'daily'
        ? t('game.dailyTitle')
        : t('game.level', { n: this.level });
    withStroke(
      this.add
        .text(centerX, this.bounds.y, levelTitle, {
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
        this.scoreLabel(),
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

  /**
   * Корзины-приёмники внизу экрана.
   * Обычные корзины стоят общим рядом и крупнее прежних.
   * Мусорная (`aside`) — одна, того же размера, но с зазором справа от ряда.
   */
  private createBaskets(): void {
    const { baskets } = this.config;
    const aside = baskets.filter((b) => b.aside);
    const main = baskets.filter((b) => !b.aside);
    const count = Math.max(main.length, 1);
    const hasAside = aside.length > 0;

    const edge = this.bounds.width * 0.025;
    // Небольшой отступ, чтобы мусорка читалась отдельно от ряда.
    const asideGap = hasAside ? this.bounds.width * 0.045 : 0;
    const innerGapRatio = 0.12;

    const slots =
      count +
      Math.max(count - 1, 0) * innerGapRatio +
      (hasAside ? 1 : 0);
    const usable = this.bounds.width - edge * 2 - asideGap;
    const sizeByWidth = usable / slots;
    const sizeFactor = count >= 5 ? 0.86 : count >= 3 ? 0.94 : 1;
    const basketSize = Math.min(
      this.bounds.height * sizeFactor,
      sizeByWidth,
      560,
    );

    const y = this.bounds.bottom - basketSize * 0.4;
    const innerGap = basketSize * innerGapRatio;
    const rowWidth = count * basketSize + Math.max(count - 1, 0) * innerGap;
    const totalWidth = rowWidth + (hasAside ? asideGap + basketSize : 0);
    const originX = this.bounds.centerX - totalWidth / 2;

    main.forEach((basket, i) => {
      const t = main.length <= 1 ? 0 : (i / (main.length - 1)) * 2 - 1;
      const x = originX + basketSize / 2 + i * (basketSize + innerGap);
      const rotation = Phaser.Math.DegToRad(t * -10);
      this.createBasket(x, y, basketSize, basket, rotation);
    });

    aside.forEach((basket) => {
      const x = originX + rowWidth + asideGap + basketSize / 2;
      this.createBasket(x, y, basketSize, basket, Phaser.Math.DegToRad(8));
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

    // Метка корзины: картинка предмета (или несколько — на общей мусорке).
    // Если картинок нет — текстовая подпись. Метку держим внутри корзины.
    let label: Phaser.GameObjects.Container | Phaser.GameObjects.Text;
    let labelRotation = 0;
    const labelSize = size * 0.42;
    const labelRefs = (
      basket.labelImages?.length
        ? basket.labelImages
        : basket.labelImage
          ? [basket.labelImage]
          : []
    ).filter((img) => img.key && this.textures.exists(img.key));

    if (labelRefs.length > 0) {
      const iconSize = labelRefs.length > 1 ? size * 0.28 : labelSize;
      const iconGap = iconSize * 0.18;
      const totalW =
        labelRefs.length * iconSize + (labelRefs.length - 1) * iconGap;
      const icons = labelRefs.map((img, i) => {
        const icon = this.makeOutlinedImage(
          img.key!,
          iconSize,
          PALETTE.deepPurple,
          Math.max(0.75, iconSize * 0.01),
        );
        icon.setPosition(
          -totalW / 2 + iconSize / 2 + i * (iconSize + iconGap),
          0,
        );
        return icon;
      });
      label = this.add.container(0, 0, icons);
      // Разворачиваем метку обратно, чтобы картинка смотрела ровно.
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

    this.baskets.set(basket.itemId, {
      x,
      y,
      radius: size / 2,
      container,
      highlight,
    });
  }

  /** Анимация корзины при верном попадании: радостный «подскок». */
  private animateBasketCorrect(itemId: string): void {
    const basket = this.baskets.get(itemId);
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
  private animateBasketWrong(itemId: string): void {
    const basket = this.baskets.get(itemId);
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
    const record: FallingObject = {
      container,
      itemId: def.id,
      done: false,
      effect: def.effect,
      points: def.points ?? 0,
    };
    this.items.push(record);

    // Предметы без корзины (камни) не перетаскиваются и не ловят нажатия:
    // их нужно просто пропустить — они падают мимо и исчезают за нижним краем.
    // Заморозка своей корзины не имеет, но её можно положить в любую.
    const isSortable = this.baskets.has(def.id) || def.effect === 'freeze';
    if (!isSortable) {
      container.disableInteractive();
    } else {
      this.input.setDraggable(container);

      let originX = 0;
      let originY = 0;
      container.on('dragstart', (pointer: Phaser.Input.Pointer) => {
        originX = pointer.x;
        originY = pointer.y;
      });

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
          this.updateBasketHighlight(record, dragX, dragY);
        },
      );

      container.on('dragend', (pointer: Phaser.Input.Pointer) => {
        this.clearBasketHighlight();
        // Короткое касание без переноса — подсказка, а не бросок.
        const moved = Phaser.Math.Distance.Between(
          originX,
          originY,
          pointer.x,
          pointer.y,
        );
        if (moved < 28) {
          this.showHint(record);
          this.resumeFall(record);
          return;
        }
        this.onDrop(record);
      });
    }

    // Навешиваем «живое» падение (гравитация + покачивание + лёгкий крен).
    this.startFall(record);
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
    tween.timeScale = this.fallTimeScale;
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

    sway.timeScale = this.fallTimeScale;
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

    // У предмета может быть одна картинка или несколько (например, камни):
    // для набора выбираем случайную.
    const imageKey =
      def.image?.key ??
      (def.images && def.images.length > 0
        ? Phaser.Utils.Array.GetRandom(def.images).key
        : undefined);

    if (def.effect === 'freeze' && !(imageKey && this.textures.exists(imageKey))) {
      visual = this.makeFreezeCrystal(size);
    } else if (imageKey && this.textures.exists(imageKey)) {
      // Обводка по контуру ракушки — того же цвета, что у текста/иконок,
      // но вдвое тоньше: спрайт крупный, жирный контур выглядел грубо.
      visual = this.makeOutlinedImage(
        imageKey,
        size,
        PALETTE.deepPurple,
        Math.max(2, size * 0.0175),
      );
    } else {
      // Заглушка: круг с контуром в цвете предмета.
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

  /**
   * Выбирает определение объекта по весам (`weight`).
   * Камни и мусор заданы с низким весом — падают реже остальных предметов.
   */
  private pickItemDef(): FallingItem {
    // Берём только предметы, доступные на текущем уровне (fromLevel).
    const defs = summerItems.filter(
      (d) => d.fromLevel === undefined || d.fromLevel <= this.level,
    );
    if (defs.length === 0) {
      return { id: 'fallback', color: UI.onSurface };
    }

    // Взвешенный случайный выбор: чем больше weight, тем чаще предмет.
    const total = defs.reduce((s, d) => s + (d.weight ?? 1), 0);
    let r = Math.random() * total;
    for (const d of defs) {
      r -= d.weight ?? 1;
      if (r <= 0) return d;
    }
    return defs[defs.length - 1];
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
    record: FallingObject,
    x: number,
    y: number,
  ): void {
    let target: string | null = null;
    for (const [basketId, basket] of this.baskets) {
      const dist = Phaser.Math.Distance.Between(x, y, basket.x, basket.y);
      if (dist < basket.radius) {
        target = basketId;
        break;
      }
    }

    if (target === this.highlightedItem) return;

    // Снимаем подсветку со старой корзины.
    if (this.highlightedItem) {
      this.setBasketHighlight(this.highlightedItem, false, false);
    }
    // Включаем на новой (если попали в какую-то корзину).
    if (target) {
      const isCorrect =
        record.effect === 'freeze' || target === record.itemId;
      this.setBasketHighlight(target, true, isCorrect);
    }
    this.highlightedItem = target;
  }

  /** Полностью убирает подсветку со всех корзин. */
  private clearBasketHighlight(): void {
    if (!this.highlightedItem) return;
    const basket = this.baskets.get(this.highlightedItem);
    if (basket) {
      // Гасим свечение и останавливаем пульс, возвращая корзину к обычному
      // размеру без анимации, чтобы не мешать «подскоку» при попадании.
      const pulseKey = `glowPulse-${this.highlightedItem}`;
      (basket.container.getData(pulseKey) as Phaser.Tweens.Tween | null)?.remove();
      basket.container.setData(pulseKey, null);
      basket.highlight.setVisible(false);
      basket.highlight.setAlpha(0);
      basket.container.setScale(1);
    }
    this.highlightedItem = null;
  }

  /**
   * Включает/выключает подсветку конкретной корзины.
   * `correct` — совпадает ли предмет с корзиной (правильная цель).
   */
  private setBasketHighlight(
    itemId: string,
    on: boolean,
    correct: boolean,
  ): void {
    const basket = this.baskets.get(itemId);
    if (!basket) return;
    const { highlight } = basket;

    // Правильную цель светим мягким тёплым светом, неправильную — белым.
    highlight.setTint(correct ? UI.reward : UI.onSurface);

    // Останавливаем прежний пульс и возвращаем свечение к базовому масштабу.
    const pulseKey = `glowPulse-${itemId}`;
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
    let hitItem: string | null = null;
    for (const [basketId, basket] of this.baskets) {
      const dist = Phaser.Math.Distance.Between(
        container.x,
        container.y,
        basket.x,
        basket.y,
      );
      if (dist < basket.radius) {
        hitItem = basketId;
        break;
      }
    }

    if (hitItem === null) {
      // Не попали ни в одну корзину — продолжаем падение.
      this.resumeFall(record);
      return;
    }

    if (record.effect === 'freeze' || hitItem === record.itemId) {
      this.onCorrect(record, hitItem);
    } else {
      this.onWrong(record, hitItem);
    }
  }

  /** Продолжает падение объекта с текущей высоты. */
  private resumeFall(record: FallingObject): void {
    // Пересоздаём анимацию падения от текущей позиции.
    this.stopFall(record.container);
    this.startFall(record);
  }

  private onCorrect(record: FallingObject, basketItemId: string): void {
    record.done = true;
    this.input.setDraggable(record.container, false);
    record.container.disableInteractive();

    // Останавливаем всё падение (основной tween + покачивание/крен).
    this.stopFall(record.container);

    // Корзина радостно «подпрыгивает» при верном попадании.
    this.animateBasketCorrect(basketItemId);

    // Сама ракушка «вспыхивает» и уменьшается, улетая в корзину.
    this.animateItemCorrect(record.container);

    this.sorted += 1;
    this.combo += 1;
    const award = collectPoints(record.points, this.combo);
    this.gained += award;
    this.showPointsPop(record.container.x, record.container.y, `+${award}`, UI_CSS.reward);
    this.helper?.happy();
    this.updateHud();
    this.pulseScore();

    if (record.effect === 'freeze') {
      this.applySlow(2800);
      this.showFloatText(t('game.frozen'), toCss(PALETTE.ice), this.bounds.centerY - 10);
      playChime(this, 'freeze');
    }
    if (this.combo >= 3 && this.combo % 3 === 0) {
      this.applySlow(2200);
      this.showFloatText(
        t('game.combo', { n: this.combo }),
        UI_CSS.reward,
        this.bounds.centerY - 78,
      );
      playChime(this, 'combo');
      this.helper?.cheer();
    }

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

    const cleared =
      this.mode === 'daily'
        ? this.sorted >= this.config.targetCount
        : this.netScore() >= this.config.targetScore;
    if (cleared) {
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

  private onWrong(record: FallingObject, basketItemId: string): void {
    // Считаем только неверно распределённые предметы (попавшие не в ту корзину).
    this.mistakes += 1;
    this.combo = 0;
    const cost = mistakeCost(record.points);
    this.lost += cost;
    this.showPointsPop(
      record.container.x,
      record.container.y,
      `-${cost}`,
      toCss(UI.danger),
    );
    this.helper?.sad();
    this.updateHud();
    this.pulseScore();
    this.pulseMissesCounter();

    // Корзина «отряхивается» при неверном попадании.
    this.animateBasketWrong(basketItemId);

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

  /** Очки на экране: не уходят ниже нуля, даже если штраф больше набранного. */
  private netScore(): number {
    return Math.max(0, this.gained - this.lost);
  }

  /** В уровне — очки до цели. В ежедневном задании цель по-прежнему «15 без ошибок». */
  private scoreLabel(): string {
    if (this.mode === 'daily') {
      return `${this.sorted} / ${this.config.targetCount}`;
    }
    return `${this.netScore()} / ${this.config.targetScore}`;
  }

  private updateHud(): void {
    this.scoreText.setText(this.scoreLabel());
    this.missesText?.setText(this.missesLabel());
  }

  private pulseScore(): void {
    this.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.18, to: 1 },
      duration: 220,
      ease: 'Back.out',
    });
  }

  /** Короткое «+10» или «−5» рядом с предметом. */
  private showPointsPop(x: number, y: number, label: string, color: string): void {
    const text = withStroke(
      this.add
        .text(x, y - 36, label, {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '40px',
          color,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(26),
      undefined,
      5,
    );
    this.tweens.add({
      targets: text,
      y: y - 100,
      alpha: 0,
      duration: 680,
      ease: 'Quad.out',
      onComplete: () => text.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Завершение уровня
  // ---------------------------------------------------------------------------

  /** Уровень пройден: сохраняем прогресс и показываем результат. */
  private finishLevel(): void {
    if (this.finished) return;
    this.finished = true;
    this.spawnTimer?.remove();
    this.slowTimer?.remove();
    this.time.removeAllEvents();

    if (this.mode === 'daily') {
      const clean = this.mistakes === 0;
      if (clean) Daily.markDone();
      this.showVictoryPanel({
        stars: clean ? 3 : 1,
        superStar: false,
        firstClear: false,
        dailyClean: clean,
      });
      return;
    }

    // Звёзды — по доле сохранённых очков, а не по числу ошибок.
    const stars = starsFromScore(this.gained, this.lost);
    // Супер-звезда — три звезды и быстрый проход.
    const elapsed = this.time.now - this.startedAt;
    const superStar = stars === 3 && elapsed <= this.parTimeMs();
    const firstClear = Progress.getStars(this.level, ACTIVE_SEASON) === 0;
    Progress.setResult(this.level, stars, ACTIVE_SEASON, superStar);

    this.showVictoryPanel({ stars, superStar, firstClear, dailyClean: null });
  }

  /**
   * «Быстро»: около 2.8 с на предмет, но не короче, чем два интервала спавна.
   * Плюс небольшой запас на последний предмет.
   */
  private parTimeMs(): number {
    const perItem = Math.max(2800, this.config.spawnIntervalMs * 2.2);
    return this.config.targetCount * perItem + 2500;
  }

  /**
   * Панель победы: затемнение экрана, «дышащее» свечение, анимированные звёзды
   * и кнопка перехода. Появляется каскадом снизу вверх для живости.
   */
  private showVictoryPanel(result: {
    stars: number;
    superStar: boolean;
    firstClear: boolean;
    /** null — обычный уровень. true/false — итог ежедневного задания. */
    dailyClean: boolean | null;
  }): void {
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
    const titleKey =
      result.dailyClean === null
        ? 'game.wellDone'
        : result.dailyClean
          ? 'game.dailyWin'
          : 'game.dailyAlmost';
    const title = withStroke(
      this.add
        .text(centerX, centerY - panelH * 0.34, t(titleKey), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: `${Math.round(panelH * 0.11)}px`,
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: panelW * 0.86 },
        })
        .setOrigin(0.5)
        .setDepth(depth + 2),
    );
    title.setAlpha(0);

    // 4. Ряд звёзд под заголовком — рисуем векторно и анимируем каскадом.
    const starSize = panelH * 0.16;
    const gap = starSize * 1.12;
    const starsY = centerY - panelH * 0.06;
    this.createVictoryStars(
      centerX,
      starsY,
      result.stars,
      starSize,
      gap,
      depth + 2,
    );
    if (result.superStar) {
      this.spawnSuperStar(centerX, starsY - starSize * 0.95, starSize * 0.85, depth + 3);
    }
    if (result.dailyClean === null) {
      const scoreLine = withStroke(
        this.add
          .text(
            centerX,
            centerY - panelH * 0.2,
            t('game.score', { n: this.netScore() }),
            {
              fontFamily: getMainFont(getLanguage()),
              fontSize: '28px',
              color: UI_CSS.onSurface,
              fontStyle: 'bold',
            },
          )
          .setOrigin(0.5)
          .setDepth(depth + 2)
          .setAlpha(0),
        undefined,
        5,
      );
      this.tweens.add({
        targets: scoreLine,
        alpha: 1,
        duration: 260,
        delay: 360,
      });
      this.showVictorySticker(centerX, centerY + panelH * 0.16, result.firstClear, depth + 2);
    }

    // 5. Кнопка перехода.
    const season = getSeason(ACTIVE_SEASON);
    const isLast = this.level >= season.levelCount;
    const dailyFail = result.dailyClean === false;
    const nextLabel = dailyFail
      ? t('game.retry')
      : this.mode === 'daily' || isLast
        ? t('common.back')
        : t('game.next');

    const next = createButton(this, centerX, centerY + panelH * 0.34, {
      width: dailyFail ? 240 : 300,
      height: 76,
      color: COLORS.secondary,
      label: nextLabel,
      onClick: () => {
        if (dailyFail) {
          this.scene.start('GameScene', { mode: 'daily' });
          return;
        }
        this.scene.start('LevelSelectScene');
      },
    });
    next.setDepth(depth + 2);
    next.setAlpha(0);
    next.setScale(0.8);

    const leave = dailyFail
      ? createButton(this, centerX + 200, centerY + panelH * 0.34, {
          width: 160,
          height: 76,
          color: COLORS.danger,
          label: t('common.back'),
          icon: 'arrow-back',
          onClick: () => this.scene.start('LevelSelectScene'),
        })
      : undefined;
    if (leave) {
      leave.setDepth(depth + 2);
      leave.setAlpha(0);
      next.setX(centerX - 100);
    }

    // Заголовок и кнопка «выезжают» после появления панели.
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 260,
      delay: 180,
    });
    this.tweens.add({
      targets: leave ? [next, leave] : next,
      alpha: 1,
      scale: 1,
      duration: 320,
      delay: 520,
      ease: 'Back.out',
    });
  }

  /** Четвёртая звезда за быстрый проход почти без ошибок. */
  private spawnSuperStar(
    x: number,
    y: number,
    size: number,
    depth: number,
  ): void {
    const star = this.createStarShape(size, true, PALETTE.super)
      .setPosition(x, y)
      .setDepth(depth)
      .setScale(0);
    const caption = withStroke(
      this.add
        .text(x, y + size * 0.7, t('game.superStar'), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '22px',
          color: toCss(PALETTE.super),
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(depth)
        .setAlpha(0),
    );
    this.tweens.add({
      targets: star,
      scale: 1,
      duration: 420,
      delay: 780,
      ease: 'Back.out',
    });
    this.tweens.add({
      targets: caption,
      alpha: 1,
      duration: 280,
      delay: 980,
    });
    playChime(this, 'super');
  }

  /** Открытка уровня на панели победы. */
  private showVictorySticker(
    x: number,
    y: number,
    firstClear: boolean,
    depth: number,
  ): void {
    const sticker = stickerForLevel(this.level);
    if (!sticker) return;
    const icon = createStickerIcon(this, sticker, 86, false)
      .setPosition(x - 70, y)
      .setDepth(depth)
      .setScale(0);
    const caption = withStroke(
      this.add
        .text(x + 16, y, firstClear ? t('game.newSticker') : t(sticker.nameKey), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '26px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(depth)
        .setAlpha(0),
    );
    this.tweens.add({
      targets: icon,
      scale: 1,
      duration: 360,
      delay: 640,
      ease: 'Back.out',
    });
    this.tweens.add({
      targets: caption,
      alpha: 1,
      duration: 260,
      delay: 760,
    });
  }

  /** Замедляет все текущие и будущие падения на `ms` миллисекунд. */
  private applySlow(ms: number): void {
    this.fallTimeScale = 0.45;
    this.syncFallScale();
    if (!this.slowVeil) {
      this.slowVeil = this.add
        .rectangle(
          this.scale.width / 2,
          this.scale.height / 2,
          this.scale.width,
          this.scale.height,
          PALETTE.ice,
          0.14,
        )
        .setDepth(3);
    }
    this.slowVeil.setVisible(true);
    this.slowTimer?.remove();
    this.slowTimer = this.time.delayedCall(ms, () => {
      this.fallTimeScale = 1;
      this.syncFallScale();
      this.slowVeil?.setVisible(false);
    });
  }

  /** Подстраивает уже летящие предметы под текущую скорость. */
  private syncFallScale(): void {
    for (const item of this.items) {
      if (item.done) continue;
      const tween = item.container.getData('fallTween') as
        | Phaser.Tweens.Tween
        | null;
      if (tween) tween.timeScale = this.fallTimeScale;
      const aux = item.container.getData('fallAuxTweens') as
        | Phaser.Tweens.Tween[]
        | undefined;
      aux?.forEach((tw) => {
        tw.timeScale = this.fallTimeScale;
      });
    }
  }

  /** Короткое касание: мягко подсвечивает правильную корзину. */
  private showHint(record: FallingObject): void {
    if (record.effect === 'freeze') {
      for (const id of this.baskets.keys()) this.pulseHint(id);
      return;
    }
    this.pulseHint(record.itemId);
  }

  private pulseHint(itemId: string): void {
    const basket = this.baskets.get(itemId);
    if (!basket) return;
    const { highlight, container } = basket;
    highlight.setTint(UI.reward);
    highlight.setVisible(true);
    highlight.setAlpha(0.15);
    this.tweens.add({
      targets: highlight,
      alpha: 0.9,
      duration: 240,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (this.highlightedItem === itemId) return;
        highlight.setVisible(false);
        highlight.setAlpha(0);
      },
    });
    this.tweens.add({
      targets: container,
      scale: 1.08,
      duration: 200,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (this.highlightedItem !== itemId) container.setScale(1);
      },
    });
  }

  /** Надпись по центру экрана: комбо или заморозка. */
  private showFloatText(message: string, color: string, y: number): void {
    const text = withStroke(
      this.add
        .text(this.bounds.centerX, y, message, {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '54px',
          color,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(28)
        .setScale(0.4),
    );
    this.tweens.add({
      targets: text,
      scale: 1,
      duration: 260,
      ease: 'Back.out',
      onComplete: () => {
        this.tweens.add({
          targets: text,
          y: text.y - 48,
          alpha: 0,
          delay: 420,
          duration: 360,
          onComplete: () => text.destroy(),
        });
      },
    });
  }

  /** Кристалл льда, пока нет картинки freeze.png. */
  private makeFreezeCrystal(size: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const r = size * 0.42;
    g.fillStyle(PALETTE.ice, 1);
    g.lineStyle(Math.max(3, size * 0.035), PALETTE.white, 0.95);
    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(r * 0.72, 0);
    g.lineTo(0, r);
    g.lineTo(-r * 0.72, 0);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(PALETTE.white, 0.85);
    g.fillCircle(-r * 0.18, -r * 0.15, r * 0.12);
    return g;
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
    color: number = UI.reward,
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
    const fillColor = filled ? color : UI.onSurface;
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
