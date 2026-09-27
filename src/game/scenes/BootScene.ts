import Phaser from 'phaser';

/**
 * BootScene — самая первая сцена.
 * Здесь генерируются/подготавливаются общие ресурсы, настройки звука,
 * сохранения и т.п. Ассеты грузятся в PreloadScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Пример генерации простой текстуры-кнопки, если нет графики под рукой.
    // Позже замените на реальные спрайты.
    this.createPlaceholderTextures();

    this.scene.start('PreloadScene');
  }

  /** Создаёт простые заглушки, чтобы игра запускалась без внешних ассетов. */
  private createPlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(32, 32, 32);
    g.generateTexture('circle', 64, 64);
    g.destroy();
  }
}
