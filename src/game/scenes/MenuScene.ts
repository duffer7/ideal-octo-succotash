import Phaser from 'phaser';
import { COLORS, FONTS } from '../theme';
import { createButton } from '../ui/Button';
import { getSafeBounds } from '../safeArea';

/**
 * MenuScene — главное меню с крупными кнопками для детей.
 * Раскладка адаптируется под безопасную зону экрана.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 32);
    this.add
      .text(bounds.centerX, bounds.y + 40, 'Обучающая игра', {
        fontFamily: FONTS.main,
        fontSize: '84px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    // Кнопки горизонтально, размеры зависят от доступной площади.
    const btnW = Math.min(bounds.width * 0.32, 420);
    const btnH = Math.min(bounds.height * 0.22, 140);
    const btnY = bounds.centerY + bounds.height * 0.1;

    createButton(this, bounds.centerX - btnW * 0.6, btnY, {
      width: btnW,
      height: btnH,
      color: COLORS.primary,
      label: 'Играть',
      onClick: () => this.scene.start('LevelSelectScene'),
    });

    createButton(this, bounds.centerX + btnW * 0.6, btnY, {
      width: btnW,
      height: btnH,
      color: COLORS.secondary,
      label: 'Настройки',
      onClick: () => {
      // TODO: экран настроек
      },
    });
  }
}

