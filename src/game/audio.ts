/**
 * Настройки звука и управление фоновой музыкой.
 *
 * Здесь живёт единственный источник правды о том, включена музыка или нет
 * (сохраняется в localStorage), а также параметры и запросы к звуковым
 * подсистемам Phaser. Сцены слушают изменения через `onMusicChange` и
 * включают/выключают свой звук.
 *
 * Музыка запускается только после первого пользовательского жеста: браузеры
 * блокируют автовоспроизведение AudioContext до взаимодействия с экраном.
 */

import type Phaser from 'phaser';

/** Ключ фоновой музыки в загрузчике Phaser. */
export const MUSIC_KEY = 'bgm';

const STORAGE_KEY = 'kidsgame.music.v1';

/** Громкость музыки (0..1), когда она включена. */
export const MUSIC_VOLUME = 0.5;

let musicEnabled: boolean = loadInitialMusicEnabled();

type MusicListener = (enabled: boolean) => void;
const listeners = new Set<MusicListener>();

/** Определяет, включена ли музыка: сохранённая настройка -> по умолчанию да. */
function loadInitialMusicEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '0') return false;
    if (saved === '1') return true;
  } catch {
    // localStorage может быть недоступен — используем значение по умолчанию.
  }
  return true;
}

/** Включена ли фоновая музыка. */
export function isMusicEnabled(): boolean {
  return musicEnabled;
}

/** Устанавливает настройку музыки, сохраняет её и уведомляет подписчиков. */
export function setMusicEnabled(enabled: boolean): void {
  if (enabled === musicEnabled) return;
  musicEnabled = enabled;

  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Игнорируем ошибки хранилища.
  }

  listeners.forEach((cb) => cb(enabled));
}

/** Подписка на изменение настройки музыки. Возвращает функцию отписки. */
export function onMusicChange(cb: MusicListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Пытается запустить фоновую музыку (бесконечным циклом), если она включена.
 * Безопасно вызывать несколько раз и из разных сцен — Phaser не запустит
 * один и тот же звук повторно, пока он играет.
 */
export function playBackgroundMusic(scene: Phaser.Scene): void {
  if (!musicEnabled) return;
  const sound = scene.sound;
  if (!sound || sound.locked) return;
  if (!scene.cache.audio.exists(MUSIC_KEY)) return;

  const existing = sound.get(MUSIC_KEY) as Phaser.Sound.BaseSound | null;
  if (existing && existing.isPlaying) return;

  sound.play(MUSIC_KEY, { loop: true, volume: MUSIC_VOLUME });
}

/** Останавливает фоновую музыку (например, при выключении в настройках). */
export function stopBackgroundMusic(scene: Phaser.Scene): void {
  const sound = scene.sound;
  if (!sound) return;
  sound.stopByKey(MUSIC_KEY);
}

/**
 * Подгоняет воспроизведение музыки под текущую настройку.
 * Удобно вызывать при входе на сцену и при изменении настройки.
 */
export function syncBackgroundMusic(scene: Phaser.Scene): void {
  if (musicEnabled) {
    playBackgroundMusic(scene);
  } else {
    stopBackgroundMusic(scene);
  }
}
