import Phaser from 'phaser';

/**
 * PreloadScene — загрузка ассетов с индикатором прогресса.
 * В детских играх важно показывать, что идёт загрузка.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.createProgressBar();

    // === Здесь добавляйте реальные ассеты ===
    // this.load.image('background', 'assets/images/background.png');
    // this.load.audio('click', ['assets/audio/click.mp3']);
    // this.load.spritesheet('sprites', 'assets/images/sprites.png', {
    //   frameWidth: 128,
    //   frameHeight: 128,
    // });

    this.load.on('complete', () => {
      this.scene.start('MenuScene');
    });
  }

  private createProgressBar(): void {
    const { width, height } = this.scale;

    const boxW = width * 0.7;
    const boxH = 40;
    const x = width / 2;
    const y = height / 2;

    const border = this.add.graphics();
    border.lineStyle(6, 0xffffff, 0.9);
    border.strokeRoundedRect(x - boxW / 2, y - boxH / 2, boxW, boxH, boxH / 2);

    const bar = this.add.graphics();
    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(0xffffff, 0.9);
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
