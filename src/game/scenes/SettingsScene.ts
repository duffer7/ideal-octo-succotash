import Phaser from 'phaser';
import { COLORS, getMainFont } from '../theme';
import { PALETTE, toCss } from '../palette';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import {
  createGear,
  createRibbon,
  createStripedBar,
  fitRibbonLabel,
  glossyPlate,
} from '../ui/gloss';
import {
  getMusicVolume,
  getSfxVolume,
  onMusicChange,
  onSfxChange,
  playClickSound,
  setMusicVolume,
  setSfxVolume,
  syncBackgroundMusic,
} from '../audio';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  getLanguage,
  onLanguageChange,
  setLanguage,
  t,
  type Language,
} from '../i18n';

const RIBBON_FONT = 40;

/**
 * SettingsScene — панель настроек: язык со стрелками,
 * ползунки музыки и остальных звуков, кнопка авторов.
 */
export class SettingsScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private languageLabel!: Phaser.GameObjects.Text;
  private languageValue!: Phaser.GameObjects.Text;
  private musicLabel!: Phaser.GameObjects.Text;
  private soundsLabel!: Phaser.GameObjects.Text;
  private setMusicFill!: (amount: number) => void;
  private setSoundsFill!: (amount: number) => void;
  private creditsButton?: Phaser.GameObjects.Container;
  private creditsX = 0;
  private creditsY = 0;
  private dragging: 'music' | 'sfx' | null = null;
  /** Пока жест, открывший сцену, не отпущен — ползунки не трогаем. */
  private ignoreVolumeInput = true;
  private unsubscribe?: () => void;
  private unsubscribeMusic?: () => void;
  private unsubscribeSfx?: () => void;
  private onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerUp?: () => void;

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 28);

    const panelW = Math.min(820, bounds.width * 0.72);
    const panelH = Math.min(640, bounds.height * 0.92);
    const panel = glossyPlate(this, panelW, panelH, COLORS.panel, 'panel');
    panel.setPosition(bounds.centerX, bounds.centerY + 8);
    panel.setDepth(1);

    const top = bounds.centerY + 8 - panelH / 2;

    const ribbon = createRibbon(
      this,
      bounds.centerX,
      top + 4,
      t('settings.title'),
      RIBBON_FONT,
    );
    ribbon.container.setDepth(3);
    this.titleText = ribbon.label;

    createGear(this, bounds.centerX, top + 68, 22).setDepth(3);

    const rowW = Math.min(560, panelW * 0.78);
    const header = 108;
    const footer = 124;
    const rowH = (panelH - header - footer) / 3;
    const rowY = (index: number): number => top + header + rowH * index;
    const controlY = (index: number): number => rowY(index) + rowH * 0.62;
    const labelY = (index: number): number => controlY(index) - (index === 0 ? 64 : 50);

    this.languageLabel = this.makeRowLabel(bounds.centerX, labelY(0));
    this.languageValue = this.makeLanguageRow(bounds.centerX, controlY(0), rowW);

    this.musicLabel = this.makeRowLabel(bounds.centerX, labelY(1));
    this.setMusicFill = this.makeVolumeSlider(
      bounds.centerX,
      controlY(1),
      rowW,
      'music',
      getMusicVolume,
      setMusicVolume,
    );

    this.soundsLabel = this.makeRowLabel(bounds.centerX, labelY(2));
    this.setSoundsFill = this.makeVolumeSlider(
      bounds.centerX,
      controlY(2),
      rowW,
      'sfx',
      getSfxVolume,
      setSfxVolume,
    );

    const btn = 88;
    const actionsY = top + panelH - 70;
    createButton(this, bounds.centerX - 200, actionsY, {
      width: btn,
      height: btn,
      color: COLORS.confirm,
      label: '',
      glyph: 'check',
      onClick: () => this.scene.start('MenuScene'),
    }).setDepth(3);

    this.creditsX = bounds.centerX;
    this.creditsY = actionsY;

    createButton(this, bounds.centerX + 200, actionsY, {
      width: btn,
      height: btn,
      color: COLORS.danger,
      label: '',
      glyph: 'cross',
      onClick: () => this.scene.start('MenuScene'),
    }).setDepth(3);

    this.refreshTexts();

    this.onPointerMove = (pointer) => {
      if (this.ignoreVolumeInput || !pointer.isDown || !this.dragging) return;
      this.applyDrag(pointer);
    };
    this.onPointerUp = () => {
      if (this.dragging === 'sfx' && !this.ignoreVolumeInput) playClickSound(this);
      this.dragging = null;
      this.ignoreVolumeInput = false;
    };
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp);
    this.time.delayedCall(0, () => {
      if (!this.input.activePointer.isDown) this.ignoreVolumeInput = false;
    });

    this.unsubscribe = onLanguageChange(() => this.refreshTexts());
    this.unsubscribeMusic = onMusicChange(() => {
      this.setMusicFill(getMusicVolume());
      syncBackgroundMusic(this);
    });
    this.unsubscribeSfx = onSfxChange(() => {
      this.setSoundsFill(getSfxVolume());
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribeMusic?.();
      this.unsubscribeSfx?.();
      if (this.onPointerMove) {
        this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove);
      }
      if (this.onPointerUp) {
        this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp);
        this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp);
      }
    });
  }

  private makeRowLabel(x: number, y: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, '', {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '28px',
        color: toCss(PALETTE.deepPurple),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  /** Название языка между стрелками, без полоски. */
  private makeLanguageRow(
    x: number,
    y: number,
    width: number,
  ): Phaser.GameObjects.Text {
    const arrow = 72;
    createButton(this, x - width / 2, y, {
      width: arrow,
      height: arrow,
      color: COLORS.options,
      label: '',
      glyph: 'left',
      onClick: () => this.cycleLanguage(-1),
    }).setDepth(3);
    createButton(this, x + width / 2, y, {
      width: arrow,
      height: arrow,
      color: COLORS.primary,
      label: '',
      glyph: 'right',
      onClick: () => this.cycleLanguage(1),
    }).setDepth(3);

    return this.add
      .text(x, y, '', {
        fontFamily: getMainFont(getLanguage()),
        fontSize: '34px',
        color: toCss(PALETTE.deepPurple),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(5);
  }

  /**
   * Полоска громкости: нажатие и перетаскивание ставят уровень,
   * левый край выключает звук полностью.
   */
  private makeVolumeSlider(
    x: number,
    y: number,
    width: number,
    kind: 'music' | 'sfx',
    getVolume: () => number,
    setVolume: (volume: number) => void,
  ): (amount: number) => void {
    const height = 52;
    const bar = createStripedBar(this, x, y, width, height, getVolume());
    bar.setDepth(4);

    const knobSize = 62;
    const knob = glossyPlate(this, knobSize, knobSize, PALETTE.gold, 'pill');
    knob.setDepth(6);

    const place = (amount: number): void => {
      const travel = Math.max(0, width - knobSize);
      knob.setPosition(x - travel / 2 + travel * amount, y);
      bar.setValue(amount);
    };
    place(getVolume());

    const zone = this.add
      .zone(x, y, width, knobSize + 20)
      .setInteractive({ useHandCursor: true })
      .setDepth(7);
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.ignoreVolumeInput) return;
      this.dragging = kind;
      this.sliderAt.set(kind, { x, width, setVolume });
      this.applyDrag(pointer);
    });

    return place;
  }

  private sliderAt = new Map<
    'music' | 'sfx',
    { x: number; width: number; setVolume: (volume: number) => void }
  >();

  private applyDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    const slider = this.sliderAt.get(this.dragging);
    if (!slider) return;
    const amount = Phaser.Math.Clamp(
      (pointer.worldX - (slider.x - slider.width / 2)) / slider.width,
      0,
      1,
    );
    slider.setVolume(amount);
  }

  private placeCreditsButton(): void {
    this.creditsButton?.destroy();
    this.creditsButton = createButton(this, this.creditsX, this.creditsY, {
      width: 240,
      height: 72,
      color: COLORS.accent,
      label: t('settings.credits'),
      fontSize: 28,
      onClick: () => this.scene.start('CreditsScene'),
    }).setDepth(3);
  }

  private cycleLanguage(dir: -1 | 1): void {
    const index = LANGUAGES.indexOf(getLanguage());
    const next = LANGUAGES[
      (index + dir + LANGUAGES.length) % LANGUAGES.length
    ] as Language;
    setLanguage(next);
  }

  private refreshTexts(): void {
    const font = getMainFont(getLanguage());
    this.titleText.setFontFamily(font);
    fitRibbonLabel(this.titleText, t('settings.title'), RIBBON_FONT, 640);
    this.languageLabel.setText(t('settings.language').toLocaleUpperCase());
    this.languageLabel.setFontFamily(font);
    this.languageValue.setText(LANGUAGE_LABELS[getLanguage()]);
    this.languageValue.setFontFamily(font);
    this.musicLabel.setText(t('settings.music').toLocaleUpperCase());
    this.musicLabel.setFontFamily(font);
    this.soundsLabel.setText(t('settings.sounds').toLocaleUpperCase());
    this.soundsLabel.setFontFamily(font);
    this.setMusicFill(getMusicVolume());
    this.setSoundsFill(getSfxVolume());
    this.placeCreditsButton();
  }
}
