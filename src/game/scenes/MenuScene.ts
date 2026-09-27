import Phaser from 'phaser';
import { COLORS, FONTS } from '../theme';
import { createButton } from '../ui/Button';
import { getSafeBounds } from '../safeArea';
import { t, onLanguageChange } from '../i18n';

/**
 * MenuScene — главное меню с крупными кнопками для детей.
 * Раскладка адаптируется под безопасную зону экрана.
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

    this.titleText = this.add
      .text(bounds.centerX, bounds.y + 40, t('menu.title'), {
        fontFamily: FONTS.main,
        fontSize: '84px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.buildButtons(bounds);

    // Пересобираем кнопки при смене языка (чтобы обновились подписи).
    this.unsubscribe = onLanguageChange(() => {
      this.titleText.setText(t('menu.title'));
      this.playButton?.destroy();
      this.settingsButton?.destroy();
      this.buildButtons(bounds);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
    });
  }

  private buildButtons(bounds: Phaser.Geom.Rectangle): void {
    // Кнопки горизонтально, размеры зависят от доступной площади.
    const btnW = Math.min(bounds.width * 0.32, 420);
    const btnH = Math.min(bounds.height * 0.22, 140);
    const btnY = bounds.centerY + bounds.height * 0.1;

    this.playButton = createButton(this, bounds.centerX - btnW * 0.6, btnY, {
      width: btnW,
      height: btnH,
      color: COLORS.primary,
      label: t('menu.play'),
      onClick: () => this.scene.start('LevelSelectScene'),
    });

    this.settingsButton = createButton(this, bounds.centerX + btnW * 0.6, btnY, {
      width: btnW,
      height: btnH,
      color: COLORS.secondary,
      label: t('menu.settings'),
      onClick: () => this.scene.start('SettingsScene'),
    });
  }
}
