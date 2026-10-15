import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const bar = this.add.rectangle(width / 2, height / 2, 320, 20, 0x222244).setStrokeStyle(1, 0xffffff);
    const fill = this.add.rectangle(width / 2 - 160, height / 2, 0, 16, 0x4caf50).setOrigin(0, 0.5);

    const title = this.add.text(width / 2, height / 2 - 70, 'ODKRYJ GLIWICE', {
      fontSize: '28px', color: '#ffd700', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    const text = this.add.text(width / 2, height / 2 - 30, 'Ładowanie zasobów...', {
      fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      fill.width = 320 * value;
    });
    this.load.on('complete', () => {
      text.setText('Gotowe!');
    });

    const base = import.meta.env.BASE_URL || '/';
    this.load.setBaseURL(base);

    // Tło menu
    this.load.image('menu-bg', 'assets/images/menu-bg.png');

    // Assety pixel art
    const images = [
      ['player', 'assets/images/player.png'],
      ['player-idle', 'assets/images/player-idle-32x32.png'],
      ['tile-grass', 'assets/images/tile-grass-32x32.png'],
      ['tile-road-h', 'assets/images/tile-road-h-32x32.png'],
      ['tile-road-v', 'assets/images/tile-road-v-32x32.png'],
      ['tile-road-cross', 'assets/images/tile-road-cross-32x32.png'],
      ['tile-sidewalk', 'assets/images/tile-sidewalk-32x32.png'],
      ['tile-water', 'assets/images/tile-water-32x32.png'],
      ['building', 'assets/images/building.png'],
      ['building-generic', 'assets/images/building-generic-64x64.png'],
      ['building-house', 'assets/images/building-house-64x64.png'],
      ['building-shop', 'assets/images/building-shop-64x64.png'],
      ['building-office', 'assets/images/building-office.png'],
      ['building-tenement-yellow', 'assets/images/building-tenement-yellow.png'],
      ['building-tenement-red', 'assets/images/building-tenement-red.png'],
      ['building-tenement-blue', 'assets/images/building-tenement-blue.png'],
      ['car', 'assets/images/car.png'],
      ['car-red', 'assets/images/car-red-48x24.png'],
      ['car-blue', 'assets/images/car-blue-48x24.png'],
      ['car-yellow', 'assets/images/car-yellow-48x24.png'],
      ['badge', 'assets/images/badge.png'],
      ['icon-heart', 'assets/images/icon-heart-16x16.png'],
      ['icon-clock', 'assets/images/icon-clock-16x16.png'],
      ['landmark-radio-tower', 'assets/images/landmark-radio-tower-32x32.png'],
      ['landmark-palm-house', 'assets/images/landmark-palm-house-48x48.png'],
      ['landmark-piast-castle', 'assets/images/landmark-piast-castle-48x48.png'],
      ['landmark-market-square', 'assets/images/landmark-market-square-48x48.png'],
      ['landmark-theatre', 'assets/images/landmark-theatre-48x48.png'],
      ['landmark-silesian-tech', 'assets/images/landmark-silesian-tech-48x48.png'],
      ['landmark-piast-stadium', 'assets/images/landmark-piast-stadium-48x48.png'],
      ['landmark-all-saints', 'assets/images/landmark-all-saints-48x48.png'],
      ['landmark-willa-caro', 'assets/images/landmark-willa-caro.png'],
      ['landmark-dworzec-pkp', 'assets/images/landmark-dworzec-pkp.png'],
      ['landmark-ruiny-teatru', 'assets/images/landmark-ruiny-teatru.png'],
      ['landmark-arena-gliwice', 'assets/images/landmark-arena-gliwice.png'],
      ['bus-gliwice', 'assets/images/bus-gliwice.png'],
      ['tram-gliwice', 'assets/images/tram-gliwice.png'],
      ['duck', 'assets/images/duck.png'],
      ['landmark-diabelki', 'assets/images/landmark-diabelki.png'],
      ['tile-cobblestone', 'assets/images/tile-cobblestone-32x32.png'],
      ['tree-park', 'assets/images/tree-park.png'],
      ['lamp-post', 'assets/images/lamp-post.png'],
      ['npc-student', 'assets/images/npc-student.png'],
      ['npc-fan', 'assets/images/npc-fan.png'],
      ['npc-citizen', 'assets/images/npc-citizen.png'],
      ['shop-bakery', 'assets/images/shop-bakery.png'],
      ['shop-souvenir', 'assets/images/shop-souvenir.png'],
      ['cafe-umbrella', 'assets/images/cafe-umbrella.png'],
      ['bench', 'assets/images/bench.png'],
      ['flower-pot', 'assets/images/flower-pot.png'],
    ];

    images.forEach(([key, path]) => {
      this.load.image(key, path);
    });
  }

  create() {
    this.ensureFallbacks();
    this.scene.start('MenuScene');
  }

  ensureFallbacks() {
    const makeTex = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      draw(ctx, w, h);
      this.textures.addCanvas(key, canvas);
    };

    makeTex('player', 160, 48, (ctx) => {
      // 4 walk frames of 40×48 so Player frame slicing works with the fallback too
      for (let i = 0; i < 4; i++) {
        const x = i * 40;
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(x + 10, 2, 20, 26);              // body
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(x + 8, 28 + (i % 2) * 2, 8, 16); // left leg (alternates)
        ctx.fillRect(x + 24, 28 + ((i + 1) % 2) * 2, 8, 16); // right leg
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(x + 14, 6, 12, 10);              // head/hat
      }
    });
    makeTex('building', 64, 64, (ctx) => { ctx.fillStyle = '#556688'; ctx.fillRect(0, 0, 64, 64); });
    makeTex('landmark', 32, 32, (ctx) => { ctx.fillStyle = '#ffc107'; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill(); });
    makeTex('car', 48, 24, (ctx) => { ctx.fillStyle = '#e53935'; ctx.fillRect(0, 0, 48, 24); });
    makeTex('badge', 24, 24, (ctx) => { ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(12, 12, 12, 0, Math.PI * 2); ctx.fill(); });
    makeTex('npc-student', 36, 44, (ctx) => { ctx.fillStyle = '#1565c0'; ctx.fillRect(8, 0, 20, 44); });
    makeTex('npc-fan', 36, 44, (ctx) => { ctx.fillStyle = '#b71c1c'; ctx.fillRect(8, 0, 20, 44); });
    makeTex('npc-citizen', 36, 44, (ctx) => { ctx.fillStyle = '#37474f'; ctx.fillRect(8, 0, 20, 44); });
    makeTex('shop-bakery', 96, 80, (ctx) => { ctx.fillStyle = '#f9a825'; ctx.fillRect(0, 0, 96, 80); });
    makeTex('shop-souvenir', 96, 80, (ctx) => { ctx.fillStyle = '#6a1b9a'; ctx.fillRect(0, 0, 96, 80); });
    makeTex('cafe-umbrella', 48, 48, (ctx) => { ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(24, 24, 24, 0, Math.PI * 2); ctx.fill(); });
    makeTex('bench', 32, 20, (ctx) => { ctx.fillStyle = '#795548'; ctx.fillRect(0, 0, 32, 20); });
    makeTex('flower-pot', 24, 24, (ctx) => { ctx.fillStyle = '#e91e63'; ctx.fillRect(4, 0, 16, 24); });
  }
}