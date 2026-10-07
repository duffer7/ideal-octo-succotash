import Phaser from 'phaser';
import {
  addLayer,
  addSplit,
  MAIN_CLOUDS,
  MAIN_GRADIENT,
  placeCover,
  type SplitLayer,
} from '../ui/mainBackground';

const DEPTH = {
  gradient: -40,
  stars: -30,
  clouds: -20,
} as const;

/**
 * Небо, которое не выключается при смене экрана.
 * Градиент есть с загрузки, облака выезжают один раз и дальше стоят на месте.
 */
export class SkyScene extends Phaser.Scene {
  private gradient?: Phaser.GameObjects.Image;
  private stars?: Phaser.GameObjects.Image;
  private clouds?: SplitLayer;
  private entranceT = 1;
  private revealed = false;
  private entranceTween?: Phaser.Tweens.Tween;
  private starTween?: Phaser.Tweens.Tween;

  constructor() {
    super('SkyScene');
  }

  create(): void {
    this.gradient = addLayer(this, MAIN_GRADIENT.key, DEPTH.gradient);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.entranceTween?.stop();
      this.starTween?.stop();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  /**
   * Главное меню открыто. При первом заходе облака выезжают, звёзды зажигаются.
   * Дальше слои просто снова становятся видны, без сдвига картинки.
   */
  presentForMenu(animate: boolean): void {
    this.ensureClouds();
    this.ensureStars();

    if (!this.revealed && animate) {
      this.revealed = true;
      this.stars?.setAlpha(0);
      this.entranceT = 0;
      this.layout();
      this.playEntrance();
      if (this.stars) {
        this.starTween = this.tweens.add({
          targets: this.stars,
          alpha: 1,
          duration: 1800,
          delay: 350,
          ease: 'Sine.easeOut',
        });
      }
      return;
    }

    this.revealed = true;
    this.stars?.setAlpha(1);
    if (!this.entranceTween?.isPlaying()) {
      this.entranceT = 1;
      this.layout();
    }
  }

  /** Звёзды только на главном экране. Облака и градиент остаются. */
  hideMenuStars(): void {
    this.stars?.setAlpha(0);
  }

  private ensureClouds(): void {
    if (this.clouds || !this.textures.exists(MAIN_CLOUDS.key)) return;
    this.clouds = addSplit(this, MAIN_CLOUDS.key, DEPTH.clouds);
  }

  private ensureStars(): void {
    if (this.stars || !this.textures.exists('main-bg-stars')) return;
    this.stars = addLayer(this, 'main-bg-stars', DEPTH.stars);
  }

  private playEntrance(): void {
    if (!this.clouds) return;
    const ride = { t: 0 };
    this.entranceTween = this.tweens.add({
      targets: ride,
      t: 1,
      duration: 1200,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.entranceT = ride.t;
        if (!this.clouds) return;
        const viewW = this.scale.width;
        this.clouds.left.x = Phaser.Math.Linear(-viewW / 2, 0, this.entranceT);
        this.clouds.right.x = Phaser.Math.Linear(viewW / 2, 0, this.entranceT);
      },
      onComplete: () => {
        this.entranceT = 1;
        this.layout();
      },
    });
  }

  private layout = (): void => {
    if (this.gradient?.active) placeCover(this, this.gradient);
    if (this.stars?.active) placeCover(this, this.stars);
    if (!this.clouds) return;
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const bleed = 36;
    const scale = Math.max(
      (viewW + bleed * 2) / this.clouds.left.frame.realWidth,
      (viewH + bleed * 2) / this.clouds.left.frame.realHeight,
    );
    this.clouds.root.setPosition(viewW / 2, viewH / 2);
    this.clouds.left.setScale(scale);
    this.clouds.right.setScale(scale);
    this.clouds.left.x = Phaser.Math.Linear(-viewW / 2, 0, this.entranceT);
    this.clouds.right.x = Phaser.Math.Linear(viewW / 2, 0, this.entranceT);
    this.clouds.left.y = 0;
    this.clouds.right.y = 0;
  };
}
