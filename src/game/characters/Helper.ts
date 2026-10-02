/**
 * Краб-помощник. Пока нет спрайтов — рисуется фигурами.
 * Если загружены картинки, подменяет ими тело и меняет позу.
 *
 * Ключи: `crab-idle`, `crab-happy`, `crab-sad`.
 */
import Phaser from 'phaser';
import { PALETTE, UI } from '../palette';

type Pose = 'idle' | 'happy' | 'sad';

export class Helper {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly sprite?: Phaser.GameObjects.Image;
  private mouth?: Phaser.GameObjects.Graphics;
  private idleTween?: Phaser.Tweens.Tween;
  private reactTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 110) {
    this.scene = scene;
    const children: Phaser.GameObjects.GameObject[] = [];

    if (scene.textures.exists('crab-idle')) {
      this.sprite = scene.add.image(0, 0, 'crab-idle');
      this.sprite.setDisplaySize(size, size);
      children.push(this.sprite);
    } else {
      children.push(...this.drawCrab(size));
    }

    this.root = scene.add.container(x, y, children).setDepth(16);
    this.playIdle();
  }

  happy(): void {
    this.react('happy', -28, 1.12);
  }

  /** Чуть сильнее, чем обычная радость — для комбо. */
  cheer(): void {
    this.react('happy', -46, 1.22);
  }

  sad(): void {
    this.react('sad', 10, 0.92);
  }

  private react(pose: Pose, dy: number, scale: number): void {
    this.setPose(pose);
    this.idleTween?.pause();
    this.reactTween?.remove();
    const baseY = this.root.y;
    this.reactTween = this.scene.tweens.add({
      targets: this.root,
      y: baseY + dy,
      scale,
      angle: pose === 'sad' ? -8 : 8,
      duration: 160,
      yoyo: true,
      ease: 'Quad.out',
      onComplete: () => {
        this.root.setScale(1);
        this.root.setAngle(0);
        this.root.y = baseY;
        this.setPose('idle');
        this.idleTween?.resume();
      },
    });
  }

  private playIdle(): void {
    const baseY = this.root.y;
    this.idleTween = this.scene.tweens.add({
      targets: this.root,
      y: baseY - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private setPose(pose: Pose): void {
    if (this.sprite) {
      const key =
        pose === 'happy' && this.scene.textures.exists('crab-happy')
          ? 'crab-happy'
          : pose === 'sad' && this.scene.textures.exists('crab-sad')
            ? 'crab-sad'
            : 'crab-idle';
      if (this.scene.textures.exists(key)) this.sprite.setTexture(key);
      return;
    }
    if (!this.mouth) return;
    this.mouth.clear();
    this.mouth.lineStyle(4, PALETTE.deepPurple, 1);
    if (pose === 'sad') {
      this.mouth.beginPath();
      this.mouth.arc(0, 18, 10, Math.PI * 1.15, Math.PI * 1.85, false);
      this.mouth.strokePath();
    } else {
      this.mouth.beginPath();
      this.mouth.arc(0, 8, 12, Math.PI * 0.15, Math.PI * 0.85, false);
      this.mouth.strokePath();
    }
  }

  private drawCrab(size: number): Phaser.GameObjects.GameObject[] {
    const g = this.scene.add.graphics();
    const s = size / 110;
    g.fillStyle(PALETTE.red, 1);
    g.fillEllipse(0, 6 * s, 62 * s, 44 * s);
    g.fillCircle(-40 * s, 2 * s, 14 * s);
    g.fillCircle(40 * s, 2 * s, 14 * s);
    g.lineStyle(4 * s, PALETTE.deepPurple, 0.9);
    g.strokeEllipse(0, 6 * s, 62 * s, 44 * s);

    g.fillStyle(PALETTE.white, 1);
    g.fillCircle(-12 * s, -2 * s, 7 * s);
    g.fillCircle(12 * s, -2 * s, 7 * s);
    g.fillStyle(PALETTE.deepPurple, 1);
    g.fillCircle(-12 * s, -2 * s, 3 * s);
    g.fillCircle(12 * s, -2 * s, 3 * s);

    this.mouth = this.scene.add.graphics();
    this.setPose('idle');

    const shadow = this.scene.add.ellipse(0, 34 * s, 50 * s, 12 * s, UI.shadow, 0.25);
    return [shadow, g, this.mouth];
  }
}

/** Картинки краба, если их нарисуют. Игра работает и без них. */
export const CRAB_ASSETS: { key: string; path: string }[] = [
  { key: 'crab-idle', path: 'assets/images/characters/crab-idle.png' },
  { key: 'crab-happy', path: 'assets/images/characters/crab-happy.png' },
  { key: 'crab-sad', path: 'assets/images/characters/crab-sad.png' },
];
