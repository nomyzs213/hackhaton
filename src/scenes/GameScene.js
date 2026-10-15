import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { Landmark } from '../objects/Landmark.js';
import { landmarks as landmarkData } from '../data/landmarks.js';
import { sfxSuccess, sfxHit, sfxHonk, sfxDuck, sfxCoin, startBGM, stopBGM } from '../utils/audio.js';

// ── Road corridors (world coords) – NO buildings may overlap these ─────────
// Horizontal roads (centre Y): 80, 350, 680, 980   width ±24
// Vertical roads   (centre X): 120, 400, 740, 1140, 1480  width ±24
// River Kłodnica   (Y 270‑318) – no roads or buildings
// Rynek pedestrian zone: X 600‑880, Y 430‑650 (no vehicles)

// NPC definitions at module level so building placement can keep their spots clear
const NPC_DEFS = [
  {
    x: 660, y: 520, key: 'npc-student',
    name: 'Student Politechniki',
    dialog: '🎓 Hej! Politechnika Śląska to jedna z najlepszych uczelni technicznych w Polsce!\nStudiuje tu ponad 20 000 studentów. Sala Senatu ma sklepienie kolebkowe z 1934 r.!'
  },
  {
    x: 820, y: 510, key: 'npc-fan',
    name: 'Kibic Piasta',
    dialog: '⚽ Piast Gliwice – mistrz Polski 2019! Stadion mieści 10 037 widzów.\nKlub założono w 1945 roku. Mój ulubiony gracz to Piotr Malarczyk!'
  },
  {
    x: 700, y: 620, key: 'npc-citizen',
    name: 'Mieszkanka Gliwic',
    dialog: '🌸 Palmiarnia Miejska działa od 1880 roku! Mamy tu egzotyczne palmy,\nczerwone żółwie wodne i gigantyczne lilie Victoria amazonica. Polecam w niedzielę!'
  },
  {
    x: 780, y: 620, key: 'npc-citizen',
    name: 'Pan Janusz',
    dialog: '📻 Radiostacja Gliwice! To tu nadawano prowokację gliwicką w 1939 roku.\nWieża ma 111 m i jest jedyną na świecie drewnianą wieżą radiową tej wysokości!'
  },
  {
    x: 475, y: 690, key: 'npc-citizen',
    name: 'Pani z piekarni',
    dialog: '🥐 Zapraszam do piekarni! Nasze rogale świętomarcińskie to tradycja Śląska.\nNa Rynku sprzedajemy też żurek w chlebie – specjalność regionu!'
  },
  {
    x: 965, y: 690, key: 'npc-student',
    name: 'Sprzedawca pamiątek',
    dialog: '🎁 Mam pamiątki z Gliwic! Figurki Diabełków z 1928 r., pocztówki,\nmagnetysy z Zamkiem Piastowskim i miniaturki Radiostacji. Polecam!'
  },
  // Extra wandering NPCs on sidewalks
  {
    x: 200, y: 200, key: 'npc-student',
    name: 'Turysta',
    dialog: '🗺️ Szukam drogi do Zamku Piastowskiego! Podobno mieści się tu\nMuzeum w Gliwicach z wystawami o historii górnictwa i metalurgii Śląska.'
  },
  {
    x: 1240, y: 480, key: 'npc-fan',
    name: 'Lokalny przewodnik',
    dialog: '🏰 Zamek Piastowski zbudowano w XIV wieku! Wieża ma 36 metrów.\nMożna wejść na szczyt i zobaczyć panoramę całych Gliwic. Warto!'
  },
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.W = 1920;
    this.H = 1080;
    this.physics.world.setBounds(0, 0, this.W, this.H);

    startBGM();

    // 1. CITY MAP
    this.createNaturalCityMap();

    // 2. DUCKS ON THE RIVER
    this.createDucks();

    // 3. CITY BUILDINGS – strictly outside road corridors
    this.createDenseCityBuildings();

    // 4. RYNEK MARKET SQUARE
    this.createRynek();

    // 5. INTERACTIVE NPCs
    this.createNPCs();

    // 6. LANDMARKS
    this.landmarks = [];
    landmarkData.forEach((d) => {
      const lm = new Landmark(this, d);
      this.landmarks.push(lm);
    });

    // 7. PLAYER – spawn on the Rynek plaza (safe from traffic)
    this.player = new Player(this, 740, 640);
    this.physics.add.collider(this.player, this.buildings);

    // 8. TRAFFIC
    this.cars = this.physics.add.group();
    this.time.addEvent({
      delay: 1200,
      callback: this.spawnTraffic,
      callbackScope: this,
      loop: true,
    });
    this.physics.add.overlap(this.player, this.cars, this.onCarHit, null, this);
    this.lastHonkTime = 0;

    // 9. INPUT
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.registry.set('paused', false);
    this.touch = { up: false, down: false, left: false, right: false };

    // 10. CAMERA – zoom 1.35× to make player & details readable
    this.cameras.main.setBounds(0, 0, this.W, this.H);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.35);

    // 11. GAME STATE & UI
    this.badges = 0;
    this.totalBadges = landmarkData.length;
    this.lives = this.player.lives;
    this.timeLeft = 210;
    this.timerAcc = 0;
    this.gameOver = false;
    this.quizOpen = false;
    this.npcDialogOpen = false;

    this.scene.launch('UIScene', { gameScene: this });
    this.time.delayedCall(60, () => {
      this.ui = this.scene.get('UIScene');
      if (this.ui) this.ui.updateHUD(this);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CITY MAP
  // ═══════════════════════════════════════════════════════════════════════════
  createNaturalCityMap() {
    const bg = this.add.graphics();

    // Base greenery
    bg.fillStyle(0x234923, 1);
    bg.fillRect(0, 0, this.W, this.H);

    // ── PARKS ─────────────────────────────────────────────────────────────
    bg.fillStyle(0x2e662e, 1);
    bg.fillRoundedRect(1440, 40, 440, 220, 20);   // Park Chopina (NE)
    bg.fillRoundedRect(60, 750, 380, 280, 20);     // Park Chrobrego (SW)
    bg.fillRoundedRect(1100, 750, 780, 280, 20);   // Sport district (SE)

    // ── RIVER KŁODNICA ─────────────────────────────────────────────────────
    bg.fillStyle(0x195280, 1);
    bg.fillRect(0, 270, this.W, 48);
    bg.fillStyle(0x455a64, 1);
    bg.fillRect(0, 267, this.W, 3);
    bg.fillRect(0, 318, this.W, 3);

    // ── RYNEK – cobblestone pedestrian plaza (X 600‑880, Y 430‑650) ───────
    if (this.textures.exists('tile-cobblestone')) {
      for (let py = 430; py < 650; py += 32)
        for (let px = 600; px < 880; px += 32)
          this.add.image(px + 16, py + 16, 'tile-cobblestone').setDepth(0);
    } else {
      bg.fillStyle(0x9e9e9e, 1);
      bg.fillRoundedRect(600, 430, 280, 220, 8);
    }

    // ── SIDEWALKS around Rynek ─────────────────────────────────────────────
    bg.fillStyle(0x757585, 1);
    bg.fillRect(565, 420, 350, 10);  // north edge
    bg.fillRect(565, 650, 350, 10);  // south edge
    bg.fillRect(565, 420, 10, 240);  // west edge
    bg.fillRect(905, 420, 10, 240);  // east edge

    // ── HORIZONTAL ROADS ───────────────────────────────────────────────────
    this.horizontalRoads = [80, 350, 680, 980];

    this.horizontalRoads.forEach((y) => {
      // asphalt
      bg.fillStyle(0x2d2d3d, 1);
      bg.fillRect(0, y - 24, this.W, 48);
      // curbs
      bg.fillStyle(0x555566, 1);
      bg.fillRect(0, y - 27, this.W, 3);
      bg.fillRect(0, y + 24, this.W, 3);

      // y=350 is the river boulevard — special treatment (blue tint, railings)
      if (y === 350) {
        bg.fillStyle(0x1a3a5c, 0.5);
        bg.fillRect(0, y - 24, this.W, 48);
        // metal railing dots
        bg.fillStyle(0x90a4ae, 1);
        for (let rx = 16; rx < this.W; rx += 48) {
          bg.fillCircle(rx, y - 26, 3);
          bg.fillCircle(rx, y + 26, 3);
        }
      } else if (y === 80 || y === 980) {
        // arterial — dual lane markings
        bg.fillStyle(0xffcc00, 0.9);
        bg.fillRect(0, y - 1, this.W, 2); // centre yellow line
        bg.fillStyle(0xffffff, 0.8);
        for (let rx = 12; rx < this.W; rx += 40) {
          bg.fillRect(rx, y - 12, 18, 2);
          bg.fillRect(rx, y + 10, 18, 2);
        }
      } else {
        // standard dashed white
        bg.fillStyle(0xffffff, 0.85);
        for (let rx = 12; rx < this.W; rx += 40)
          bg.fillRect(rx, y - 1, 20, 2);
      }
    });

    // ── VERTICAL ROADS ─────────────────────────────────────────────────────
    this.verticalRoads = [120, 400, 740, 1140, 1480];

    this.verticalRoads.forEach((x) => {
      bg.fillStyle(0x2d2d3d, 1);
      bg.fillRect(x - 24, 0, 48, this.H);
      bg.fillStyle(0x555566, 1);
      bg.fillRect(x - 27, 0, 3, this.H);
      bg.fillRect(x + 24, 0, 3, this.H);

      if (x === 740) {
        // Aleja Zwycięstwa – main artery: yellow centre line
        bg.fillStyle(0xffcc00, 0.9);
        bg.fillRect(x - 1, 0, 2, this.H);
      } else {
        bg.fillStyle(0xffffff, 0.85);
        for (let ry = 12; ry < this.H; ry += 40)
          bg.fillRect(x - 1, ry, 2, 20);
      }

      // ── GAP through Rynek pedestrian zone – NO road markings ───────────
      // (road visually ends; bridge-like path around plaza handled by road stop)
    });

    // ── STONE BRIDGES over Kłodnica ────────────────────────────────────────
    this.verticalRoads.forEach((x) => {
      bg.fillStyle(0x78909c, 1);
      bg.fillRect(x - 30, 265, 60, 58);
      bg.fillStyle(0xb71c1c, 1);
      bg.fillRect(x - 30, 265, 5, 58);
      bg.fillRect(x + 25, 265, 5, 58);
      bg.fillStyle(0x2d2d3d, 1);
      bg.fillRect(x - 22, 268, 44, 52);
    });

    // ── ZEBRA CROSSINGS ────────────────────────────────────────────────────
    this.verticalRoads.forEach((vx) => {
      this.horizontalRoads.forEach((hy) => {
        bg.fillStyle(0xffffff, 0.75);
        for (let i = -16; i <= 16; i += 8)
          bg.fillRect(vx - 20, hy + i, 40, 4);
      });
    });

    // ── TRAM TRACKS on Aleja Zwycięstwa (x=740) ────────────────────────────
    bg.lineStyle(2, 0x808080, 0.6);
    bg.beginPath();
    bg.moveTo(740 - 8, 0);
    bg.lineTo(740 - 8, this.H);
    bg.strokePath();
    bg.beginPath();
    bg.moveTo(740 + 8, 0);
    bg.lineTo(740 + 8, this.H);
    bg.strokePath();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DUCKS
  // ═══════════════════════════════════════════════════════════════════════════
  createDucks() {
    this.ducks = [];
    const pts = [
      { x: 300, y: 290, vx: 22 }, { x: 620, y: 285, vx: 18 },
      { x: 980, y: 292, vx: 25 }, { x: 1380, y: 288, vx: 20 },
      { x: 1720, y: 295, vx: 19 },
    ];
    pts.forEach((p) => {
      if (!this.textures.exists('duck')) return;
      const d = this.add.image(p.x, p.y, 'duck').setDepth(2);
      d.vx = p.vx;
      this.tweens.add({ targets: d, y: p.y + 4, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.ducks.push(d);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILDINGS – even distribution, avoiding roads/river/Rynek/landmarks/NPCs
  //
  // Road corridors are 48px wide (24px each side of center).
  // Buildings get collision bodies shrunk to ~72% of their visual size so
  // they never physically extend into roads.
  // A safety margin of ±55px from each road center keeps building centers
  // far enough away that even full-size visuals look sensible.
  // ═══════════════════════════════════════════════════════════════════════════
  createDenseCityBuildings() {
    this.buildings = this.physics.add.staticGroup();

    // Forbidden zones checker
    const isForbidden = (x, y) => {
      // Horizontal roads (48px wide + buffer)
      if (Math.abs(y - 80) < 55) return true;
      if (Math.abs(y - 350) < 55) return true;
      if (Math.abs(y - 680) < 55) return true;
      if (Math.abs(y - 980) < 55) return true;
      // Vertical roads (48px wide + buffer)
      if (Math.abs(x - 120) < 55) return true;
      if (Math.abs(x - 400) < 55) return true;
      if (Math.abs(x - 740) < 55) return true;
      if (Math.abs(x - 1140) < 55) return true;
      if (Math.abs(x - 1480) < 55) return true;
      // River Kłodnica + banks - zabroń chodzenia po wodzie (również na moście okolica ale mosty to drogi; strefa rzeki)
      if (y >= 255 && y <= 328) return true;
      // Rynek pedestrian zone (no buildings at all)
      if (x >= 540 && x <= 940 && y >= 400 && y <= 680) return true;
      return false;
    };

    // Keep-clear zones so the player can always walk up to landmarks & NPCs
    const keepClear = [
      ...landmarkData.map((d) => ({ x: d.x, y: d.y, r: 140 })),
      ...NPC_DEFS.map((d) => ({ x: d.x, y: d.y, r: 95 })),
    ];
    const insideKeepClear = (x, y) =>
      keepClear.some((z) => Phaser.Math.Distance.Between(x, y, z.x, z.y) < z.r);

    // Place a building with a shrunk collision body.
    // IMPORTANT: refreshBody() resets the body to the FULL display size, so it
    // must run BEFORE setSize(), and setSize() must be the last call.
    // Scale is clamped so a building's largest dimension never exceeds 86px —
    // with a 96px grid (jitter ±3 → min center distance 90px) visuals can
    // never overlap each other, so neighbouring façades/windows stay separate.
    const place = (cx, cy, key) => {
      if (isForbidden(cx, cy) || insideKeepClear(cx, cy)) return null;
      const texKey = this.textures.exists(key) ? key : 'building';
      const src = this.textures.get(texKey).getSourceImage();
      const maxDim = Math.max(src ? src.width : 64, src ? src.height : 64);
      const sc = Math.min(0.9, 86 / maxDim);
      const b = this.buildings.create(cx, cy, texKey);
      b.setScale(sc);
      b.refreshBody();                       // body = full display size…
      b.body.setSize(b.displayWidth * 0.72, b.displayHeight * 0.72); // …now shrink (auto-centered)
      return b;
    };

    // Building types
    const tenements = ['building-tenement-yellow', 'building-tenement-red', 'building-tenement-blue'];
    const allTypes = [...tenements, 'building-office', 'building-house', 'building-shop'];
    const pick = (x, y, arr) => arr[Math.abs(x * 7 + y * 13) % arr.length];

    // Grid-based placement across the whole 1920×1080 world
    const gridStep = 96;
    const jitter = 3; // tiny jitter: keeps buildings from looking rigidly aligned

    for (let gx = 48; gx < 1920; gx += gridStep) {
      for (let gy = 48; gy < 1080; gy += gridStep) {
        if (isForbidden(gx, gy) || insideKeepClear(gx, gy)) continue;

        // Density falls off toward the city centre (Rynek area stays airy)
        const distToCenter = Math.hypot(gx - 740, gy - 540);
        let density;
        if (distToCenter < 250) density = 0.10;       // Almost empty near Rynek
        else if (distToCenter < 420) density = 0.30;  // Airy centre
        else if (distToCenter < 640) density = 0.55;  // Medium ring
        else density = 0.9;                           // Outskirts nearly full
        if (Math.random() > density) continue;

        const cx = gx + Phaser.Math.Between(-jitter, jitter);
        const cy = gy + Phaser.Math.Between(-jitter, jitter);
        if (isForbidden(cx, cy) || insideKeepClear(cx, cy)) continue;

        let key;
        if (cy < 300) key = pick(cx, cy, allTypes);
        else if (cy > 900) key = pick(cx, cy, allTypes);
        else key = pick(cx, cy, tenements.concat(['building-office', 'building-shop']));

        place(cx, cy, key);
      }
    }

    // ── SHOPS flanking the Rynek (south of the plaza, outside road zones) ──
    const shopTex = (k) => this.textures.exists(k) ? k : 'building-shop';
    const bakery = this.buildings.create(470, 610, shopTex('shop-bakery'));
    bakery.setScale(0.85);
    bakery.refreshBody();
    bakery.body.setSize(bakery.displayWidth * 0.72, bakery.displayHeight * 0.72);

    const souvenir = this.buildings.create(1000, 610, shopTex('shop-souvenir'));
    souvenir.setScale(0.85);
    souvenir.refreshBody();
    souvenir.body.setSize(souvenir.displayWidth * 0.72, souvenir.displayHeight * 0.72);

    // ── PARK TREES ────────────────────────────────────────────────────────
    if (this.textures.exists('tree-park')) {
      const trees = [
        // Park Chopina (NE)
        [1470,70],[1530,90],[1590,60],[1650,85],[1720,70],[1790,90],[1860,75],[1900,110],
        [1480,150],[1560,140],[1640,150],[1720,130],[1800,145],[1880,155],
        // Park Chrobrego (SW)
        [75,780],[115,810],[75,860],[115,870],[75,920],
        // Sport district (SE)
        [1130,780],[1200,800],[1280,780],[1360,800],[1450,780],[1550,790],[1640,810],
        [1130,870],[1220,850],[1310,870],[1440,850],[1560,870],
        // Rynek edge trees - nie na drodze (droga y=680 jest 656-704, unikaj y~680)
        [605,432],[640,432],[800,432],[840,432],
        [605,640],[640,640],[800,640],[840,640],
        // Kłodnica bank trees - nie na drodze i nie w wodzie
        [200,235],[350,238],[500,235],[900,238],[1050,235],[1200,238],[1400,235],[1600,238],[1800,235],
      ];
      trees.forEach(([tx,ty]) => this.add.image(tx, ty, 'tree-park').setDepth(1).setScale(0.9));
    }

    // ── LAMP POSTS ────────────────────────────────────────────────────────
    if (this.textures.exists('lamp-post')) {
      const lamps = [
        // Rynek corners
        [570,445],[570,575],[910,445],[910,575],
        // Aleja Zwycięstwa lamps
        [710,370],[768,370],[710,650],[768,650],
        // h80 road
        [200,56],[400,56],[600,56],[800,56],[1000,56],[1200,56],[1400,56],[1600,56],[1800,56],
        // h980 road
        [200,956],[450,956],[700,956],[950,956],[1200,956],[1450,956],[1700,956],
      ];
      lamps.forEach(([lx,ly]) => this.add.image(lx, ly, 'lamp-post').setDepth(3).setScale(0.85));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RYNEK – pedestrian market square
  // ═══════════════════════════════════════════════════════════════════════════
  createRynek() {
    // Neptune fountain centrepiece (between Ratusz and plaza edge)
    const g = this.add.graphics();

    // Ratusz shadow
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(740, 555, 120, 30);

    // Neptune fountain basin
    g.fillStyle(0x1565c0, 0.85);
    g.fillCircle(740, 580, 28);
    g.lineStyle(3, 0x7986cb, 1);
    g.strokeCircle(740, 580, 28);
    g.fillStyle(0x90caf9, 0.7);
    g.fillCircle(740, 580, 12);

    // Fountain spout
    g.fillStyle(0x29b6f6, 0.9);
    g.fillCircle(740, 572, 5);

    // Flower beds around plaza
    const flowerColor = [0xe91e63, 0xff9800, 0xffeb3b, 0x8bc34a];
    [[620, 455], [840, 455], [620, 625], [840, 625]].forEach(([fx, fy], i) => {
      g.fillStyle(0x388e3c, 1);
      g.fillRoundedRect(fx - 18, fy - 14, 36, 28, 6);
      g.fillStyle(flowerColor[i % flowerColor.length], 1);
      for (let fi = 0; fi < 6; fi++) {
        const a = (fi / 6) * Math.PI * 2;
        g.fillCircle(fx + Math.cos(a) * 10, fy + Math.sin(a) * 8, 5);
      }
    });

    // Cafe umbrellas (round colourful)
    const umbrellaColors = [0xe53935, 0x1565c0, 0xf9a825, 0x388e3c];
    const umbrellaPos = [[650, 500], [830, 500], [650, 610], [830, 610]];
    umbrellaPos.forEach(([ux, uy], i) => {
      if (this.textures.exists('cafe-umbrella')) {
        this.add.image(ux, uy, 'cafe-umbrella').setDepth(4).setTint(umbrellaColors[i]);
      } else {
        g.fillStyle(umbrellaColors[i], 0.92);
        g.fillCircle(ux, uy, 22);
      }
    });

    // Outdoor chairs/tables under umbrellas
    const tableColors = [0x8d6e63, 0x8d6e63, 0x8d6e63, 0x8d6e63];
    [[650, 516], [830, 516], [650, 626], [830, 626]].forEach(([tx, ty], i) => {
      g.fillStyle(tableColors[i], 1);
      g.fillCircle(tx, ty, 7); // round table
      g.fillStyle(0xbcaaa4, 1);
      [[-12, 0], [12, 0], [0, -12], [0, 12]].forEach(([dx, dy]) => {
        g.fillRect(tx + dx - 4, ty + dy - 4, 8, 8);
      });
    });

    // Benches around the plaza
    const benchPos = [[690, 470], [790, 470], [690, 640], [790, 640],
                      [605, 535], [875, 535]];
    benchPos.forEach(([bx, by]) => {
      if (this.textures.exists('bench')) {
        this.add.image(bx, by, 'bench').setDepth(3);
      } else {
        g.fillStyle(0x795548, 1);
        g.fillRect(bx - 16, by - 6, 32, 12);
        g.fillStyle(0x5d4037, 1);
        g.fillRect(bx - 14, by - 10, 28, 5);
      }
    });

    // Flower pots along Rynek pierzeja (facade row)
    const potPos = [
      [600, 445], [616, 445], [864, 445], [880, 445],
      [600, 638], [616, 638], [864, 638], [880, 638],
    ];
    potPos.forEach(([px, py]) => {
      if (this.textures.exists('flower-pot')) {
        this.add.image(px, py, 'flower-pot').setDepth(3);
      } else {
        g.fillStyle(0xe91e63, 1);
        g.fillRect(px - 5, py - 8, 10, 8);
        g.fillStyle(0x795548, 1);
        g.fillRect(px - 6, py, 12, 8);
      }
    });

    // Gliwickie Diabełki sculpture (east side of Rynek)
    this.diabelkiGroup = null;
    if (this.textures.exists('landmark-diabelki')) {
      this.diabelkiGroup = this.add.container(862, 540);
      const sprite = this.add.image(0, 0, 'landmark-diabelki').setScale(0.9);
      const tag = this.add.text(0, -28, 'Gliwickie Diabełki', {
        fontSize: '10px', color: '#81d4fa', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.diabelkiGroup.add([sprite, tag]);
    }
    this.diabelkiVisited = false;

    // Label for Rynek
    this.add.text(740, 416, '✦ RYNEK GLIWICKI ✦', {
      fontSize: '12px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(5);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NPCs
  // ═══════════════════════════════════════════════════════════════════════════
  createNPCs() {
    this.npcs = NPC_DEFS.map((def) => {
      const tex = this.textures.exists(def.key) ? def.key : 'building';
      const sprite = this.add.image(def.x, def.y, tex).setDepth(5);
      // gentle idle bob
      this.tweens.add({
        targets: sprite, y: def.y - 4,
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      // [E] prompt tag (hidden until nearby)
      const prompt = this.add.text(def.x, def.y - 34, '[E] Porozmawiaj', {
        fontSize: '10px', color: '#ffe082', stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(6).setVisible(false);
      const nameTag = this.add.text(def.x, def.y + 26, def.name, {
        fontSize: '9px', color: '#ffffff', stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(6);
      return { ...def, sprite, prompt, nameTag };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE LOOP
  // ═══════════════════════════════════════════════════════════════════════════
  update(time, delta) {
    if (this.gameOver) return;

    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) && !this.quizOpen && !this.npcDialogOpen) {
      this.registry.get('paused') ? this.resumeGame() : this.pauseGame();
    }

    if (this.registry.get('paused')) return;

    this.player.handleInput(this.cursors, this.wasd);

    // Ducks drift
    if (this.ducks) {
      this.ducks.forEach((d) => {
        d.x += (d.vx * delta) / 1000;
        if (d.x > this.W + 50) d.x = -40;
      });
    }

    // ── Landmark interaction ──
    let nearestUnvisited = null;
    let nearestDist = Infinity;

    this.landmarks.forEach((lm) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, lm.x, lm.y);
      if (!lm.visited && dist < 110) {
        lm.setPromptVisible(true);
        if (dist < nearestDist) { nearestDist = dist; nearestUnvisited = lm; }
      } else {
        lm.setPromptVisible(false);
      }
    });

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && nearestUnvisited && !this.npcDialogOpen) {
      this.tryInteract(nearestUnvisited);
    }

    // ── NPC interaction ──
    let nearestNPC = null;
    let nearestNPCDist = Infinity;
    if (this.npcs) {
      this.npcs.forEach((npc) => {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
        npc.prompt.setVisible(dist < 85 && !this.quizOpen && !this.npcDialogOpen);
        if (dist < 85 && dist < nearestNPCDist) { nearestNPCDist = dist; nearestNPC = npc; }
      });
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && nearestNPC && !nearestUnvisited && !this.npcDialogOpen && !this.quizOpen) {
      this.openNPCDialog(nearestNPC);
    }

    // ── Diabelki easter egg ──
    if (this.diabelkiGroup && !this.diabelkiVisited && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      const gx = this.diabelkiGroup.x ?? 862;
      const gy = this.diabelkiGroup.y ?? 540;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, gx, gy);
      if (dist < 60) {
        this.diabelkiVisited = true;
        this.timeLeft += 10;
        if (this.ui) {
          this.ui.updateTimer(this.timeLeft);
          this.ui.showEasterEgg('Gliwickie Diabełki (1928)! Moneta na szczęście! +10s 🪙');
        }
        sfxCoin();
      }
    }

    // ── Car honk proximity ──
    const now = this.time.now;
    if (now - this.lastHonkTime > 2500) {
      const closeCar = this.cars.getChildren().find(
        (c) => Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y) < 95
      );
      if (closeCar) { this.lastHonkTime = now; sfxHonk(); }
    }

    // ── Destroy out-of-bounds cars ──
    for (let i = this.cars.getChildren().length - 1; i >= 0; i--) {
      const car = this.cars.getChildren()[i];
      if (car.x < -150 || car.x > this.W + 150 || car.y < -150 || car.y > this.H + 150)
        car.destroy();
    }

    // ── Timer countdown ──
    this.timerAcc += delta;
    if (this.timerAcc >= 1000) {
      this.timerAcc -= 1000;
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      if (this.ui) {
        this.ui.updateTimer(this.timeLeft);
        this.ui.updateCompass(this);
        this.ui.updateMinimap(this);
      }
      if (this.timeLeft <= 0) this.endGame(false);
    }

    if (this.badges >= this.totalBadges) this.endGame(true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NPC DIALOG
  // ═══════════════════════════════════════════════════════════════════════════
  openNPCDialog(npc) {
    if (this.npcDialogOpen || this.quizOpen) return;
    this.npcDialogOpen = true;
    this.registry.set('paused', true);
    this.player.setVelocity(0, 0);
    if (this.ui) this.ui.showNPCDialog(npc.name, npc.dialog, () => {
      this.npcDialogOpen = false;
      this.registry.set('paused', false);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRAFFIC SPAWNER – vehicles skip the Rynek pedestrian zone
  // ═══════════════════════════════════════════════════════════════════════════
  spawnTraffic() {
    if (this.registry.get('paused') || this.gameOver) return;

    const roll = Math.random();
    let chosenKey = 'car-red';
    if (roll < 0.28 && this.textures.exists('bus-gliwice')) chosenKey = 'bus-gliwice';
    else if (roll < 0.42 && this.textures.exists('tram-gliwice')) chosenKey = 'tram-gliwice';
    else chosenKey = Phaser.Utils.Array.GetRandom(['car-red', 'car-blue', 'car-yellow']);

    const isHorizontal = Math.random() < 0.65;

    if (isHorizontal) {
      const laneY = Phaser.Utils.Array.GetRandom(this.horizontalRoads);
      const fromLeft = Math.random() < 0.5;
      const speed = chosenKey === 'bus-gliwice' ? Phaser.Math.Between(120, 160) : Phaser.Math.Between(140, 220);
      const v = this.cars.create(fromLeft ? -80 : this.W + 80, laneY, chosenKey);
      v.body.setSize(chosenKey === 'bus-gliwice' ? 64 : 44, 22);
      v.setVelocityX(fromLeft ? speed : -speed);
      v.setFlipX(!fromLeft);
    } else {
      // Vertical traffic must NOT drive through the Rynek pedestrian zone.
      // Road x=740 crosses the plaza (x 560–920, y 420–660), so exclude it.
      const safeLanes = this.verticalRoads.filter((x) => x !== 740);
      const laneX = Phaser.Utils.Array.GetRandom(safeLanes);
      const fromTop = Math.random() < 0.5;
      const speed = Phaser.Math.Between(120, 190);
      const v = this.cars.create(laneX, fromTop ? -80 : this.H + 80, chosenKey);
      v.body.setSize(22, chosenKey === 'bus-gliwice' ? 64 : 44);
      v.setAngle(90);
      v.setVelocityY(fromTop ? speed : -speed);
      if (!fromTop) v.setFlipX(true);
    }
  }

  onCarHit(player, car) {
    if (player.invulnerable || this.gameOver) return;
    const damaged = player.hit();
    if (damaged) {
      sfxHit();
      if (this.ui) { this.ui.flashHit(); this.ui.updateLives(player.lives); }
      if (player.lives <= 0) this.endGame(false);
    }
  }

  tryInteract(lm) {
    if (this.quizOpen || lm.visited) return;
    this.quizOpen = true;
    this.registry.set('paused', true);
    this.player.setVelocity(0, 0);
    this.physics.world.pause();

    if (this.ui) {
      this.ui.showQuiz(lm.data, (correct) => {
        if (correct) {
          lm.markVisited();
          this.badges += 1;
          if (this.ui) this.ui.addBadge(this.badges);
          sfxSuccess();
        } else {
          this.timeLeft = Math.max(0, this.timeLeft - 10);
          if (this.ui) this.ui.updateTimer(this.timeLeft);
        }
        this.physics.world.resume();
        this.registry.set('paused', false);
        this.quizOpen = false;
        if (this.ui) this.ui.updateHUD(this);
      });
    } else {
      this.physics.world.resume();
      this.registry.set('paused', false);
      this.quizOpen = false;
    }
  }

  pauseGame() {
    this.registry.set('paused', true);
    this.physics.world.pause();
    this.scene.launch('PauseScene', { gameScene: this });
  }

  resumeGame() {
    this.registry.set('paused', false);
    this.physics.world.resume();
    if (this.scene.isActive('PauseScene')) this.scene.stop('PauseScene');
  }

  endGame(win) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.registry.set('paused', true);
    this.physics.world.pause();
    stopBGM();
    this.time.delayedCall(120, () => {
      this.scene.stop('UIScene');
      this.scene.start('EndScene', {
        win, timeLeft: this.timeLeft,
        badges: this.badges, total: this.totalBadges,
        lives: this.player ? this.player.lives : 0,
      });
    });
  }
}