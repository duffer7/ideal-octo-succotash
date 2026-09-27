import Phaser from 'phaser';
import { COLORS, getMainFont } from '../theme';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import {
  LANGUAGES,
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  getLanguage,
  onLanguageChange,
  setLanguage,
  t,
  type Language,
} from '../i18n';

/**
 * SettingsScene — настройки игры.
 * Пока содержит один пункт: выбор языка (русский / английский).
 * Выбор сохраняется в localStorage через модуль i18n.
 */
export class SettingsScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private languageLabel!: Phaser.GameObjects.Text;
  /** Кнопки выбора языка с их контейнерами (для подсветки активного). */
  private languageButtons: { lang: Language; container: Phaser.GameObjects.Container }[] = [];
  private unsubscribe?: () => void;

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 32);

    // Кнопка «назад».
    createButton(this, bounds.x + 50, bounds.y + 50, {
      width: 90,
      height: 72,
      color: COLORS.danger,
      label: t('common.back'),
      onClick: () => this.scene.start('MenuScene'),
    });

    // Заголовок.
    this.titleText = this.add
      .text(bounds.centerX, bounds.y + 20, t('settings.title'), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '64px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    // Подпись «Язык».
    this.languageLabel = this.add
      .text(bounds.centerX, bounds.centerY - 120, t('settings.language'), {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '40px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Кнопки выбора языка — в ряд по центру.
    const btnW = Math.min(bounds.width * 0.3, 380);
    const btnH = Math.min(bounds.height * 0.35, 160);
    const gap = 40;
    const totalW = btnW * LANGUAGES.length + gap * (LANGUAGES.length - 1);
    const startX = bounds.centerX - totalW / 2 + btnW / 2;

    this.languageButtons = [];
    LANGUAGES.forEach((lang, i) => {
      const container = this.createLanguageButton(
        startX + i * (btnW + gap),
        bounds.centerY + 20,
        btnW,
        btnH,
        lang,
      );
      this.languageButtons.push({ lang, container });
    });

    this.refreshLanguageButtons();

    // Обновляем тексты, если язык меняется (например, из другого места).
    this.unsubscribe = onLanguageChange(() => {
      this.refreshTexts();
      this.refreshLanguageButtons();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
    });
  }

  /** Кнопка-карточка с флагом и названием языка. */
  private createLanguageButton(
    x: number,
    y: number,
    w: number,
    h: number,
    lang: Language,
  ): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    this.drawButtonBg(bg, w, h, COLORS.secondary);

    const flag = this.add
      .text(0, -h * 0.12, LANGUAGE_FLAGS[lang], {
        fontFamily: getMainFont(getLanguage()),
        fontSize: `${h * 0.34}px`,
      })
      .setOrigin(0.5);

    const label = this.add
      .text(0, h * 0.24, LANGUAGE_LABELS[lang], {
        fontFamily: getMainFont(lang),
        fontSize: `${h * 0.2}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [bg, flag, label]);
    container.setSize(w, h);
    container.setData('bg', bg);
    container.setData('flag', flag);
    container.setData('label', label);
    container.setData('w', w);
    container.setData('h', h);
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.input!.cursor = 'pointer';

    container.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        scale: 0.94,
        duration: 80,
        yoyo: true,
        onComplete: () => setLanguage(lang),
      });
    });

    return container;
  }

  private drawButtonBg(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    color: number,
  ): void {
    g.clear();
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(h / 3, w / 3));
    g.fillStyle(0x000000, 0.15);
    g.fillRoundedRect(-w / 2, h / 2 - h * 0.14, w, h * 0.14, {
      tl: 0,
      tr: 0,
      bl: Math.min(h / 3, w / 3),
      br: Math.min(h / 3, w / 3),
    });
  }

  /** Подсвечивает активный язык, остальные — приглушает. */
  private refreshLanguageButtons(): void {
    const active = getLanguage();
    for (const { lang, container } of this.languageButtons) {
      const bg = container.getData('bg') as Phaser.GameObjects.Graphics;
      const w = container.getData('w') as number;
      const h = container.getData('h') as number;
      const isActive = lang === active;
      this.drawButtonBg(bg, w, h, isActive ? COLORS.primary : COLORS.secondary);
      bg.setAlpha(isActive ? 1 : 0.55);
    }
  }

  /** Обновляет текстовые надписи на текущий язык. */
  private refreshTexts(): void {
    const font = getMainFont(getLanguage());
    this.titleText.setText(t('settings.title'));
    this.titleText.setFontFamily(font);
    this.languageLabel.setText(t('settings.language'));
    this.languageLabel.setFontFamily(font);

    // Метки на кнопках языков используют шрифт своего языка.
    for (const { lang, container } of this.languageButtons) {
      const label = container.getData('label') as Phaser.GameObjects.Text;
      label.setFontFamily(getMainFont(lang));
    }
  }
}
