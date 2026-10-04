/**
 * Настройки звука и управление фоновой музыкой.
 *
 * Громкость музыки и остальных звуков (0..1, ноль — полностью выключено)
 * хранится в localStorage. Сцены слушают изменения через `onMusicChange`
 * и `onSfxChange`.
 *
 * Музыка запускается только после первого пользовательского жеста: браузеры
 * блокируют автовоспроизведение AudioContext до взаимодействия с экраном.
 *
 * Два трека главной темы играют по очереди: один доигрывает до конца,
 * затем начинается следующий.
 */

import type Phaser from 'phaser';
import { assetUrl } from './assets';

/** Ключ фоновой музыки в загрузчике Phaser (первый трек, шлюз «ассеты готовы»). */
export const MUSIC_KEY = 'bgm';

/** Треки главной темы, по кругу. */
export const MUSIC_TRACKS = [
  'assets/audio/music/atlasaudio-funny-606256.mp3',
  'assets/audio/music/atlasaudio-kids-song-606264.mp3',
] as const;

/** Ключ звука клика по элементам интерфейса. */
export const SFX_CLICK_KEY = 'sfx-click';

/** Громкость звука клика (0..1) при ползунке эффектов на максимуме. */
export const SFX_CLICK_VOLUME = 0.6;

const MUSIC_STORAGE_KEY = 'kidsgame.musicVolume.v1';
const LEGACY_MUSIC_KEY = 'kidsgame.music.v1';
const SFX_STORAGE_KEY = 'kidsgame.sfxVolume.v1';

/** Громкость музыки по умолчанию (0..1). */
export const MUSIC_VOLUME = 0.5;

/** Громкость эффектов по умолчанию: 1 — как задуманы клики и сигналы. */
const DEFAULT_SFX_VOLUME = 1;

let musicVolume = loadMusicVolume();
let sfxVolume = loadSfxVolume();

/**
 * Единственный HTMLAudio-элемент фоновой музыки.
 *
 * Phaser при `loop: true` заранее ставит в очередь второй AudioBufferSource.
 * На mp3 этот шов не сходится: предыдущий кусок ещё звучит, а следующий уже
 * стартовал, и копии наслаиваются. Нативный элемент доигрывает трек до конца
 * и только потом запускает следующий.
 *
 * Ссылку держим на globalThis, чтобы горячая перезагрузка модуля не создала
 * второй элемент поверх уже играющего.
 */
const MUSIC_ELEMENT_KEY = '__kidsgameMusic';
const ENDED_HANDLER_KEY = '__kidsgameMusicEnded';

function getMusicElement(): HTMLAudioElement | null {
  return (globalThis as typeof globalThis & { [MUSIC_ELEMENT_KEY]?: HTMLAudioElement })[
    MUSIC_ELEMENT_KEY
  ] ?? null;
}

function fileName(path: string): string {
  const clean = path.split('?')[0] ?? path;
  const parts = clean.split('/');
  return parts[parts.length - 1] ?? clean;
}

function trackIndexOf(el: HTMLAudioElement): number {
  const current = fileName(el.currentSrc || el.src);
  const index = MUSIC_TRACKS.findIndex((track) => fileName(track) === current);
  return index >= 0 ? index : 0;
}

function playTrack(el: HTMLAudioElement, index: number): void {
  const track = MUSIC_TRACKS[index % MUSIC_TRACKS.length] ?? MUSIC_TRACKS[0];
  const nextName = fileName(track);
  const start = (): void => {
    el.volume = musicVolume;
    // currentTime до загрузки метаданных у части браузеров сразу шлёт ended,
    // и треки начинают перескакивать друг на друга.
    if (el.readyState >= 1) el.currentTime = 0;
    void el.play().catch(() => {
      // Автовоспроизведение ещё заблокировано — повтор будет с жеста.
    });
  };

  if (fileName(el.currentSrc || el.src) !== nextName) {
    el.src = assetUrl(track);
    el.addEventListener('loadedmetadata', start, { once: true });
    return;
  }
  start();
}

function bindTrackAdvance(el: HTMLAudioElement): void {
  const holder = el as HTMLAudioElement & { [ENDED_HANDLER_KEY]?: () => void };
  if (holder[ENDED_HANDLER_KEY]) return;
  let advancing = false;
  const onEnded = (): void => {
    if (musicVolume <= 0 || advancing || !el.ended) return;
    advancing = true;
    playTrack(el, trackIndexOf(el) + 1);
    advancing = false;
  };
  holder[ENDED_HANDLER_KEY] = onEnded;
  el.addEventListener('ended', onEnded);
}

function musicElement(): HTMLAudioElement {
  const existing = getMusicElement();
  if (existing) {
    existing.volume = musicVolume;
    bindTrackAdvance(existing);
    const current = fileName(existing.currentSrc || existing.src);
    const known = MUSIC_TRACKS.some((track) => fileName(track) === current);
    // Пустой currentSrc — файл ещё грузится, не сбрасываем его на первый трек.
    if (current && !known) existing.src = assetUrl(MUSIC_TRACKS[0]);
    return existing;
  }

  const el = new Audio(assetUrl(MUSIC_TRACKS[0]));
  el.preload = 'auto';
  el.loop = false;
  el.volume = musicVolume;
  bindTrackAdvance(el);

  (globalThis as typeof globalThis & { [MUSIC_ELEMENT_KEY]?: HTMLAudioElement })[
    MUSIC_ELEMENT_KEY
  ] = el;
  return el;
}

type VolumeListener = (volume: number) => void;
const musicListeners = new Set<VolumeListener>();
const sfxListeners = new Set<VolumeListener>();

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  const clamped = Math.min(1, Math.max(0, volume));
  if (clamped < 0.03) return 0;
  if (clamped > 0.97) return 1;
  return clamped;
}

function readStoredVolume(key: string): number | null {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return null;
    const value = Number(saved);
    if (!Number.isFinite(value)) return null;
    return clampVolume(value);
  } catch {
    return null;
  }
}

/** Сохранённая громкость музыки, старый переключатель вкл/выкл или значение по умолчанию. */
function loadMusicVolume(): number {
  const saved = readStoredVolume(MUSIC_STORAGE_KEY);
  if (saved !== null) return saved;
  try {
    const legacy = localStorage.getItem(LEGACY_MUSIC_KEY);
    if (legacy === '0') return 0;
  } catch {
    // localStorage может быть недоступен — используем значение по умолчанию.
  }
  return MUSIC_VOLUME;
}

function loadSfxVolume(): number {
  return readStoredVolume(SFX_STORAGE_KEY) ?? DEFAULT_SFX_VOLUME;
}

function storeVolume(key: string, volume: number): void {
  try {
    localStorage.setItem(key, String(volume));
  } catch {
    // Игнорируем ошибки хранилища.
  }
}

/** Текущая громкость музыки, 0..1. Ноль — музыка выключена. */
export function getMusicVolume(): number {
  return musicVolume;
}

/** Устанавливает громкость музыки, сохраняет её и уведомляет подписчиков. */
export function setMusicVolume(volume: number): void {
  const next = clampVolume(volume);
  if (next === musicVolume) return;
  musicVolume = next;
  storeVolume(MUSIC_STORAGE_KEY, musicVolume);
  const el = getMusicElement();
  if (el) el.volume = musicVolume;
  musicListeners.forEach((cb) => cb(musicVolume));
}

/** Включена ли фоновая музыка (громкость выше нуля). */
export function isMusicEnabled(): boolean {
  return musicVolume > 0;
}

/** Подписка на изменение громкости музыки. Возвращает функцию отписки. */
export function onMusicChange(cb: VolumeListener): () => void {
  musicListeners.add(cb);
  return () => musicListeners.delete(cb);
}

/** Текущая громкость эффектов, 0..1. Ноль — клики и сигналы выключены. */
export function getSfxVolume(): number {
  return sfxVolume;
}

/** Устанавливает громкость эффектов, сохраняет её и уведомляет подписчиков. */
export function setSfxVolume(volume: number): void {
  const next = clampVolume(volume);
  if (next === sfxVolume) return;
  sfxVolume = next;
  storeVolume(SFX_STORAGE_KEY, sfxVolume);
  sfxListeners.forEach((cb) => cb(sfxVolume));
}

/** Подписка на изменение громкости эффектов. Возвращает функцию отписки. */
export function onSfxChange(cb: VolumeListener): () => void {
  sfxListeners.add(cb);
  return () => sfxListeners.delete(cb);
}

/**
 * Пытается запустить фоновую музыку, если громкость выше нуля.
 * Повторный вызов ничего не добавляет: играет один и тот же элемент.
 */
export function playBackgroundMusic(scene: Phaser.Scene): void {
  if (musicVolume <= 0) return;
  if (!scene.cache.audio.exists(MUSIC_KEY)) return;

  // Гасим копии, которые Phaser мог оставить с прошлого запуска (loop: true).
  scene.sound?.stopByKey(MUSIC_KEY);

  const el = musicElement();
  el.volume = musicVolume;
  if (!el.paused && !el.ended) return;
  void el.play().catch(() => {
    // Браузер блокирует автоплей до жеста. Меню повторяет вызов по pointerdown.
  });
}

/** Ставит фоновую музыку на паузу (например, когда громкость ушла в ноль). */
export function stopBackgroundMusic(scene: Phaser.Scene): void {
  scene.sound?.stopByKey(MUSIC_KEY);
  const el = getMusicElement();
  if (!el) return;
  el.pause();
}

/**
 * Подгоняет воспроизведение музыки под текущую громкость.
 * Удобно вызывать при входе на сцену и при движении ползунка.
 */
export function syncBackgroundMusic(scene: Phaser.Scene): void {
  if (musicVolume > 0) {
    playBackgroundMusic(scene);
  } else {
    stopBackgroundMusic(scene);
  }
}

/**
 * Проигрывает короткий звук клика по элементу интерфейса.
 *
 * Громкость берётся из ползунка эффектов. На первом жесте сами
 * возобновляем AudioContext, иначе браузер проглатывает этот клик.
 */
export function playClickSound(scene: Phaser.Scene): void {
  if (sfxVolume <= 0) return;
  const sound = scene.sound;
  if (!sound) return;
  if (!scene.cache.audio.exists(SFX_CLICK_KEY)) return;

  // Не выходим при sound.locked: первый жест как раз разблокирует AudioContext.
  // resume() и play() вызываем в том же обработчике, иначе браузер съест клик.
  const web = sound as Phaser.Sound.WebAudioSoundManager;
  if (web.context?.state === 'suspended') {
    void web.context.resume();
  }

  sound.play(SFX_CLICK_KEY, { volume: SFX_CLICK_VOLUME * sfxVolume });
}

export type Chime = 'combo' | 'freeze' | 'super' | 'sad';

/**
 * Короткий синтезированный сигнал, пока нет отдельных файлов звуков.
 * Громкость зависит от ползунка эффектов — как и клик по кнопке.
 */
export function playChime(scene: Phaser.Scene, kind: Chime): void {
  if (sfxVolume <= 0) return;
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

  const peak = 0.12 * sfxVolume;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + i * 0.09;
    osc.type = kind === 'freeze' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  });
}
