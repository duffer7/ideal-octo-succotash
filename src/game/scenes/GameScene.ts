import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { UI, UI_CSS, PALETTE, toCss } from '../palette';
import {
  createBonusStar,
  createRibbon,
  createScoreStar,
  createStripedBar,
  glossyPlate,
  type StripedBar,
} from '../ui/gloss';
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
import {
  bonusLimits,
  bonusRankForSeconds,
  collectPoints,
  formatClock,
  mistakeCost,
  starsFromScore,
  type BonusLimits,
  type BonusStarRank,
} from '../scoring';

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
  /** Время прохождения на экране. */
  private timerText?: Phaser.GameObjects.Text;
  /** Звезда рядом с таймером: какой ранг ещё доступен. */
  private timerStar?: Phaser.GameObjects.Image;
  /** Накопленное время игры, без паузы на диалог выхода. */
  private elapsedMs = 0;
  private timerMark = 0;
  private shownTimerSecond = -1;
  private shownTimerRank: BonusStarRank | 'off' | null = null;
  /** Полоска прогресса до цели уровня. */
  private progressBar?: StripedBar;

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
  /** Множитель скорости падения: 1 обычно, меньше — во время комбо или заморозки. */
  private fallTimeScale = 1;
  private slowTimer?: Phaser.Time.TimerEvent;
  private slowVeil?: Phaser.GameObjects.Rectangle;
  private helper?: Helper;
  /** Чтобы панель победы не открылась дважды. */
  private finished = false;
  /** Гид закрыт и предметы уже падают. */
  private playing = false;
  /** Открыт вопрос «выйти?» — падение стоит. */
  private exitOpen = false;
  /** Падение и спавн поставлены на паузу диалогом выхода. */
  private playPaused = false;
  private backButton?: Phaser.GameObjects.Container;
  /** Объекты гида перед уровнем, чтобы убрать их одним разом. */
  private briefingObjects: Phaser.GameObjects.GameObject[] = [];
  /** Объекты диалога выхода. */
  private exitObjects: Phaser.GameObjects.GameObject[] = [];

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
    this.fallTimeScale = 1;
    this.finished = false;
    this.playing = false;
    this.exitOpen = false;
    this.playPaused = false;
    this.briefingObjects = [];
    this.exitObjects = [];
    this.elapsedMs = 0;
    this.timerMark = 0;
    this.shownTimerSecond = -1;
    this.shownTimerRank = null;
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.spawnTimer?.remove();
    });

    // Короткий гид: какие предметы будут и сколько очков нужно.
    // Падение начнётся, когда игрок нажмёт «Вперёд».
    this.showBriefing();
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
    this.backButton = createButton(this, this.bounds.x + 50, this.bounds.y + 50, {
      width: 88,
      height: 72,
      color: COLORS.danger,
      label: t('common.back'),
      glyph: 'left',
      onClick: () => this.askToLeave(),
    }).setDepth(20);
  }

  private createHud(): void {
    const centerX = this.bounds.centerX;

    const levelTitle =
      this.mode === 'daily'
        ? t('game.dailyTitle')
        : t('game.level', { n: this.level });
    createRibbon(this, centerX, this.bounds.y + 28, levelTitle, 32).container.setDepth(
      20,
    );

    this.progressBar = createStripedBar(
      this,
      centerX,
      this.bounds.y + 78,
      280,
      28,
      0,
    );
    this.progressBar.setDepth(20);

    const scoreChip = glossyPlate(this, 210, 58, PALETTE.gold, 'pill').setDepth(20);
    scoreChip.setPosition(this.bounds.right - 112, this.bounds.y + 36);
    this.scoreText = this.add
      .text(this.bounds.right - 112, this.bounds.y + 34, this.scoreLabel(), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '28px',
        color: toCss(PALETTE.deepPurple),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);
    withStroke(this.scoreText, '#fff6d0', 4);

    const missChip = glossyPlate(this, 168, 50, PALETTE.red, 'pill').setDepth(20);
    missChip.setPosition(this.bounds.right - 92, this.bounds.y + 100);
    this.missesText = this.add
      .text(this.bounds.right - 92, this.bounds.y + 98, this.missesLabel(), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '22px',
        color: UI_CSS.onSurface,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);
    withStroke(this.missesText, undefined, 4);
    this.createTimer();
  }

  /** Часы слева. На обычном уровне рядом — звезда, которую ещё можно успеть. */
  private createTimer(): void {
    const x = this.bounds.x + 248;
    const y = this.bounds.y + 36;
    const daily = this.mode === 'daily';
    const chip = glossyPlate(this, daily ? 150 : 200, 58, PALETTE.deepPurple, 'pill');
    chip.setPosition(x, y).setDepth(20);

    if (!daily) {
      this.timerStar = createBonusStar(this, 'epic', 40)
        .setPosition(x - 64, y)
        .setDepth(21);
    }

    this.timerText = withStroke(
      this.add
        .text(daily ? x : x + 24, y - 1, '0:00', {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '28px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(21),
      undefined,
      4,
    );
  }

  update(): void {
    const now = this.time.now;
    if (this.timerMark > 0 && this.playing && !this.playPaused && !this.finished) {
      this.elapsedMs += now - this.timerMark;
      this.refreshTimer();
    }
    this.timerMark = now;
  }

  private refreshTimer(): void {
    const seconds = Math.floor(this.elapsedMs / 1000);
    const rank =
      this.mode === 'daily'
        ? null
        : bonusRankForSeconds(seconds, this.levelBonusLimits());
    const rankKey = rank ?? 'off';
    if (seconds === this.shownTimerSecond && rankKey === this.shownTimerRank) return;
    this.shownTimerSecond = seconds;
    this.shownTimerRank = rankKey;
    this.timerText?.setText(formatClock(seconds));
    if (!this.timerStar) return;
    const key = rank
      ? rank === 'epic'
        ? 'star-score-epic'
        : rank === 'rare'
          ? 'star-score-rare'
          : 'star-score-basic'
      : 'star-score-inactive';
    this.timerStar.setTexture(key);
    this.timerStar.setDisplaySize(40, 40);
    this.timerStar.setAlpha(rank ? 1 : 0.85);
  }

  private levelBonusLimits(): BonusLimits {
    return bonusLimits(this.config.targetCount, this.config.spawnIntervalMs);
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
  // Гид перед уровнем и подтверждение выхода
  // ---------------------------------------------------------------------------

  /** Можно ли сейчас ловить предметы и начислять очки. */
  private canPlay(): boolean {
    return this.playing && !this.exitOpen && !this.finished && !this.playPaused;
  }

  /**
   * Короткий гид: какие предметы упадут, сколько очков нужно
   * и одно-два правила именно этого уровня.
   */
  private showBriefing(): void {
    const { centerX, centerY } = this.bounds;
    const depth = 32;
    const panelW = Math.min(this.bounds.width * 0.94, 1100);
    const panelH = Math.min(this.bounds.height * 0.94, 680);
    const tracked = this.briefingObjects;

    const dim = this.add
      .rectangle(
        centerX,
        centerY,
        this.scale.width,
        this.scale.height,
        UI.overlay,
        0.55,
      )
      .setDepth(depth)
      .setInteractive();
    tracked.push(dim);

    const plate = glossyPlate(this, panelW, panelH, PALETTE.violet, 'panel')
      .setPosition(centerX, centerY)
      .setDepth(depth + 1);
    tracked.push(plate);

    const top = centerY - panelH / 2;
    const title =
      this.mode === 'daily'
        ? t('game.dailyTitle')
        : t('game.level', { n: this.level });
    const ribbon = createRibbon(this, centerX, top + 10, title, 44);
    ribbon.container.setDepth(depth + 2);
    tracked.push(ribbon.container);

    const goal =
      this.mode === 'daily'
        ? t('guide.dailyGoal', { n: this.config.targetCount })
        : t('guide.goal', { n: this.config.targetScore });
    const goalY = top + 92;
    tracked.push(
      this.overlayText(centerX, goalY, goal, 42, UI_CSS.reward, depth + 2),
    );
    const starsY = goalY + 54;
    tracked.push(
      this.overlayText(
        centerX,
        starsY,
        t('guide.stars'),
        30,
        UI_CSS.onSurface,
        depth + 2,
      ),
    );

    let headerBottom = starsY + 28;
    if (this.mode !== 'daily') {
      headerBottom = this.addBonusGoals(
        centerX,
        starsY + 40,
        panelW,
        depth + 2,
        tracked,
      );
    }

    const items = this.levelItems();
    const cols =
      items.length <= 5 ? Math.max(items.length, 1) : Math.ceil(items.length / 2);
    const rows = Math.ceil(items.length / cols);
    const buttonH = 84;
    const buttonY = centerY + panelH / 2 - buttonH / 2 - 16;
    const cellW = Math.min(240, (panelW - 56) / cols);
    const noteReserve = 70;
    const gridTop = headerBottom + 8;
    const gridBottom = buttonY - buttonH / 2 - 12 - noteReserve;
    const rowH = Math.max(64, (gridBottom - gridTop) / rows);
    const iconSize = Math.round(
      Math.min(cellW * 0.86, rows > 1 ? 120 : 200, Math.max(52, rowH - 40)),
    );
    const gridLeft = centerX - (cols * cellW) / 2;

    items.forEach((def, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = gridLeft + cellW * col + cellW / 2;
      const y = gridTop + row * rowH + iconSize / 2;
      tracked.push(this.createGuideCard(x, y, iconSize, def, depth + 2));
    });

    const noteSize = 28;
    const note = this.overlayText(
      centerX,
      gridBottom + 8,
      this.guideNote(),
      noteSize,
      UI_CSS.onSurface,
      depth + 2,
      panelW - 80,
    );
    note.setOrigin(0.5, 0);
    const maxNoteBottom = buttonY - buttonH / 2 - 12;
    if (note.y + note.height > maxNoteBottom) {
      const fitted = Math.max(
        20,
        Math.floor(noteSize * ((maxNoteBottom - note.y) / note.height)),
      );
      note.setFontSize(fitted);
    }
    tracked.push(note);

    const start = createButton(this, centerX, buttonY, {
      width: 320,
      height: buttonH,
      color: COLORS.confirm,
      label: t('guide.start'),
      onClick: () => this.time.delayedCall(0, () => this.beginPlay()),
    }).setDepth(depth + 3);
    tracked.push(start);

    // Кнопка «назад» остаётся поверх гида.
    this.backButton?.setDepth(48);
    this.fadeIn(tracked);
  }

  /**
   * Три порога цветной звезды. Возвращает нижнюю границу блока,
   * чтобы сетка предметов начиналась ниже.
   */
  private addBonusGoals(
    centerX: number,
    y: number,
    panelW: number,
    depth: number,
    tracked: Phaser.GameObjects.GameObject[],
  ): number {
    tracked.push(
      this.overlayText(
        centerX,
        y,
        t('guide.bonus'),
        22,
        UI_CSS.onSurface,
        depth,
        panelW - 80,
      ),
    );

    const limits = this.levelBonusLimits();
    const ranks: BonusStarRank[] = ['epic', 'rare', 'basic'];
    const label: Record<BonusStarRank, 'guide.bonus.epic' | 'guide.bonus.rare' | 'guide.bonus.basic'> = {
      epic: 'guide.bonus.epic',
      rare: 'guide.bonus.rare',
      basic: 'guide.bonus.basic',
    };
    const colors: Record<BonusStarRank, string> = {
      epic: toCss(PALETTE.violet),
      rare: toCss(PALETTE.blue),
      basic: toCss(PALETTE.green),
    };
    const rowY = y + 46;
    const gap = Math.min(300, (panelW - 48) / 3);

    ranks.forEach((rank, index) => {
      const x = centerX + (index - 1) * gap;
      const star = createBonusStar(this, rank, 36)
        .setPosition(x, rowY)
        .setDepth(depth);
      const name = this.overlayText(x, rowY + 26, t(label[rank]), 20, colors[rank], depth);
      const time = this.overlayText(
        x,
        rowY + 48,
        t('guide.bonus.until', { time: formatClock(limits[rank]) }),
        20,
        UI_CSS.onSurface,
        depth,
      );
      tracked.push(star, name, time);
    });

    return rowY + 66;
  }

  /** Подсказка гида: базовое правило и то, что особенного на этом уровне. */
  private guideNote(): string {
    const ids = new Set(this.levelItems().map((item) => item.id));
    const extra: string[] = [];
    if (this.mode === 'daily') extra.push(t('guide.tip.daily'));
    if (ids.has('rock')) extra.push(t('guide.tip.rocks'));
    if (ids.has('trash')) extra.push(t('guide.tip.trash'));
    if (ids.has('freeze')) extra.push(t('guide.tip.freeze'));
    if (extra.length === 0) extra.push(t('guide.tip.combo'));
    return [t('guide.tip.match'), ...extra.slice(0, 2)].join(' ');
  }

  /** Карточка предмета в гиде: картинка и цена (или «мимо» / «любая»). */
  private createGuideCard(
    x: number,
    y: number,
    iconSize: number,
    def: FallingItem,
    depth: number,
  ): Phaser.GameObjects.Container {
    const icon = this.guideIcon(def, iconSize);
    const caption = this.guideCaption(def);
    const label = withStroke(
      this.add
        .text(0, iconSize / 2 + 6, caption.text, {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '28px',
          color: caption.color,
          fontStyle: 'bold',
          align: 'center',
        })
        .setOrigin(0.5, 0),
      undefined,
      5,
    );
    return this.add.container(x, y, [icon, label]).setDepth(depth);
  }

  private guideCaption(def: FallingItem): { text: string; color: string } {
    if (def.effect === 'freeze') {
      return {
        text: `+${def.points ?? 0} ${t('guide.any')}`,
        color: toCss(PALETTE.ice),
      };
    }
    if ((def.points ?? 0) <= 0) {
      return { text: t('guide.skip'), color: UI_CSS.onSurface };
    }
    return { text: `+${def.points}`, color: UI_CSS.reward };
  }

  /** Картинка предмета для гида. У мусора показываем оба вида. */
  private guideIcon(
    def: FallingItem,
    size: number,
  ): Phaser.GameObjects.GameObject {
    const keys = [
      def.image?.key,
      ...(def.images?.map((img) => img.key) ?? []),
    ].filter((key): key is string => !!key && this.textures.exists(key));
    const unique = [...new Set(keys)];
    const showPair = (def.points ?? 0) > 0 && unique.length > 1;
    const chosen = (showPair ? unique : unique.slice(0, 1)).slice(0, 2);

    if (chosen.length === 0) {
      if (def.effect === 'freeze') return this.makeFreezeCrystal(size);
      const circle = this.add.circle(0, 0, size / 2, def.color);
      circle.setStrokeStyle(4, UI.stroke, 0.85);
      return circle;
    }

    if (chosen.length === 1) {
      return this.makeOutlinedImage(
        chosen[0],
        size,
        PALETTE.deepPurple,
        Math.max(1.5, size * 0.02),
      );
    }

    const iconSize = size * 0.78;
    return this.add.container(
      0,
      0,
      chosen.map((key, i) => {
        const icon = this.makeOutlinedImage(
          key,
          iconSize,
          PALETTE.deepPurple,
          Math.max(1.5, iconSize * 0.02),
        );
        icon.setPosition((i === 0 ? -1 : 1) * iconSize * 0.34, 0);
        return icon;
      }),
    );
  }

  /** Закрывает гид и запускает падение. */
  private beginPlay(): void {
    if (this.playing || this.exitOpen || this.finished) return;
    this.destroyTracked(this.briefingObjects);
    this.backButton?.setDepth(20);
    this.playing = true;
    this.elapsedMs = 0;
    this.timerMark = this.time.now;
    this.shownTimerSecond = -1;
    this.refreshTimer();

    this.spawnTimer = this.time.addEvent({
      delay: this.config.spawnIntervalMs,
      callback: () => this.spawnItem(),
      loop: true,
    });
    this.time.delayedCall(600, () => this.spawnItem());
  }

  /** Вопрос перед выходом. На экране победы уходим сразу — результат уже сохранён. */
  private askToLeave(): void {
    if (this.exitOpen) return;
    if (this.finished) {
      this.scene.start('LevelSelectScene');
      return;
    }
    this.exitOpen = true;
    this.pauseGameplay();
    this.showExitDialog();
  }

  private showExitDialog(): void {
    const { centerX, centerY } = this.bounds;
    const depth = 70;
    const panelW = Math.min(this.bounds.width * 0.7, 640);
    const panelH = Math.min(this.bounds.height * 0.48, 340);
    const tracked = this.exitObjects;

    const dim = this.add
      .rectangle(
        centerX,
        centerY,
        this.scale.width,
        this.scale.height,
        UI.overlay,
        0.45,
      )
      .setDepth(depth)
      .setInteractive();
    tracked.push(dim);

    const plate = glossyPlate(this, panelW, panelH, PALETTE.violet, 'panel')
      .setPosition(centerX, centerY)
      .setDepth(depth + 1);
    tracked.push(plate);

    const top = centerY - panelH / 2;
    const ribbon = createRibbon(this, centerX, top + 10, t('exit.title'), 36);
    ribbon.container.setDepth(depth + 2);
    tracked.push(ribbon.container);

    const body = this.overlayText(
      centerX,
      centerY - 8,
      t('exit.body'),
      26,
      UI_CSS.onSurface,
      depth + 2,
      panelW - 100,
    );
    tracked.push(body);

    const buttonY = centerY + panelH / 2 - 64;
    const stay = createButton(this, centerX - 130, buttonY, {
      width: 220,
      height: 72,
      color: COLORS.confirm,
      label: t('exit.stay'),
      onClick: () => this.time.delayedCall(0, () => this.closeExit(false)),
    }).setDepth(depth + 3);
    const leave = createButton(this, centerX + 130, buttonY, {
      width: 220,
      height: 72,
      color: COLORS.danger,
      label: t('exit.leave'),
      onClick: () => this.time.delayedCall(0, () => this.closeExit(true)),
    }).setDepth(depth + 3);
    tracked.push(stay, leave);
    this.fadeIn(tracked);
  }

  private closeExit(leave: boolean): void {
    if (!this.exitOpen) return;
    this.destroyTracked(this.exitObjects);
    this.exitOpen = false;
    if (leave) {
      this.scene.start('LevelSelectScene');
      return;
    }
    this.resumeGameplay();
  }

  /** Останавливает спавн и падение, пока открыт вопрос о выходе. */
  private pauseGameplay(): void {
    if (!this.playing || this.playPaused) return;
    this.playPaused = true;
    if (this.spawnTimer) this.spawnTimer.paused = true;
    if (this.slowTimer) this.slowTimer.paused = true;
    for (const item of this.items) {
      if (!item.done) this.pauseFall(item.container);
    }
  }

  private resumeGameplay(): void {
    if (!this.playPaused) return;
    this.playPaused = false;
    if (this.spawnTimer) this.spawnTimer.paused = false;
    if (this.slowTimer) this.slowTimer.paused = false;
    for (const item of this.items) {
      if (!item.done) this.resumeFall(item);
    }
  }

  private overlayText(
    x: number,
    y: number,
    message: string,
    fontSize: number,
    color: string,
    depth: number,
    wrap?: number,
  ): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, message, {
        fontFamily: getMainFont(getLanguage()),
        fontSize: `${fontSize}px`,
        color,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined,
      })
      .setOrigin(0.5)
      .setDepth(depth);
    return withStroke(text, undefined, Math.max(4, fontSize * 0.16));
  }

  private fadeIn(objects: Phaser.GameObjects.GameObject[]): void {
    for (const obj of objects) {
      if ('setAlpha' in obj) {
        (obj as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
      }
    }
    this.tweens.add({ targets: objects, alpha: 1, duration: 180 });
  }

  private destroyTracked(list: Phaser.GameObjects.GameObject[]): void {
    for (const obj of list) obj.destroy();
    list.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Падающие объекты
  // ---------------------------------------------------------------------------

  /** Создаёт падающий объект сверху и запускает его движение вниз. */
  private spawnItem(): void {
    if (!this.canPlay()) return;
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
        // Диалог выхода или гид: бросок не считается, предмет снова падает.
        if (!this.canPlay()) {
          if (!record.done) this.resumeFall(record);
          return;
        }
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

  /** Предметы, которые падают на этом уровне. */
  private levelItems(): FallingItem[] {
    return summerItems.filter(
      (item) => item.fromLevel === undefined || item.fromLevel <= this.level,
    );
  }

  /**
   * Выбирает определение объекта по весам (`weight`).
   * Камни и мусор заданы с низким весом — падают реже остальных предметов.
   */
  private pickItemDef(): FallingItem {
    const defs = this.levelItems();
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
    const goal =
      this.mode === 'daily' ? this.config.targetCount : this.config.targetScore;
    const current = this.mode === 'daily' ? this.sorted : this.netScore();
    this.progressBar?.setValue(goal > 0 ? current / goal : 0);
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
        bonus: null,
        firstClear: false,
        dailyClean: clean,
      });
      return;
    }

    // Звёзды — по доле сохранённых очков, а не по числу ошибок.
    const stars = starsFromScore(this.gained, this.lost);
    // Цветная звезда — только вместе с тремя обычными, ранг зависит от времени.
    const seconds = Math.floor(this.elapsedMs / 1000);
    const bonus =
      stars === 3 ? bonusRankForSeconds(seconds, this.levelBonusLimits()) : null;
    const firstClear = Progress.getStars(this.level, ACTIVE_SEASON) === 0;
    Progress.setResult(this.level, stars, ACTIVE_SEASON, bonus);

    this.showVictoryPanel({ stars, bonus, firstClear, dailyClean: null });
  }

  /**
   * Панель победы: затемнение экрана, «дышащее» свечение, анимированные звёзды
   * и кнопка перехода. Появляется каскадом снизу вверх для живости.
   */
  private showVictoryPanel(result: {
    stars: number;
    bonus: BonusStarRank | null;
    firstClear: boolean;
    /** null — обычный уровень. true/false — итог ежедневного задания. */
    dailyClean: boolean | null;
  }): void {
    const { centerX, centerY } = this.bounds;
    const panelW = Math.min(this.bounds.width * 0.86, 680);
    const panelH = Math.min(this.bounds.height * 0.72, 560);
    const depth = 30;

    // 1. Затемняем игровое поле, чтобы фокус был на результате.
    const dim = this.add
      .rectangle(centerX, centerY, this.scale.width, this.scale.height, UI.overlay, 0.55)
      .setDepth(depth)
      .setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 220 });

    // 2. Фиолетовая глянцевая панель, как экран «Completed».
    const plate = glossyPlate(this, panelW, panelH, PALETTE.violet, 'panel');
    const panelContainer = this.add
      .container(centerX, centerY, [plate])
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

    // 3. Жёлтая лента с заголовком и строка уровня под ней.
    const titleKey =
      result.dailyClean === null
        ? 'game.wellDone'
        : result.dailyClean
          ? 'game.dailyWin'
          : 'game.dailyAlmost';
    const title = createRibbon(
      this,
      centerX,
      centerY - panelH * 0.42,
      t(titleKey),
      Math.round(panelH * 0.075),
    ).container.setDepth(depth + 2);
    title.setAlpha(0);

    const levelLine = withStroke(
      this.add
        .text(
          centerX,
          centerY - panelH * 0.26,
          (this.mode === 'daily'
            ? t('game.dailyTitle')
            : t('game.level', { n: this.level })
          ).toLocaleUpperCase(),
          {
            fontFamily: getMainFont(getLanguage()),
            fontSize: '32px',
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

    // 4. Ряд звёзд под заголовком — рисуем векторно и анимируем каскадом.
    const starSize = panelH * 0.13;
    const gap = starSize * 1.12;
    const starsY = centerY - panelH * 0.08;
    this.createVictoryStars(
      centerX,
      starsY,
      result.stars,
      starSize,
      gap,
      depth + 2,
    );
    if (result.bonus) {
      this.spawnSuperStar(
        centerX,
        starsY - starSize * 1.08,
        starSize,
        depth + 3,
        result.bonus,
      );
    }
    if (result.dailyClean === null) {
      const scoreLine = withStroke(
        this.add
          .text(
            centerX,
            centerY + panelH * 0.05,
            t('game.score', { n: this.netScore() }).toLocaleUpperCase(),
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
      this.showVictorySticker(centerX, centerY + panelH * 0.2, result.firstClear, depth + 2);
    }

    // 5. Кнопка перехода.
    const season = getSeason(ACTIVE_SEASON);
    const isLast = this.level >= season.levelCount;
    const dailyFail = result.dailyClean === false;
    const leaveToMap = this.mode === 'daily' || dailyFail || isLast;
    const nextLabel = leaveToMap ? t('common.back') : t('game.next');

    const buttonY = centerY + panelH * 0.38;
    const replay = createButton(this, centerX - 150, buttonY, {
      width: 84,
      height: 84,
      color: COLORS.confirm,
      label: '',
      glyph: 'replay',
      onClick: () => {
        this.scene.start(
          'GameScene',
          this.mode === 'daily' ? { mode: 'daily' } : { level: this.level },
        );
      },
    });
    const next = createButton(this, centerX + 70, buttonY, {
      width: leaveToMap ? 160 : 250,
      height: 76,
      color: leaveToMap ? COLORS.danger : COLORS.confirm,
      label: nextLabel,
      glyph: leaveToMap ? 'left' : undefined,
      onClick: () => this.scene.start('LevelSelectScene'),
    });
    replay.setDepth(depth + 2);
    next.setDepth(depth + 2);
    replay.setAlpha(0);
    next.setAlpha(0);
    replay.setScale(0.8);
    next.setScale(0.8);

    // Заголовок и кнопки появляются после панели.
    this.tweens.add({
      targets: [title, levelLine],
      alpha: 1,
      duration: 260,
      delay: 180,
    });
    this.tweens.add({
      targets: [replay, next],
      alpha: 1,
      scale: 1,
      duration: 320,
      delay: 520,
      ease: 'Back.out',
    });
  }

  /** Цветная звезда над рядом за быстрый проход с тремя обычными. */
  private spawnSuperStar(
    x: number,
    y: number,
    size: number,
    depth: number,
    rank: BonusStarRank,
  ): void {
    const color =
      rank === 'epic'
        ? PALETTE.violet
        : rank === 'rare'
          ? PALETTE.blue
          : PALETTE.green;
    const captionKey =
      rank === 'epic'
        ? 'game.bonus.epic'
        : rank === 'rare'
          ? 'game.bonus.rare'
          : 'game.bonus.basic';
    const star = this.add
      .container(x, y, [createBonusStar(this, rank, size)])
      .setDepth(depth)
      .setScale(0);
    const caption = withStroke(
      this.add
        .text(x, y + size * 0.7, t(captionKey), {
          fontFamily: getMainFont(getLanguage()),
          fontSize: '22px',
          color: toCss(color),
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
   * Ряд звёзд результата: золотые — заработанные, пустые — оставшиеся.
   * Каждая появляется каскадом с «подскоком», заработанные мягко пульсируют.
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
      const star = this.add
        .container(startX + i * gap, centerY, [createScoreStar(this, filled, size)])
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

}
