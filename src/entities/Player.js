import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);

    // player.png is a 160×48 sprite sheet with 4 walk frames (40×48 each).
    // Slice it into named frames once so animation works for both the real
    // asset and the generated fallback canvas.
    this._ensureFrames(scene);

    // Switch to a 40×48 frame BEFORE sizing, otherwise setDisplaySize would
    // compute scales against the full 160×48 sheet and the player would render
    // squashed (10px wide) once the walk animation starts.
    const tex = scene.textures.get('player');
    if (tex && tex.has('walk0')) this.setFrame('walk0');

    this.setDisplaySize(40, 48);
    // Small foot-level hitbox so the player slides smoothly around obstacles
    this.body.setSize(24, 18);
    this.body.setOffset(8, 28);

    this.speed = 210;
    this.lives = 3;
    this.invulnerable = false;
    this._moving = false;

    this._createAnims(scene);
  }

  _ensureFrames(scene) {
    const tex = scene.textures.get('player');
    if (!tex) return;
    const src = tex.getSourceImage ? tex.getSourceImage() : null;
    if (!src) return;
    // 4-frame horizontal sheet → add walk0..walk3 frames
    if (src.width === 160 && src.height === 48 && !tex.has('walk0')) {
      for (let i = 0; i < 4; i++) {
        tex.add('walk' + i, 0, i * 40, 0, 40, 48);
      }
    }
  }

  _createAnims(scene) {
    const tex = scene.textures.get('player');
    if (!tex || !tex.has('walk0')) return;
    if (!scene.anims.exists('player-walk')) {
      scene.anims.create({
        key: 'player-walk',
        frames: [0, 1, 2, 3].map((i) => ({ key: 'player', frame: 'walk' + i })),
        frameRate: 9,
        repeat: -1,
      });
    }
  }

  handleInput(cursors, wasd) {
    if (this.scene.registry.get('paused')) {
      this.setVelocity(0, 0);
      this._setIdle();
      return;
    }

    const t = this.scene.touch || {};
    let vx = 0, vy = 0;

    if (cursors.left.isDown  || wasd.a.isDown || t.left)  vx -= 1;
    if (cursors.right.isDown || wasd.d.isDown || t.right) vx += 1;
    if (cursors.up.isDown    || wasd.w.isDown || t.up)    vy -= 1;
    if (cursors.down.isDown  || wasd.s.isDown || t.down)  vy += 1;

    // Zablokuj chodzenie po wodzie - rzeka Kłodnica (Y 270-318)
    // Mosty znajdują się przy x: 120,400,740,1140,1480 i mają szerokość ~60px - pozwól przechodzić
    const bridgeX = Math.abs(this.x - 120) < 40 || Math.abs(this.x - 400) < 40 || Math.abs(this.x - 740) < 40 || Math.abs(this.x - 1140) < 40 || Math.abs(this.x - 1480) < 40;
    if ((this.y >= 270 && this.y <= 318) && !bridgeX) {
      this.setVelocity(0, 0);
      this._setIdle();
      return;
    }

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      this.setVelocity((vx / len) * this.speed, (vy / len) * this.speed);
      if (vx !== 0) this.setFlipX(vx < 0);
      this._setWalking();
    } else {
      this.setVelocity(0, 0);
      this._setIdle();
    }
  }

  _setWalking() {
    if (this._moving) return;
    this._moving = true;
    const tex = this.scene.textures.get('player');
    if (tex && tex.has('walk0') && this.scene.anims.exists('player-walk')) {
      this.play('player-walk', true);
    }
  }

  _setIdle() {
    if (!this._moving) return;
    this._moving = false;
    this.stop();
    const tex = this.scene.textures.get('player');
    if (tex && tex.has('walk0')) this.setFrame('walk0');
  }

  hit() {
    if (this.invulnerable) return false;
    this.lives -= 1;
    this.invulnerable = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 0.2,
      duration: 90,
      yoyo: true,
      repeat: 6,
      onComplete: () => { this.alpha = 1; this.invulnerable = false; },
    });
    return true;
  }
}
