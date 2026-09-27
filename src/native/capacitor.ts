import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

/**
 * Инициализация нативных функций Capacitor.
 * Здесь настраиваем поведение, которое отличается в браузере и в приложении.
 */
export async function initCapacitor(): Promise<void> {
  await lockLandscape();

  if (!Capacitor.isNativePlatform()) {
    console.info('[Capacitor] Запуск в браузере (web-режим)');
    warnIfPortrait();
    return;
  }

  console.info(`[Capacitor] Нативная платформа: ${Capacitor.getPlatform()}`);

  // Не засыпать во время игры.
  // npm i @capacitor/keep-awake
  // import { KeepAwake } from '@capacitor/keep-awake';
  // await KeepAwake.keepAwake();
}

/**
 * Блокирует ориентацию в ландшафт (после поворота устройства).
 * Использует плагин @capacitor/screen-orientation.
 */
async function lockLandscape(): Promise<void> {
  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch (err) {
    // На web-платформе блокировка может быть недоступна — это не критично.
    console.info('[ScreenOrientation] Блокировка не применена:', err);
  }
}

/** В web-режиме подсказываем пользователю повернуть устройство в ландшафт. */
function warnIfPortrait(): void {
  const check = (): void => {
    if (window.innerHeight > window.innerWidth) {
      console.info('[Ориентация] Поверните устройство горизонтально 📱➡️');
    }
  };
  check();
  window.addEventListener('resize', check);
}
