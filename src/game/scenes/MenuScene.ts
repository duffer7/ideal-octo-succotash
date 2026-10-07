import Phaser from 'phaser';
import { COLORS } from '../theme';
import { createButton } from '../ui/Button';
import { addMainBackground, openingCloudEntrance } from '../ui/mainBackground';
import { SkyScene } from './SkyScene';
import { getSafeBounds } from '../safeArea';
import { t, onLanguageChange, getLanguage } from '../i18n';
import { playBackgroundMusic, syncBackgroundMusic } from '../audio';

/**
 * MenuScene — главное меню.
 * Слои неба, логотип языка и вертикальный ряд глянцевых пилюль.
 */
export class MenuScene extends Phaser.Scene {
  private playButton?: Phaser.GameObjects.Container;
  private settingsButton?: Phaser.GameObjects.Container;
  private unsubscribe?: () => void;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 32);
    const firstOpen = openingCloudEntrance();
    (this.scene.get('SkyScene') as SkyScene).presentForMenu(firstOpen);
    const background = addMainBackground(this, {
      logo: true,
      cloudsFromEdges: firstOpen,
      skipSky: true,
    });

    this.buildButtons(bounds);

    syncBackgroundMusic(this);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      playBackgroundMusic(this);
    });

    this.unsubscribe = onLanguageChange(() => {
      background.setLanguage(getLanguage());
      this.playButton?.destroy();
      this.settingsButton?.destroy();
      this.buildButtons(bounds);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      (this.scene.get('SkyScene') as SkyScene).hideMenuStars();
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
