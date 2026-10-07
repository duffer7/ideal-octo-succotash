import Phaser from 'phaser';
import { COLORS, getMainFont, withStroke } from '../theme';
import { PALETTE, toCss, UI_CSS } from '../palette';
import { getSafeBounds } from '../safeArea';
import { createButton } from '../ui/Button';
import { createRibbon, glossyPlate } from '../ui/gloss';
import { getLanguage, t } from '../i18n';

const RIBBON_FONT = 40;

/**
 * Экран авторов: разработчик и музыка.
 */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create(): void {
    const bounds = getSafeBounds(this.scale, 28);

    const panelW = Math.min(720, bounds.width * 0.62);
    const panelH = Math.min(460, bounds.height * 0.72);
    const panel = glossyPlate(this, panelW, panelH, COLORS.panel, 'panel');
    panel.setPosition(bounds.centerX, bounds.centerY + 8);
    panel.setDepth(1);

    const top = bounds.centerY + 8 - panelH / 2;
    const ribbon = createRibbon(
      this,
      bounds.centerX,
      top + 4,
      t('credits.title'),
      RIBBON_FONT,
    );
    ribbon.container.setDepth(3);

    this.addCredit(
      bounds.centerX,
      top + panelH * 0.38,
      t('credits.developer'),
      t('credits.developerName'),
    );
    this.addCredit(
      bounds.centerX,
      top + panelH * 0.62,
      t('credits.music'),
      t('credits.musicName'),
    );

    createButton(this, bounds.centerX, top + panelH - 72, {
      width: 96,
      height: 88,
      color: COLORS.confirm,
      label: '',
      glyph: 'check',
      onClick: () => this.scene.start('SettingsScene'),
    }).setDepth(3);
  }

  private addCredit(x: number, y: number, role: string, name: string): void {
    const font = getMainFont(getLanguage());
    this.add
      .text(x, y - 28, role.toLocaleUpperCase(), {
        fontFamily: font,
        fontSize: '24px',
        color: toCss(PALETTE.deepPurple),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(3);

    withStroke(
      this.add
        .text(x, y + 16, name, {
          fontFamily: font,
          fontSize: '36px',
          color: UI_CSS.onSurface,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(3),
      toCss(PALETTE.deepPurple),
      5,
    );
  }
}
