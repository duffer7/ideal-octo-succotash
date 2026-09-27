import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { initCapacitor } from './native/capacitor';
import { registerOrientationOverlay } from './ui/orientationOverlay';

/**
 * Инициализация приложения.
 * Порядок: нативная оболочка -> игра.
 */
async function bootstrap(): Promise<void> {
  await initCapacitor();

  registerOrientationOverlay();

  new Phaser.Game(gameConfig);
}

bootstrap().catch((err) => {
  console.error('Ошибка запуска:', err);
  const root = document.getElementById('game');
  if (root) {
    root.innerHTML = `<p style="color:#fff;padding:24px;font-size:18px">Не удалось запустить игру 😢</p>`;
  }
});

