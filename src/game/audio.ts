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
import { assetUrl } from './assets';

/** Ключ фоновой музыки в загрузчике Phaser. */
export const MUSIC_KEY = 'bgm';

/** Ключ звука клика по элементам интерфейса. */
export const SFX_CLICK_KEY = 'sfx-click';

/** Громкость звука клика (0..1). */
export const SFX_CLICK_VOLUME = 0.6;

const STORAGE_KEY = 'kidsgame.music.v1';

/** Громкость музыки (0..1), когда она включена. */
export const MUSIC_VOLUME = 0.5;

let musicEnabled: boolean = loadInitialMusicEnabled();

/**
 * Единственный HTMLAudio-элемент фоновой музыки.
 *
 * Phaser при `loop: true` заранее ставит в очередь второй AudioBufferSource.
 * На mp3 этот шов не сходится: предыдущий кусок ещё звучит, а следующий уже
 * стартовал, и копии наслаиваются. Нативный повтор одного элемента этого не
 * делает: трек доигрывает до конца и запускается снова с той же громкости.
 *
 * Ссылку держим на globalThis, чтобы горячая перезагрузка модуля не создала
 * второй элемент поверх уже играющего.
 */
const MUSIC_ELEMENT_KEY = '__kidsgameMusic';

function getMusicElement(): HTMLAudioElement | null {
  return (globalThis as typeof globalThis & { [MUSIC_ELEMENT_KEY]?: HTMLAudioElement })[
    MUSIC_ELEMENT_KEY
  ] ?? null;
}

function musicElement(): HTMLAudioElement {
  const existing = getMusicElement();
  if (existing) return existing;

  const el = new Audio(assetUrl('assets/audio/music/main_theme.mp3'));
  el.preload = 'auto';
  el.loop = false;
  el.volume = MUSIC_VOLUME;
  el.addEventListener('ended', () => {
    if (!musicEnabled) return;
    // Элемент уже остановлен событием ended — это тот же голос, не вторая копия.
    el.currentTime = 0;
    void el.play().catch(() => {
      // Автовоспроизведение ещё заблокировано — повтор будет с жеста.
    });
  });

  (globalThis as typeof globalThis & { [MUSIC_ELEMENT_KEY]?: HTMLAudioElement })[
    MUSIC_ELEMENT_KEY
  ] = el;
  return el;
}

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
 * Пытается запустить фоновую музыку, если она включена.
 * Повторный вызов ничего не добавляет: играет один и тот же элемент.
 */
export function playBackgroundMusic(scene: Phaser.Scene): void {
  if (!musicEnabled) return;
  if (!scene.cache.audio.exists(MUSIC_KEY)) return;

  // Гасим копии, которые Phaser мог оставить с прошлого запуска (loop: true).
  scene.sound?.stopByKey(MUSIC_KEY);

  const el = musicElement();
  if (!el.paused && !el.ended) return;
  void el.play().catch(() => {
    // Браузер блокирует автоплей до жеста. Меню повторяет вызов по pointerdown.
  });
}

/** Останавливает фоновую музыку (например, при выключении в настройках). */
export function stopBackgroundMusic(scene: Phaser.Scene): void {
  scene.sound?.stopByKey(MUSIC_KEY);
  const el = getMusicElement();
  if (!el) return;
  el.pause();
  el.currentTime = 0;
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

/**
 * Проигрывает короткий звук клика по элементу интерфейса.
 *
 * Звук клика НЕ зависит от настройки фоновой музыки — это отдельная
 * подсистема. Играем, если файл загружен. На первом жесте сами
 * возобновляем AudioContext, иначе браузер проглатывает этот клик.
 */
export function playClickSound(scene: Phaser.Scene): void {
  const sound = scene.sound;
  if (!sound) return;
  if (!scene.cache.audio.exists(SFX_CLICK_KEY)) return;

  // Не выходим при sound.locked: первый жест как раз разблокирует AudioContext.
  // resume() и play() вызываем в том же обработчике, иначе браузер съест клик.
  const web = sound as Phaser.Sound.WebAudioSoundManager;
  if (web.context?.state === 'suspended') {
    void web.context.resume();
  }

  sound.play(SFX_CLICK_KEY, { volume: SFX_CLICK_VOLUME });
}

export type Chime = 'combo' | 'freeze' | 'super' | 'sad';

/**
 * Короткий синтезированный сигнал, пока нет отдельных файлов звуков.
 * Не зависит от переключателя музыки — как и клик по кнопке.
 */
export function playChime(scene: Phaser.Scene, kind: Chime): void {
  const web = scene.sound as Phaser.Sound.WebAudioSoundManager | undefined;
  const ctx = web?.context;
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const notes =
    kind === 'combo'
      ? [523, 659, 784]
      : kind === 'freeze'
        ? [880, 660]
        : kind === 'super'
          ? [523, 659, 784, 1046]
          : [392, 330];

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + i * 0.09;
    osc.type = kind === 'freeze' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  });
}

