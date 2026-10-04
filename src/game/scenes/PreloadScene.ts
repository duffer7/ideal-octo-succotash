import Phaser from 'phaser';
import { getLanguage } from '../i18n';
import { summerAssets } from '../seasons/summer';
import { STICKER_ASSETS } from '../stickers';
import { CRAB_ASSETS } from '../characters/Helper';
import { assetUrl } from '../assets';
import { MUSIC_KEY, MUSIC_TRACKS, SFX_CLICK_KEY } from '../audio';
import { addCartoonSky, createStripedBar } from '../ui/gloss';

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
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(
        '[Preload] Не удалось загрузить ассет:',
        file.key,
        '->',
        (file as Phaser.Loader.File & { src?: string }).src ?? file.url,
      );
    });

    addCartoonSky(this);
    const bar = createStripedBar(
      this,
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width * 0.46,
      40,
      0,
    );
    this.load.on('progress', (value: number) => bar.setValue(value));
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
    // Открытки и краб. Пока файлов нет — в консоли будет предупреждение,
    // а игра нарисует заглушку. Когда картинки появятся, подхватятся сами.
    for (const asset of [...STICKER_ASSETS, ...CRAB_ASSETS]) {
      this.load.image(asset.key, assetUrl(asset.path));
    }
    // UI -> assets/images/ui/
    this.load.image('lock', assetUrl('assets/images/ui/lock.png'));
    this.load.image('arrow-back', assetUrl('assets/images/ui/arrow-back.png'));
    this.load.image('star-score', assetUrl('assets/images/ui/star-score.png'));
    this.load.image(
      'star-score-inactive',
      assetUrl('assets/images/ui/star-score-inactive.png'),
    );
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
    this.load.audio(MUSIC_KEY, assetUrl(MUSIC_TRACKS[0]));

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
}

