import Phaser from 'phaser';
import { COLORS, getMainFont } from '../theme';
import { createButton } from '../ui/Button';
import {
  addCartoonSky,
  createRibbon,
  createStars,
  fitRibbonLabel,
} from '../ui/gloss';
import { getSafeBounds } from '../safeArea';
import { t, onLanguageChange, getLanguage } from '../i18n';
import { playBackgroundMusic, syncBackgroundMusic } from '../audio';
import { Progress } from '../progress';
import { ACTIVE_SEASON, getSeason } from '../seasons';

const RIBBON_FONT = 66;

/**
 * MenuScene — главное меню.
 * Лента со звёздами, полоска прогресса и вертикальный ряд глянцевых пилюль.
 */
export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private playButton?: Phaser.GameObjects.Container;
  private settingsButton?: Phaser.GameObjects.Container;
  private unsubscribe?: () => void;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 32);
    addCartoonSky(this);

    createStars(this, bounds.centerX, bounds.y + 48, 3, 3, 72).setDepth(2);

    const ribbon = createRibbon(
      this,
      bounds.centerX,
      bounds.y + 156,
      t('menu.title'),
      RIBBON_FONT,
    );
    ribbon.container.setDepth(2);
    this.titleText = ribbon.label;

    const season = getSeason(ACTIVE_SEASON);
    let earned = 0;
    for (let level = 1; level <= season.levelCount; level++) {
      earned += Progress.getStars(level, ACTIVE_SEASON);
    }

    this.buildButtons(bounds);

    syncBackgroundMusic(this);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      playBackgroundMusic(this);
    });

    this.unsubscribe = onLanguageChange(() => {
      this.titleText.setFontFamily(getMainFont(getLanguage()));
      fitRibbonLabel(
        this.titleText,
        t('menu.title'),
        RIBBON_FONT,
        Math.min(820, bounds.width * 0.7) - 100,
      );
      this.playButton?.destroy();
      this.settingsButton?.destroy();
      this.buildButtons(bounds);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
    });
  }

  private buildButtons(bounds: Phaser.Geom.Rectangle): void {
    const btnW = Math.min(bounds.width * 0.38, 440);
    const btnH = Math.min(bounds.height * 0.16, 108);
    const gap = 24;
    const firstY = bounds.centerY + bounds.height * 0.06;

    this.playButton = createButton(this, bounds.centerX, firstY, {
      width: btnW,
      height: btnH,
      color: COLORS.play,
      label: t('menu.play'),
      onClick: () => this.scene.start('SeasonSelectScene'),
    });
    this.playButton.setDepth(2);

    this.settingsButton = createButton(
      this,
      bounds.centerX,
      firstY + btnH + gap,
      {
        width: btnW,
        height: btnH,
        color: COLORS.options,
        label: t('menu.settings'),
        onClick: () => this.scene.start('SettingsScene'),
      },
    );
    this.settingsButton.setDepth(2);
  }
}
