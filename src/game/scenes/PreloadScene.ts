import Phaser from 'phaser';
import { getLanguage } from '../i18n';
import { summerAssets } from '../seasons/summer';
import { assetUrl } from '../assets';
import { MUSIC_KEY, SFX_CLICK_KEY } from '../audio';
import { UI } from '../palette';

/**
 * PreloadScene — загрузка ассетов с индикатором прогресса.
 * В детских играх важно показывать, что идёт загрузка.
 *
 * Все рантайм-ассеты лежат в public/assets/ (см. public/assets/README.md).
 * Пути всегда относительные, без ведущего '/'.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    // Логируем ошибки загрузки: без картинки игра рисует цветную заглушку,
    // поэтому «тихий» пропуск ассета легко не заметить.
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(
        '[Preload] Не удалось загрузить ассет:',
        file.key,
        '->',
        (file as Phaser.Loader.File & { src?: string }).src ?? file.url,
      );
    });

    this.createProgressBar();
    this.loadAssets();

    this.load.on('complete', () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * Здесь добавляйте реальные ассеты, ориентируясь на структуру public/assets/.
   */
  private loadAssets(): void {
    const lang = getLanguage();

    // === Изображения ===
    // Фоны -> assets/images/backgrounds/ (пути заданы в seasons/summer.ts)
    for (const asset of summerAssets) {
      if (asset.key && asset.path) {
        this.load.image(asset.key, assetUrl(asset.path));
      }
    }
    // UI -> assets/images/ui/
    this.load.image('lock', assetUrl('assets/images/ui/lock.png'));
    this.load.image('arrow-back', assetUrl('assets/images/ui/arrow-back.png'));
    // this.load.image('button', 'assets/images/ui/button.png');

    // Иллюстрации уровней -> assets/images/levels/
    // this.load.image('level1', 'assets/images/levels/level1.png');

    // === Спрайты и атласы ===
    // Отдельные спрайты -> assets/sprites/
    // this.load.spritesheet('sprites', 'assets/sprites/characters/sprites.png', {
    //   frameWidth: 128,
    //   frameHeight: 128,
    // });

    // Атласы (рекомендуется для множества спрайтов) -> assets/atlases/
    // this.load.atlas(
    //   'game',
    //   'assets/atlases/game.png',
    //   'assets/atlases/game.json',
    // );

    // === Аудио ===
    // Музыка -> assets/audio/music/
    this.load.audio(MUSIC_KEY, assetUrl('assets/audio/music/main_theme.mp3'));

    // Короткие звуки -> assets/audio/sfx/
    this.load.audio(SFX_CLICK_KEY, assetUrl('assets/audio/sfx/klick.mp3'));

    // Аудио-спрайт -> assets/audiosprites/
    // this.load.audioSprite('sfx', 'assets/audiosprites/sfx.json', [
    //   'assets/audiosprites/sfx.m4a',
    //   'assets/audiosprites/sfx.ogg',
    // ]);

    // === Локализованные ассеты ===
    // Озвучка/тексты под текущий язык -> assets/localization/<lang>/
    // this.load.audio('voice_0', `assets/localization/${lang}/voice_0.mp3`);
    void lang;
  }

  private createProgressBar(): void {
    const { width, height } = this.scale;

    const boxW = width * 0.7;
    const boxH = 40;
    const x = width / 2;
    const y = height / 2;

    const border = this.add.graphics();
    border.lineStyle(6, UI.stroke, 0.9);
    border.strokeRoundedRect(x - boxW / 2, y - boxH / 2, boxW, boxH, boxH / 2);

    const bar = this.add.graphics();
    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(UI.stroke, 0.9);
      const pad = 6;
      const w = (boxW - pad * 2) * value;
      bar.fillRoundedRect(
        x - boxW / 2 + pad,
        y - boxH / 2 + pad,
        Math.max(w, 0.001),
        boxH - pad * 2,
        (boxH - pad * 2) / 2,
      );
    });
  }
}

