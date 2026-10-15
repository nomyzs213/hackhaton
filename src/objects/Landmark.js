import Phaser from 'phaser';

export class Landmark extends Phaser.GameObjects.Container {
  constructor(scene, data) {
    super(scene, data.x, data.y);
    this.scene = scene;
    this.data = data;
    this.visited = false;

    // Sprite landmarku
    const tex = scene.textures.exists(data.textureKey) ? data.textureKey : 'landmark';
    this.sprite = scene.add.image(0, 0, tex);
    this.add(this.sprite);

    const sw = this.sprite.width || 64;
    const sh = this.sprite.height || 64;
    const halfH = sh / 2;

    // Cień pod podstawą landmarku
    this.shadow = scene.add.ellipse(0, halfH - 4, sw * 0.85, 16, 0x000000, 0.4);
    this.addAt(this.shadow, 0);

    // Etykieta z nazwą (czytelna tabliczka unosząca się NAD budynkiem)
    this.nameTag = scene.add.container(0, -halfH - 18);
    const tagWidth = Math.max(160, data.name.length * 8.5 + 24);
    const bg = scene.add.rectangle(0, 0, tagWidth, 24, 0x142033, 0.9)
      .setStrokeStyle(1.5, 0xffd700);
    const txt = scene.add.text(0, 0, data.name, {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.nameTag.add([bg, txt]);
    this.add(this.nameTag);

    // Podpowiedź interakcji "[E] Odkryj" (animowany zielony dymek NAD tabliczką)
    this.prompt = scene.add.container(0, -halfH - 46).setVisible(false);
    const promptBg = scene.add.rectangle(0, 0, 106, 24, 0x4caf50, 0.95)
      .setStrokeStyle(1.5, 0xffffff);
    const promptTxt = scene.add.text(0, 0, 'Naciśnij [E]', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.prompt.add([promptBg, promptTxt]);
    this.add(this.prompt);

    // Złoty medalion odznaki (po zebraniu)
    this.checkIcon = scene.add.image(sw / 2 - 4, -halfH + 8, 'badge').setScale(0.9).setVisible(false);
    this.add(this.checkIcon);

    // Delikatne pulsowanie podpowiedzi
    scene.tweens.add({
      targets: this.prompt,
      y: -halfH - 50,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    scene.add.existing(this);
    this.setSize(sw, sh);
    this.setInteractive(new Phaser.Geom.Rectangle(-sw / 2, -sh / 2, sw, sh), Phaser.Geom.Rectangle.Contains);
    this.input.cursor = 'pointer';
  }

  setPromptVisible(visible) {
    if (this.visited) {
      this.prompt.setVisible(false);
      return;
    }
    this.prompt.setVisible(visible);
  }

  markVisited() {
    this.visited = true;
    this.prompt.setVisible(false);
    this.checkIcon.setVisible(true);

    // Animacja zdobycia odznaki na landmarku
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 250,
      yoyo: true,
      onComplete: () => {
        this.sprite.setTint(0xffea88);
      }
    });
  }
}