import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';
import { SettingsScene } from './scenes/SettingsScene';
import { CreditsScene } from './scenes/CreditsScene';
import { AlbumScene } from './scenes/AlbumScene';
import { UI_CSS } from './palette';

/** Логический размер игрового поля (базовый, 16:9 / горизонтальная ориентация).
 *  При Scale.EXPAND эти размеры — минимальные: мир расширяется под экран,
 *  поэтому реальные scale.width/height могут быть больше по «свободной» оси. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: UI_CSS.background,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    // EXPAND — заполняем весь экран: по «свободной» оси мир становится больше,
    // а не появляются чёрные полосы (letterbox), как при Scale.FIT.
    // Раскладка UI адаптируется автоматически, т.к. сцены читают scale.width/height
    // через getSafeBounds().
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    LevelSelectScene,
    GameScene,
    SettingsScene,
    CreditsScene,
    AlbumScene,
  ],
  render: {
    antialias: true,
    roundPixels: false,
  },
};

