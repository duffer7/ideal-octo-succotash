import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { initCapacitor } from './native/capacitor';
import { registerOrientationOverlay } from './ui/orientationOverlay';
import { t } from './game/i18n';
import { ensureFontsLoaded } from './game/fonts';

/**
 * Инициализация приложения.
 * Порядок: нативная оболочка -> загрузка веб-шрифтов -> игра.
 */
async function bootstrap(): Promise<void> {
  await initCapacitor();

  // Ждём загрузку веб-шрифтов, иначе первый текст отрендерится фолбэком.
  await ensureFontsLoaded();

  registerOrientationOverlay();

  new Phaser.Game(gameConfig);
}

bootstrap().catch((err) => {
  console.error('Ошибка запуска:', err);
  const root = document.getElementById('game');
  if (root) {
    root.innerHTML = `<p style="color:#fff;padding:24px;font-size:18px">${t('error.start')}</p>`;
  }
});

