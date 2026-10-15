import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// ─── PNG encoder (pure Node, no canvas) ──────────────────────────────────────
function crc32(buf) {
  const T = new Uint32Array(256).map((_, i) => {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = T[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const buf = Buffer.alloc(12 + data.length);
  buf.writeUInt32BE(data.length, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  buf.writeUInt32BE(crc32(buf.subarray(4, 8 + data.length)), 8 + data.length);
  return buf;
}
function encodePNG(w, h, rgba) {
  const hdr = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(6, 9);
  const lines = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    lines[y * (1 + w * 4)] = 0;
    rgba.copy(lines, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([hdr, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(lines)), chunk('IEND', Buffer.alloc(0))]);
}

class PC {
  constructor(w, h) { this.w = w; this.h = h; this.d = Buffer.alloc(w * h * 4); }
  px(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = a;
  }
  rect(x, y, w, h, r, g, b, a = 255) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.px(x + dx, y + dy, r, g, b, a);
  }
  outline(x, y, w, h, r, g, b) {
    for (let dx = 0; dx < w; dx++) { this.px(x + dx, y, r, g, b); this.px(x + dx, y + h - 1, r, g, b); }
    for (let dy = 0; dy < h; dy++) { this.px(x, y + dy, r, g, b); this.px(x + w - 1, y + dy, r, g, b); }
  }
  shade(x, y, w, h, bR, bG, bB, mR, mG, mB, dR, dG, dB) {
    this.rect(x, y, w, h, mR, mG, mB);
    this.rect(x, y, 2, h, bR, bG, bB);           // left highlight
    this.rect(x + w - 2, y, 2, h, dR, dG, dB);   // right shadow
    this.rect(x, y, w, 2, bR, bG, bB);            // top highlight
    this.rect(x, y + h - 2, w, 2, dR, dG, dB);   // bottom shadow
  }
  png() { return encodePNG(this.w, this.h, this.d); }
  save(fp) { fs.writeFileSync(fp, this.png()); console.log(`Saved: ${path.basename(fp)} (${this.w}x${this.h})`); }
}

const OUT = 'public/assets/images';
fs.mkdirSync(OUT, { recursive: true });
const p = (f) => path.join(OUT, f);

// ─── COLOUR PALETTES ─────────────────────────────────────────────────────────
const C = {
  // Tenements
  tenY:  [[255,215,80], [210,170,50], [150,110,20]],   // yellow/gold
  tenR:  [[220, 80,60], [170, 40,30], [110, 20,10]],   // red brick
  tenB:  [[80,130,200], [50, 90,160], [20, 50,110]],   // blue
  tenG:  [[90,160, 90], [60,120, 60], [30, 80, 30]],   // green
  // Windows
  winLit:  [220,240,255],
  winDark: [30, 50, 90],
  winYel:  [255,230,100],
  // Roofs
  roofR:  [100, 30, 20],
  roofG:  [40, 80, 40],
  roofB:  [30, 50,100],
  // Facades
  shopA: [220,120, 30],   // awning orange
  shopR: [190, 30, 30],   // awning red
  shopG: [ 30,130, 30],   // awning green
};

// ─── BUILDING FACTORY ─────────────────────────────────────────────────────────
function makeTenement(w, h, wallR, wallG, wallB, roofR, roofG, roofB, winR, winG, winB, awningR, awningG, awningB) {
  const c = new PC(w, h);
  const roofH = Math.round(h * 0.12);
  const bodyH = h - roofH;

  // Wall with shade
  c.shade(0, roofH, w, bodyH, wallR + 30, wallG + 20, wallB + 15, wallR, wallG, wallB, wallR - 30, wallG - 25, wallB - 20);

  // Roof
  c.rect(0, 0, w, roofH, roofR, roofG, roofB);
  c.rect(0, 0, w, 2, Math.min(255, roofR + 40), Math.min(255, roofG + 30), Math.min(255, roofB + 30)); // cornice highlight
  // Roof details - chimneys
  const chnPos = [Math.round(w * 0.2), Math.round(w * 0.7)];
  chnPos.forEach(cx => {
    c.rect(cx, 0, 4, roofH + 4, 80, 70, 70);
    c.rect(cx - 1, 0, 6, 2, 100, 90, 90);
  });

  // Windows in grid
  const winW = Math.max(5, Math.round(w / 5));
  const winH = Math.max(6, Math.round((bodyH - 4) / 4));
  const cols = Math.max(2, Math.floor((w - 4) / (winW + 3)));
  const rows = Math.max(2, Math.floor((bodyH - 4) / (winH + 4)));
  const marginX = Math.round((w - cols * (winW + 3)) / 2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = marginX + col * (winW + 3);
      const wy = roofH + 4 + row * (winH + 4);
      // window frame
      c.rect(wx - 1, wy - 1, winW + 2, winH + 2, 60, 50, 40);
      // window glass - lit or dark randomly per position
      const lit = (row + col) % 3 !== 0;
      c.rect(wx, wy, winW, winH, lit ? winR : 30, lit ? winG : 40, lit ? winB : 70);
      // window sheen line
      if (lit) c.rect(wx, wy, 1, winH, Math.min(255, winR + 60), Math.min(255, winG + 50), Math.min(255, winB + 40));
      // curtain hint
      c.rect(wx + winW - 2, wy, 2, winH, lit ? Math.round(winR * 0.7) : 25, 30, 50);
    }
  }

  // Ground floor - door
  const doorW = Math.max(6, Math.round(w * 0.2));
  const doorH = Math.max(10, Math.round(bodyH * 0.22));
  const doorX = Math.round((w - doorW) / 2);
  const doorY = h - doorH - 1;
  c.rect(doorX, doorY, doorW, doorH, 50, 35, 20);       // door
  c.rect(doorX, doorY, doorW, 2, 90, 60, 30);           // door top frame
  c.rect(doorX, doorY, 2, doorH, 80, 50, 25);           // left frame
  c.rect(doorX + doorW - 2, doorY, 2, doorH, 80, 50, 25);
  c.rect(doorX + doorW / 2 - 1, doorY + 2, 1, doorH - 4, 160, 110, 60); // door panel line
  // door knob
  c.px(doorX + doorW - 3, doorY + Math.round(doorH / 2), 200, 160, 40);

  // Awning above ground windows
  if (awningR !== undefined) {
    c.rect(0, h - doorH - 4, w, 4, awningR, awningG, awningB);
    // stripes
    for (let sx = 0; sx < w; sx += 6) {
      c.rect(sx, h - doorH - 4, 3, 4, Math.min(255, awningR + 50), Math.min(255, awningG + 40), Math.min(255, awningB + 40));
    }
  }

  // Outline
  c.outline(0, 0, w, h, 20, 15, 10);
  return c;
}

// Generate 5 distinct tenement types, each 80×112
const BLDG_W = 80, BLDG_H = 112;

makeTenement(BLDG_W, BLDG_H,
  200,160, 50,  // wall: warm yellow
  80, 40, 20,   // roof: dark red
  180,210,255,  // window: blue-white
  200,100, 30   // awning: orange
).save(p('building-tenement-yellow.png'));

makeTenement(BLDG_W, BLDG_H,
  180, 60, 40,  // wall: red brick
  60, 30, 20,   // roof: very dark
  200,230,255,  // window: bright
  30,120, 60    // awning: green
).save(p('building-tenement-red.png'));

makeTenement(BLDG_W, BLDG_H,
  60,100,180,   // wall: blue
  40, 40, 90,   // roof: dark blue
  255,240,180,  // window: warm lit
  180, 30, 30   // awning: red
).save(p('building-tenement-blue.png'));

// Office block – taller, glassy
{
  const W = 80, H = 120;
  const c = new PC(W, H);
  // curtain wall glass facade
  c.rect(0, 0, W, H, 50, 70, 110);
  // horizontal floor bands
  for (let y = 0; y < H; y += 10) c.rect(0, y, W, 2, 30, 45, 80);
  // vertical mullions
  for (let x = 0; x < W; x += 12) c.rect(x, 0, 2, H, 30, 45, 80);
  // glass sheen diagonal
  for (let d = 0; d < H + W; d++) {
    const gx = d - Math.round(H * 0.6);
    for (let gy = 0; gy < H; gy++) {
      if (gx + gy === d) c.px(gx, gy, 120, 160, 220, 60);
    }
  }
  // top cornice
  c.rect(0, 0, W, 8, 40, 55, 100);
  c.rect(0, 0, W, 2, 90,120,180);
  // windows per panel
  for (let row = 1; row < Math.floor(H / 10) - 1; row++) {
    for (let col = 1; col < Math.floor(W / 12); col++) {
      const lit = (row * col) % 5 !== 0;
      c.rect(col * 12 + 2, row * 10 + 2, 8, 6, lit ? 200 : 20, lit ? 230 : 30, lit ? 255 : 60);
    }
  }
  // logo strip
  c.rect(10, H - 18, W - 20, 10, 20, 40, 80);
  c.rect(12, H - 16, W - 24, 6, 0, 0, 0);
  c.outline(0, 0, W, H, 20, 30, 60);
  c.save(p('building-office.png'));
}

// Shop building
{
  const W = 80, H = 88;
  const c = new PC(W, H);
  // facade plaster
  c.shade(0, 0, W, H, 235, 215, 185, 205, 185, 155, 155, 130, 105);
  // shop window (large)
  c.rect(4, H - 30, W - 8, 22, 170, 210, 240);
  c.outline(4, H - 30, W - 8, 22, 40, 50, 70);
  // reflection lines
  c.rect(6, H - 28, 3, 18, 200, 230, 255, 120);
  c.rect(10, H - 28, 1, 18, 200, 230, 255, 80);
  // sign board
  c.rect(4, H - 34, W - 8, 6, 40, 80, 150);
  // upper windows
  for (let col = 0; col < 3; col++) {
    const wx = 8 + col * 22;
    c.rect(wx, 8, 14, 18, 160, 200, 230);
    c.outline(wx, 8, 14, 18, 50, 60, 80);
    c.rect(wx, 8, 2, 18, 200, 225, 250, 100);
  }
  // striped awning
  for (let sx = 4; sx < W - 4; sx += 6) {
    c.rect(sx, H - 36, 3, 4, 200, 50, 50);
    c.rect(sx + 3, H - 36, 3, 4, 240, 240, 240);
  }
  c.outline(0, 0, W, H, 30, 20, 10);
  c.save(p('building-shop.png'));
}

// House
{
  const W = 72, H = 80;
  const c = new PC(W, H);
  // walls
  c.shade(0, 20, W, H - 20, 215, 195, 165, 185, 165, 135, 135, 115, 95);
  // pitched roof
  const roofTop = [W / 2, 0];
  const roofLeft = [0, 22];
  const roofRight = [W, 22];
  // rasterize triangle
  for (let ry = 0; ry <= 22; ry++) {
    const t = ry / 22;
    const x0 = Math.round(roofTop[0] * (1 - t) + roofLeft[0] * t);
    const x1 = Math.round(roofTop[0] * (1 - t) + roofRight[0] * t);
    const shade_add = Math.round((1 - t) * 30);
    c.rect(x0, ry, x1 - x0, 1, 140 + shade_add, 60 + shade_add, 30 + shade_add);
  }
  // roof ridge
  c.rect(W / 2 - 1, 0, 3, 4, 180, 80, 40);
  // chimney
  c.rect(W - 18, 6, 8, 16, 170, 100, 70);
  c.rect(W - 19, 6, 10, 3, 190, 120, 90);
  // windows with shutters
  [[10, 28], [W - 24, 28], [W / 2 - 7, 28]].forEach(([wx, wy]) => {
    c.rect(wx, wy, 14, 16, 160, 200, 225);
    c.outline(wx, wy, 14, 16, 50, 40, 30);
    // shutters
    c.rect(wx - 4, wy, 4, 16, 80, 110, 60);
    c.rect(wx + 14, wy, 4, 16, 80, 110, 60);
  });
  // door
  c.rect(W / 2 - 6, H - 22, 12, 22, 100, 60, 30);
  c.rect(W / 2 - 5, H - 20, 5, 10, 130, 80, 40);
  c.rect(W / 2, H - 20, 5, 10, 110, 70, 30);
  c.px(W / 2 + 4, H - 12, 200, 160, 40);
  // fence posts
  for (let fx = 0; fx < W; fx += 10) {
    c.rect(fx, H - 6, 4, 6, 180, 160, 130);
    c.rect(fx, H - 7, 4, 1, 200, 180, 150);
  }
  c.outline(0, 20, W, H - 20, 30, 20, 10);
  c.save(p('building-house.png'));
}

// ─── PLAYER SPRITE SHEET (4 frames walk, 40×48 each → 160×48) ─────────────
{
  const FW = 40, FH = 48, FRAMES = 4;
  const sheet = new PC(FW * FRAMES, FH);

  const drawPlayer = (c, ox, frame) => {
    // Body colours
    const sk = [255, 210, 170]; // skin
    const hr = [ 80,  50,  20]; // hair
    const sh = [ 50, 100, 200]; // shirt blue
    const pt = [ 40,  40,  80]; // pants dark
    const sh2= [200, 160,  50]; // shoe

    // Leg positions based on walk frame
    const legPhase = frame * (Math.PI / 2);
    const lly = Math.round(Math.sin(legPhase) * 3);     // left leg offset
    const rly = Math.round(Math.sin(legPhase + Math.PI) * 3);

    // Shoes
    c.rect(ox + 10, FH - 8 + lly, 8, 5, ...sh2);
    c.rect(ox + 22, FH - 8 + rly, 8, 5, ...sh2);
    // Pants legs
    c.rect(ox + 10, FH - 20 + lly, 8, 13, ...pt);
    c.rect(ox + 22, FH - 20 + rly, 8, 13, ...pt);
    // Belt
    c.rect(ox + 8, FH - 22, 24, 3, 60, 40, 20);
    c.px(ox + 19, FH - 21, 200, 160, 40); // buckle
    // Shirt body
    c.rect(ox + 7, FH - 36, 26, 15, ...sh);
    // Shirt shade
    c.rect(ox + 7, FH - 36, 2, 15, Math.min(255, sh[0] + 30), Math.min(255, sh[1] + 20), Math.min(255, sh[2] + 20));
    c.rect(ox + 31, FH - 36, 2, 15, Math.max(0, sh[0] - 30), Math.max(0, sh[1] - 20), Math.max(0, sh[2] - 20));
    // Arms (swing with walk)
    const armPhase = frame * (Math.PI / 2);
    const lay = Math.round(Math.sin(armPhase + Math.PI) * 3);
    const ray = Math.round(Math.sin(armPhase) * 3);
    c.rect(ox + 3, FH - 34 + lay, 5, 12, ...sh);   // left arm
    c.rect(ox + 32, FH - 34 + ray, 5, 12, ...sh);  // right arm
    c.rect(ox + 3, FH - 23 + lay, 5, 4, ...sk);    // left hand
    c.rect(ox + 32, FH - 23 + ray, 5, 4, ...sk);   // right hand
    // Neck
    c.rect(ox + 17, FH - 40, 6, 5, ...sk);
    // Head
    c.rect(ox + 12, FH - 48, 16, 12, ...sk);
    // Hair
    c.rect(ox + 12, FH - 48, 16, 4, ...hr);
    c.rect(ox + 12, FH - 44, 2, 4, ...hr); // sideburn L
    c.rect(ox + 26, FH - 44, 2, 4, ...hr); // sideburn R
    // Eyes
    c.px(ox + 15, FH - 42, 30, 20, 10);
    c.px(ox + 24, FH - 42, 30, 20, 10);
    c.px(ox + 16, FH - 41, 200, 150, 100); // eye shine
    c.px(ox + 25, FH - 41, 200, 150, 100);
    // Mouth
    c.rect(ox + 16, FH - 38, 7, 1, 180, 100, 80);
    // Backpack (frame detail)
    c.rect(ox + 7, FH - 36, 4, 10, 100, 70, 40);
    c.rect(ox + 7, FH - 30, 4, 2, 120, 90, 60);
  };

  for (let f = 0; f < FRAMES; f++) drawPlayer(sheet, f * FW, f);
  sheet.save(p('player.png'));
  // Also save idle frame alone
  const idle = new PC(FW, FH);
  drawPlayer(idle, 0, 0);
  idle.save(p('player-idle-32x32.png'));
}

// ─── NPC SPRITES (3 types, each 36×44 with 2 frames = 72×44 sheet) ──────────
function makeNPCSheet(wallColors, shirtR, shirtG, shirtB, hairR, hairG, hairB, label) {
  const FW = 36, FH = 44, FRAMES = 2;
  const sheet = new PC(FW * FRAMES, FH);
  const [skinR, skinG, skinB] = [255, 200, 160];

  for (let f = 0; f < FRAMES; f++) {
    const ox = f * FW;
    const bob = f === 1 ? 1 : 0; // breathing bob

    // Shoes
    sheet.rect(ox + 9, FH - 7, 7, 4, 40, 30, 20);
    sheet.rect(ox + 20, FH - 7, 7, 4, 40, 30, 20);
    // Pants
    sheet.rect(ox + 9, FH - 18, 7, 12, 50, 50, 90);
    sheet.rect(ox + 20, FH - 18, 7, 12, 50, 50, 90);
    // Shirt
    sheet.rect(ox + 6, FH - 28 - bob, 24, 11, shirtR, shirtG, shirtB);
    sheet.rect(ox + 6, FH - 28 - bob, 3, 11, Math.min(255, shirtR + 30), Math.min(255, shirtG + 20), Math.min(255, shirtB + 20));
    // Arms
    sheet.rect(ox + 2, FH - 26 - bob, 5, 10, shirtR, shirtG, shirtB);
    sheet.rect(ox + 29, FH - 26 - bob, 5, 10, shirtR, shirtG, shirtB);
    sheet.rect(ox + 2, FH - 17 - bob, 5, 4, skinR, skinG, skinB);
    sheet.rect(ox + 29, FH - 17 - bob, 5, 4, skinR, skinG, skinB);
    // Neck
    sheet.rect(ox + 15, FH - 32 - bob, 6, 5, skinR, skinG, skinB);
    // Head
    sheet.rect(ox + 11, FH - 44 - bob, 14, 13, skinR, skinG, skinB);
    // Hair
    sheet.rect(ox + 11, FH - 44 - bob, 14, 4, hairR, hairG, hairB);
    sheet.rect(ox + 11, FH - 40 - bob, 2, 4, hairR, hairG, hairB);
    sheet.rect(ox + 23, FH - 40 - bob, 2, 4, hairR, hairG, hairB);
    // Eyes
    sheet.px(ox + 14, FH - 37 - bob, 30, 20, 10);
    sheet.px(ox + 21, FH - 37 - bob, 30, 20, 10);
    sheet.px(ox + 15, FH - 36 - bob, 220, 180, 150);
    // Smile
    sheet.rect(ox + 15, FH - 33 - bob, 6, 1, 180, 100, 80);
    sheet.px(ox + 14, FH - 34 - bob, 180, 100, 80);
    sheet.px(ox + 21, FH - 34 - bob, 180, 100, 80);
  }
  sheet.save(p(`${label}.png`));
}

makeNPCSheet(null, 30, 100, 200, 50, 30, 10, 'npc-student');   // blue shirt student
makeNPCSheet(null, 180, 20, 20, 40, 20, 10, 'npc-fan');        // red shirt fan
makeNPCSheet(null, 80, 80, 80, 90, 70, 50, 'npc-citizen');     // grey shirt citizen

// ─── SHOP FACADES ─────────────────────────────────────────────────────────────
function makeShop(w, h, wallR, wallG, wallB, signR, signG, signB, awR, awG, awB, label, signText = '') {
  const c = new PC(w, h);
  // wall
  c.shade(0, 0, w, h, wallR + 30, wallG + 25, wallB + 20, wallR, wallG, wallB, wallR - 25, wallG - 20, wallB - 15);
  // large shop window
  c.rect(4, h - 34, w - 8, 24, 160, 210, 240);
  c.outline(3, h - 35, w - 6, 26, 40, 30, 20);
  // reflection
  c.rect(6, h - 32, 4, 20, 200, 235, 255, 130);
  c.rect(11, h - 32, 1, 20, 200, 235, 255, 70);
  // Awning
  for (let ax = 4; ax < w - 4; ax += 8) {
    c.rect(ax, h - 42, 4, 9, awR, awG, awB);
    c.rect(ax + 4, h - 42, 4, 9, Math.min(255, awR + 50), Math.min(255, awG + 40), Math.min(255, awB + 40));
  }
  c.rect(3, h - 43, w - 6, 2, Math.max(0, awR - 20), Math.max(0, awG - 20), Math.max(0, awB - 20));
  // Sign board
  c.rect(8, h - 54, w - 16, 13, signR, signG, signB);
  c.outline(7, h - 55, w - 14, 15, 20, 15, 10);
  c.rect(9, h - 53, w - 18, 1, Math.min(255, signR + 60), Math.min(255, signG + 50), Math.min(255, signB + 50));
  // upper windows
  for (let col = 0; col < 2; col++) {
    const wx = 6 + col * Math.round((w - 12) / 2);
    const winW = Math.round((w - 18) / 2);
    c.rect(wx, 6, winW, 20, 150, 190, 220);
    c.outline(wx, 6, winW, 20, 50, 40, 30);
    c.rect(wx, 6, 2, 20, 190, 220, 245, 100);
    // curtains
    c.rect(wx + winW - 4, 6, 4, 20, 220, 180, 150);
  }
  // door
  const dw = Math.round(w * 0.22);
  const dx = Math.round((w - dw) / 2);
  c.rect(dx, h - dw - 2, dw, dw + 2, 80, 55, 30);
  c.rect(dx, h - dw - 2, dw, 3, 100, 70, 40);
  c.rect(dx, h - dw - 2, 2, dw + 2, 100, 70, 40);
  c.rect(dx + dw - 2, h - dw - 2, 2, dw + 2, 100, 70, 40);
  c.px(dx + dw - 4, h - dw / 2, 200, 160, 40);
  c.outline(0, 0, w, h, 20, 15, 10);
  c.save(p(`${label}.png`));
}

makeShop(96, 96, 220,190,140, 40,80,170, 220,80,30, 'shop-bakery');    // warm stone, blue sign, orange awn
makeShop(96, 96, 160,120,180, 80,40,120, 60,100,180, 'shop-souvenir'); // lavender wall, purple sign, blue awn

// ─── TILES ────────────────────────────────────────────────────────────────────
// Cobblestone 32×32
{
  const c = new PC(32, 32);
  c.rect(0, 0, 32, 32, 130, 125, 115);
  const stones = [[2,2,11,7],[14,2,15,7],[2,10,10,8],[13,10,16,8],[1,19,12,7],[14,19,14,7],[2,27,9,4],[12,27,16,4]];
  stones.forEach(([sx, sy, sw, sh]) => {
    const lit = sx < 12;
    const br = lit ? 20 : -15;
    c.shade(sx, sy, sw, sh, 155 + br, 150 + br, 140 + br, 140 + br, 135 + br, 125 + br, 110 + br, 105 + br, 95 + br);
    c.outline(sx, sy, sw, sh, 80, 75, 65);
  });
  c.save(p('tile-cobblestone-32x32.png'));
}

// Grass 32×32
{
  const c = new PC(32, 32);
  c.rect(0, 0, 32, 32, 55, 120, 50);
  // grass blades
  for (let gx = 0; gx < 32; gx += 3) {
    const ht = 2 + (gx * 7 % 4);
    c.rect(gx, 0, 1, ht, 80, 160, 60);
    c.rect(gx + 1, 0, 1, ht - 1, 70, 145, 50);
  }
  // random variation dots
  [[5,8],[12,14],[22,9],[28,20],[4,25],[18,28]].forEach(([dx, dy]) => {
    c.px(dx, dy, 45, 105, 40);
    c.px(dx + 1, dy, 65, 135, 55);
  });
  c.save(p('tile-grass-32x32.png'));
}

// Road tiles
function makeRoadH() {
  const c = new PC(32, 32);
  c.rect(0, 0, 32, 32, 60, 60, 75);
  c.rect(0, 0, 32, 3, 80, 80, 95);    // top curb
  c.rect(0, 29, 32, 3, 40, 40, 55);   // bottom curb
  c.rect(0, 14, 32, 4, 200, 200, 220); // centre line
  for (let lx = 4; lx < 32; lx += 8) c.rect(lx, 14, 4, 4, 60, 60, 75); // dashes
  c.save(p('tile-road-h-32x32.png'));
}
function makeRoadV() {
  const c = new PC(32, 32);
  c.rect(0, 0, 32, 32, 60, 60, 75);
  c.rect(0, 0, 3, 32, 80, 80, 95);
  c.rect(29, 0, 3, 32, 40, 40, 55);
  c.rect(14, 0, 4, 32, 200, 200, 220);
  for (let ly = 4; ly < 32; ly += 8) c.rect(14, ly, 4, 4, 60, 60, 75);
  c.save(p('tile-road-v-32x32.png'));
}
function makeRoadX() {
  const c = new PC(32, 32);
  c.rect(0, 0, 32, 32, 60, 60, 75);
  c.rect(14, 0, 4, 32, 200, 200, 220);
  c.rect(0, 14, 32, 4, 200, 200, 220);
  for (let s = 0; s < 32; s += 4) {
    c.rect(s, 0, 2, 14, 90, 90, 110);
    c.rect(s, 18, 2, 14, 90, 90, 110);
  }
  c.save(p('tile-road-cross-32x32.png'));
}
makeRoadH(); makeRoadV(); makeRoadX();

// Sidewalk
{
  const c = new PC(32, 32);
  c.rect(0, 0, 32, 32, 185, 180, 170);
  for (let sy = 0; sy < 32; sy += 8) {
    for (let sx = 0; sx < 32; sx += 8) {
      const lit = (sx + sy) % 16 === 0;
      c.rect(sx, sy, 8, 8, lit ? 195 : 175, lit ? 190 : 170, lit ? 180 : 160);
      c.rect(sx, sy, 8, 1, 200, 195, 185);
      c.rect(sx, sy, 1, 8, 200, 195, 185);
    }
  }
  c.save(p('tile-sidewalk-32x32.png'));
}

// Water
{
  const c = new PC(32, 32);
  c.rect(0, 0, 32, 32, 20, 80, 160);
  for (let wy = 0; wy < 32; wy += 6) {
    for (let wx = 0; wx < 32; wx += 4) {
      c.rect(wx, wy + (wx % 3), 3, 1, 40, 110, 200, 180);
    }
  }
  c.rect(0, 0, 32, 2, 30, 100, 180, 150);
  c.save(p('tile-water-32x32.png'));
}

// Tree
{
  const c = new PC(40, 56);
  // trunk
  c.rect(16, 36, 8, 20, 100, 65, 30);
  c.rect(18, 36, 3, 20, 130, 85, 40);
  c.rect(16, 52, 8, 4, 80, 50, 20);
  // canopy layers (3 tiers)
  [[20, 28, 26, 10], [14, 18, 26, 14], [8, 8, 28, 14]].forEach(([cx, cy, cw, ch], i) => {
    const g = 120 - i * 15;
    c.rect(cx, cy, cw, ch, 30, g, 30);
    c.rect(cx, cy, cw, 2, 50, g + 30, 50);
    c.rect(cx, cy, 2, ch, 50, g + 20, 50);
    c.rect(cx + cw - 2, cy, 2, ch, 20, Math.max(0, g - 20), 20);
    // fruit/berries
    if (i === 0) { c.px(cx + 5, cy + 4, 220, 60, 40); c.px(cx + 15, cy + 6, 220, 60, 40); }
  });
  c.outline(8, 8, 28, 50, 15, 40, 15);
  c.save(p('tree-park.png'));
}

// Lamp post
{
  const c = new PC(16, 48);
  c.rect(7, 40, 4, 8, 80, 80, 90);     // base
  c.rect(8, 8, 2, 35, 90, 90, 100);    // pole
  c.rect(4, 6, 10, 4, 100, 100, 110);  // arm
  c.rect(5, 2, 8, 6, 255, 240, 180);   // lamp globe
  c.rect(6, 3, 6, 4, 255, 255, 200, 200); // glow
  c.px(6, 0, 255, 240, 180, 150);
  c.px(10, 0, 255, 240, 180, 150);
  c.save(p('lamp-post.png'));
}

// Duck
{
  const c = new PC(20, 14);
  c.rect(2, 5, 14, 7, 240, 220, 80);    // body
  c.rect(4, 4, 10, 9, 240, 220, 80);
  c.rect(5, 1, 7, 6, 240, 220, 80);     // head
  c.rect(8, 0, 4, 2, 255, 140, 0);      // bill
  c.px(7, 2, 20, 20, 20);              // eye
  c.px(8, 2, 80, 60, 220, 150);         // shine
  c.rect(2, 11, 14, 3, 200, 180, 50);   // wing shade
  c.rect(0, 9, 5, 4, 200, 180, 50);     // wing fold
  c.save(p('duck.png'));
}

// Diabelki (Gliwice Fauns sculpture)
{
  const c = new PC(40, 52);
  // pedestal
  c.rect(8, 42, 24, 10, 160, 140, 110);
  c.shade(8, 42, 24, 10, 180, 160, 130, 160, 140, 110, 120, 100, 80);
  c.rect(6, 40, 28, 3, 170, 150, 120);
  // base figure
  c.rect(14, 26, 12, 16, 80, 90, 110);   // body/cape
  // left arm up
  c.rect(8, 16, 6, 12, 200, 160, 120);
  c.rect(7, 10, 6, 8, 200, 160, 120);
  // right arm
  c.rect(26, 18, 6, 12, 200, 160, 120);
  // head
  c.rect(15, 16, 10, 12, 220, 180, 150);
  c.rect(14, 14, 12, 4, 60, 40, 20);     // hair
  // horns (it's a faun!)
  c.rect(15, 10, 2, 5, 180, 150, 100);
  c.rect(23, 10, 2, 5, 180, 150, 100);
  // eyes
  c.px(17, 20, 30, 20, 10);
  c.px(22, 20, 30, 20, 10);
  // tail
  c.rect(26, 30, 4, 8, 150, 120, 80);
  c.rect(28, 36, 4, 6, 130, 100, 60);
  c.outline(8, 10, 24, 42, 30, 25, 20);
  c.save(p('landmark-diabelki.png'));
}

// Cafe umbrella
{
  const c = new PC(48, 52);
  // pole
  c.rect(23, 20, 3, 32, 160, 140, 100);
  // canopy
  for (let seg = 0; seg < 6; seg++) {
    const a = (seg / 6) * Math.PI * 2;
    const a2 = ((seg + 1) / 6) * Math.PI * 2;
    const col = seg % 2 === 0 ? [220, 50, 50] : [240, 240, 240];
    for (let r = 0; r < 22; r++) {
      const x1 = Math.round(24 + r * Math.cos(a));
      const x2 = Math.round(24 + r * Math.cos(a2));
      const y = Math.round(14 + r * 0.45);
      const xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
      if (xMax > xMin) c.rect(xMin, y, xMax - xMin, 1, ...col);
    }
  }
  // rim
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    c.px(Math.round(24 + 22 * Math.cos(a)), Math.round(14 + 10 * Math.sin(a) * 0.45), 80, 60, 40);
  }
  // finial top
  c.rect(21, 10, 7, 6, 200, 160, 60);
  c.save(p('cafe-umbrella.png'));
}

// Bench
{
  const c = new PC(36, 22);
  // legs
  c.rect(2, 12, 4, 10, 80, 60, 30);
  c.rect(30, 12, 4, 10, 80, 60, 30);
  // seat slats
  for (let sx = 0; sx < 3; sx++) {
    c.rect(sx * 12, 10, 10, 5, 140, 100, 50);
    c.rect(sx * 12, 10, 10, 1, 170, 130, 70);
  }
  // back rest
  for (let sx = 0; sx < 3; sx++) {
    c.rect(sx * 12, 3, 10, 6, 130, 90, 40);
    c.rect(sx * 12, 3, 10, 1, 160, 120, 60);
  }
  // back support
  c.rect(2, 3, 3, 12, 90, 65, 30);
  c.rect(31, 3, 3, 12, 90, 65, 30);
  c.save(p('bench.png'));
}

// Flower pot
{
  const c = new PC(24, 28);
  // pot
  c.rect(4, 16, 16, 12, 180, 80, 30);
  c.rect(3, 14, 18, 4, 160, 70, 25);
  c.rect(4, 16, 3, 12, 210, 100, 50); // highlight
  // soil
  c.rect(5, 14, 14, 3, 80, 55, 30);
  // flowers
  const flPos = [[8, 4], [14, 6], [11, 2], [6, 8], [16, 3]];
  const flCol = [[220, 50, 50], [255, 200, 0], [200, 50, 200], [50, 200, 50], [255, 140, 0]];
  flPos.forEach(([fx, fy], i) => {
    c.rect(fx - 1, fy, 3, 3, ...flCol[i]);
    c.px(fx, fy + 1, 255, 255, 200);
  });
  // stem
  c.rect(11, 8, 2, 7, 50, 150, 50);
  c.rect(8, 10, 4, 2, 60, 170, 60);  // leaf
  c.save(p('flower-pot.png'));
}

// Icon heart
{
  const c = new PC(16, 16);
  const heart = [
    [0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],
    [0,0,1,1,1,1,0,0,1,1,1,1,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];
  heart.forEach((row, y) => row.forEach((p2, x) => {
    if (p2) c.px(x, y + 2, 220, 30, 50);
    if (p2 && x < 4 && y < 4) c.px(x, y + 2, 255, 100, 120);
  }));
  c.save(p('icon-heart-16x16.png'));
}

// Icon clock
{
  const c = new PC(16, 16);
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    c.px(Math.round(8 + 7 * Math.cos(a)), Math.round(8 + 7 * Math.sin(a)), 200, 200, 220);
  }
  c.rect(6, 6, 5, 5, 180, 180, 200);
  // hour hand
  c.rect(8, 4, 1, 4, 50, 50, 80);
  // minute hand
  c.rect(8, 8, 4, 1, 50, 50, 80);
  c.px(8, 8, 30, 30, 60);
  c.save(p('icon-clock-16x16.png'));
}

// Badge
{
  const c = new PC(24, 28);
  // ribbon
  c.rect(8, 20, 8, 8, 200, 30, 30);
  c.rect(4, 20, 5, 8, 180, 20, 20);
  c.rect(15, 20, 5, 8, 220, 40, 40);
  // medal circle
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    c.px(Math.round(12 + 11 * Math.cos(a)), Math.round(12 + 11 * Math.sin(a)), 180, 130, 20);
  }
  c.rect(3, 3, 18, 18, 220, 180, 40);
  c.rect(4, 4, 16, 16, 240, 200, 60);
  // star
  [[12,5],[12,19],[5,10],[19,10],[7,7],[17,7],[7,17],[17,17]].forEach(([sx,sy]) => {
    c.px(sx, sy, 255, 240, 100);
    c.px(sx + 1, sy, 255, 240, 100);
  });
  c.rect(9, 9, 6, 6, 255, 240, 100);
  c.save(p('badge.png'));
}

// Menu background
{
  const W = 960, H = 540;
  const c = new PC(W, H);
  c.rect(0, 0, W, H, 10, 15, 30);
  // city silhouette
  const buildings2 = [
    [0, 300, 80, 240], [80, 320, 60, 220], [140, 280, 100, 260],
    [240, 310, 70, 230], [310, 260, 120, 280], [430, 300, 90, 240],
    [520, 270, 60, 270], [580, 290, 110, 250], [690, 250, 80, 290],
    [770, 300, 70, 240], [840, 270, 120, 270],
  ];
  buildings2.forEach(([x, y, w, h]) => {
    c.rect(x, y, w, h, 20, 30, 60);
    // windows
    for (let wy = y + 10; wy < y + h - 10; wy += 16) {
      for (let wx = x + 8; wx < x + w - 8; wx += 14) {
        if (Math.random() > 0.3) c.rect(wx, wy, 7, 9, 255, 240, 150, 180);
        else c.rect(wx, wy, 7, 9, 30, 40, 70);
      }
    }
    // roof
    c.rect(x, y, w, 4, 30, 45, 90);
  });
  // stars
  for (let s = 0; s < 200; s++) {
    const sx = Math.round(Math.random() * W);
    const sy = Math.round(Math.random() * 250);
    const br = Math.round(150 + Math.random() * 105);
    c.px(sx, sy, br, br, br, Math.round(100 + Math.random() * 155));
  }
  // moon
  c.rect(820, 40, 50, 50, 240, 230, 200);
  for (let a = 0; a < Math.PI * 2; a += 0.05)
    c.px(Math.round(845 + 24 * Math.cos(a)), Math.round(65 + 24 * Math.sin(a)), 220, 210, 180);
  // title
  c.save(p('menu-bg.png'));
}

// ─── LANDMARK SPRITES ─────────────────────────────────────────────────────────
function landmark(w, h, drawFn, fname) {
  const c = new PC(w, h);
  drawFn(c, w, h);
  c.save(p(fname));
}

// Radio Tower
landmark(64, 160, (c, W, H) => {
  // base
  c.rect(20, H - 20, 24, 20, 120, 100, 80);
  c.shade(20, H - 20, 24, 20, 145, 125, 100, 120, 100, 80, 90, 75, 60);
  // lattice tower – tapers
  for (let ty = 0; ty < H - 20; ty++) {
    const t = ty / (H - 20);
    const halfW = Math.round(12 * (1 - t * 0.85));
    const tx = W / 2 - halfW;
    c.rect(tx, ty, 2, 1, 150, 150, 170);
    c.rect(W / 2 + halfW - 2, ty, 2, 1, 150, 150, 170);
    if (ty % 12 === 0 || ty % 12 === 6) {
      c.rect(tx, ty, halfW * 2, 1, 130, 130, 150);
    }
  }
  // red/white stripes
  for (let s = 0; s < 8; s++) {
    const sy = s * 18;
    const hw = Math.round(12 * (1 - (sy / (H - 20)) * 0.85));
    c.rect(W / 2 - hw, sy, hw * 2, 6, s % 2 === 0 ? 200 : 240, s % 2 === 0 ? 30 : 240, s % 2 === 0 ? 30 : 240);
  }
  // beacon
  c.px(W / 2, 0, 255, 60, 60);
  c.px(W / 2 - 1, 1, 255, 80, 80);
  c.px(W / 2 + 1, 1, 255, 80, 80);
}, 'landmark-radio-tower-32x32.png');


// Market Square / Ratusz
landmark(128, 112, (c, W, H) => {
  // base
  c.rect(20, H - 24, W - 40, 24, 200, 180, 140);
  // clock tower
  c.shade(W / 2 - 14, 8, 28, H - 24, 210, 190, 150, 190, 170, 130, 140, 120, 90);
  // tower roof
  for (let i = 0; i < 20; i++) {
    const rw = 28 - i;
    c.rect(W / 2 - rw / 2, 8 - i, rw, 1, 180, 60, 40);
  }
  // clock face
  c.rect(W / 2 - 10, 22, 20, 20, 240, 240, 220);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    c.px(Math.round(W / 2 + 8 * Math.cos(a)), Math.round(32 + 8 * Math.sin(a)), 50, 40, 30);
  }
  c.rect(W / 2 - 1, 25, 1, 7, 50, 40, 30); // hour hand
  c.rect(W / 2, 25, 7, 1, 50, 40, 30);     // minute hand
  // wings
  c.shade(20, 60, W / 2 - 28, H - 60 - 24, 205, 185, 145, 185, 165, 125, 135, 115, 85);
  c.shade(W / 2 + 14, 60, W / 2 - 28, H - 60 - 24, 205, 185, 145, 185, 165, 125, 135, 115, 85);
  // windows all over
  [[30, 65], [50, 65], [80, 65], [100, 65], [30, 80], [50, 80], [80, 80], [100, 80]].forEach(([wx, wy]) => {
    c.rect(wx, wy, 12, 16, 100, 140, 180);
    c.outline(wx, wy, 12, 16, 60, 50, 30);
  });
  // arch entrance
  c.rect(W / 2 - 10, H - 24, 20, 24, 60, 45, 30);
  c.rect(W / 2 - 9, H - 24, 18, 2, 100, 80, 50); // arch top
}, 'landmark-market-square-48x48.png');

// Palm House
landmark(144, 96, (c, W, H) => {
  // greenhouse structure
  c.rect(10, H - 30, W - 20, 30, 180, 200, 180);
  // glass panels
  for (let px2 = 12; px2 < W - 12; px2 += 16) {
    c.rect(px2, H - 28, 14, 26, 160, 220, 160, 180);
    c.outline(px2, H - 28, 14, 26, 80, 120, 80);
  }
  // domed roof
  for (let a = 0; a < Math.PI; a += 0.05) {
    const rx = Math.round(W / 2 + (W / 2 - 10) * Math.cos(a));
    const ry = Math.round(H - 30 - 40 * Math.sin(a));
    c.px(rx, ry, 150, 210, 150, 200);
    c.px(rx, ry + 1, 130, 190, 130, 150);
  }
  // palms inside
  [[30, H - 10], [W / 2, H - 8], [W - 30, H - 10]].forEach(([tx, ty]) => {
    c.rect(tx, ty - 20, 3, 20, 100, 70, 30);
    for (let la = 0; la < 8; la++) {
      const langle = (la / 8) * Math.PI * 2;
      for (let lr = 0; lr < 12; lr++) {
        c.px(Math.round(tx + lr * Math.cos(langle)), Math.round(ty - 20 - lr * 0.3 + lr * Math.sin(langle) * 0.4), 40, 160, 60);
      }
    }
  });
  c.outline(10, 0, W - 20, H, 60, 100, 60);
}, 'landmark-palm-house-48x48.png');

// Simple placeholder for remaining landmarks
const landmarkDefs = [
  { file: 'landmark-all-saints-48x48.png', w: 80, h: 144,
    draw(c, W, H) {
      c.rect(20, H - 40, W - 40, 40, 200, 180, 150);
      c.shade(30, 20, W - 60, H - 80, 210, 190, 160, 190, 170, 140, 140, 120, 100);
      for (let i = 0; i < 30; i++) c.rect(W / 2 - (15 - i / 2), 20 - i, 30 - i, 1, 180, 60, 30);
      c.rect(W / 2 - 4, 0, 8, 24, 190, 170, 140);
      [[30,60],[50,60],[30,80],[50,80]].forEach(([wx,wy]) => { c.rect(wx, wy, 10, 18, 100, 140, 180); c.outline(wx,wy,10,18,60,50,30); });
      c.rect(W / 2 - 6, H - 40, 12, 40, 50, 35, 20);
    }
  },
  { file: 'landmark-piast-castle-48x48.png', w: 128, h: 96,
    draw(c, W, H) {
      c.rect(10, 40, W - 20, H - 40, 160, 140, 110);
      c.shade(10, 40, W - 20, H - 40, 185, 165, 135, 160, 140, 110, 120, 100, 75);
      c.rect(30, 8, 30, 38, 170, 150, 120); // tower
      c.shade(30, 8, 30, 38, 195, 175, 145, 170, 150, 120, 130, 110, 85);
      for (let mx = 30; mx < 60; mx += 6) c.rect(mx, 8, 4, 6, 90, 75, 55);
      for (let mx = 10; mx < W - 10; mx += 6) c.rect(mx, 40, 4, 6, 90, 75, 55);
      [[40,20],[55,70],[90,70]].forEach(([wx,wy]) => { c.rect(wx, wy, 12, 18, 80,100,140); c.outline(wx,wy,12,18,50,40,25); });
    }
  },
  { file: 'landmark-silesian-tech-48x48.png', w: 144, h: 96,
    draw(c, W, H) {
      c.rect(0, H - 40, W, 40, 200, 185, 155);
      c.shade(20, 16, W - 40, H - 56, 215, 200, 170, 195, 180, 150, 145, 130, 105);
      c.rect(60, 0, 24, 20, 180, 165, 135); // central pediment
      c.shade(60, 0, 24, 20, 200, 185, 160, 180, 165, 135, 140, 125, 100);
      for (let col = 0; col < 8; col++) {
        const cx = 18 + col * 14;
        for (let row = 0; row < 3; row++) {
          c.rect(cx, H - 38 + row * 12, 10, 10, 150, 190, 220);
          c.outline(cx, H - 38 + row * 12, 10, 10, 60, 50, 35);
        }
      }
    }
  },
  { file: 'landmark-theatre-48x48.png', w: 128, h: 96,
    draw(c, W, H) {
      c.rect(0, H - 35, W, 35, 180, 100, 60);
      c.shade(10, 18, W - 20, H - 53, 215, 130, 80, 195, 110, 60, 150, 80, 35);
      for (let i = 0; i < 22; i++) c.rect(W / 2 - (20 - i / 2), 18 - i, 40 - i, 1, 160, 60, 30);
      for (let col = 0; col < 5; col++) {
        const cx = 14 + col * 20;
        c.rect(cx, 22, 8, H - 57, 185, 105, 55);
        c.rect(cx + 2, 28, 4, 20, 140, 185, 220);
        c.outline(cx + 2, 28, 4, 20, 50,40,25);
      }
      c.rect(W / 2 - 12, H - 35, 24, 35, 40, 28, 15);
    }
  },
  { file: 'landmark-piast-stadium-48x48.png', w: 144, h: 96,
    draw(c, W, H) {
      c.rect(10, H - 28, W - 20, 28, 50, 140, 60);
      for (let a = 0; a < Math.PI * 2; a += 0.06) {
        const rx = Math.round(W / 2 + 65 * Math.cos(a));
        const ry = Math.round(H - 28 - 32 * Math.sin(Math.max(0, a)));
        if (ry < H - 28) c.px(rx, ry, 160, 160, 180);
      }
      c.rect(20, H - 46, W - 40, 18, 80, 80, 100);
      c.rect(22, H - 44, W - 44, 14, 40, 160, 70); // pitch
      // pitch lines
      c.rect(W / 2 - 1, H - 44, 2, 14, 255, 255, 255);
      c.rect(22, H - 37, W - 44, 1, 255, 255, 255);
    }
  },
  { file: 'landmark-willa-caro.png', w: 112, h: 80,
    draw(c, W, H) {
      c.shade(12, 20, W - 24, H - 20, 230, 220, 195, 210, 200, 175, 165, 155, 130);
      for (let i = 0; i < 20; i++) c.rect(W / 2 - (20 - i / 2), 20 - i, 40 - i, 1, 120, 70, 40);
      [[18,28],[40,28],[62,28],[84,28],[18,50],[40,50],[62,50],[84,50]].forEach(([wx,wy]) => {
        c.rect(wx,wy,14,18,130,170,210); c.outline(wx,wy,14,18,60,50,35);
      });
      c.rect(W/2-10,H-20,20,20,60,40,20);
    }
  },
  { file: 'landmark-dworzec-pkp.png', w: 144, h: 80,
    draw(c, W, H) {
      c.shade(0, 18, W, H - 18, 220, 200, 160, 200, 180, 140, 155, 135, 100);
      c.rect(40, 0, 64, 22, 190, 170, 130);
      c.shade(40, 0, 64, 22, 215, 195, 155, 190, 170, 130, 145, 125, 95);
      for (let col = 0; col < 6; col++) {
        const cx = 6 + col * 22;
        c.rect(cx, 24, 16, 28, 140, 185, 220);
        c.outline(cx, 24, 16, 28, 50,40,25);
      }
      // train tracks
      c.rect(0, H - 10, W, 4, 80, 80, 90);
      c.rect(0, H - 4, W, 4, 90, 90, 100);
      for (let tx = 0; tx < W; tx += 12) c.rect(tx, H - 10, 2, 8, 60,60,70);
      c.rect(W/2-15,H-18,30,18,50,35,20);
    }
  },
  { file: 'landmark-ruiny-teatru.png', w: 112, h: 80,
    draw(c, W, H) {
      // ruined walls
      [[0,20,20,60],[20,35,25,45],[45,10,15,70],[60,30,20,50],[80,15,22,65]].forEach(([wx,wy,ww,wh]) => {
        c.shade(wx,wy,ww,wh,175,155,130,155,135,110,115,95,75);
        // cracks
        for (let ck = 0; ck < 3; ck++) c.px(wx + ck * 5, wy + ck * 7, 80,65,50);
      });
      // rubble at bottom
      for (let rx = 0; rx < W; rx += 4) {
        c.rect(rx, H - 12 + (rx % 8 > 4 ? 2 : 0), 3 + rx % 3, 12 - (rx % 6), 120, 100, 80);
      }
      // vegetation growing
      for (let vx = 5; vx < W; vx += 20) {
        c.rect(vx, H - 20, 2, 10, 50, 130, 50);
        c.rect(vx - 2, H - 22, 6, 4, 40, 160, 40);
      }
    }
  },
  { file: 'landmark-arena-gliwice.png', w: 144, h: 80,
    draw(c, W, H) {
      // modern arena oval shell
      for (let a = 0; a < Math.PI * 2; a += 0.04) {
        const ax = Math.round(W / 2 + 65 * Math.cos(a));
        const ay = Math.round(H / 2 + 25 * Math.sin(a));
        c.px(ax, ay, 40, 80, 160);
        c.px(ax - 1, ay, 30, 60, 140);
      }
      // fill
      for (let fy = H / 2 - 22; fy < H / 2 + 22; fy++) {
        const fw = Math.round(60 * Math.sqrt(1 - Math.pow((fy - H / 2) / 22, 2)));
        c.rect(W / 2 - fw, fy, fw * 2, 1, 25, 45, 100);
      }
      // roof panels
      for (let rp = 0; rp < 12; rp++) {
        const ra = (rp / 12) * Math.PI * 2;
        const rx = Math.round(W / 2 + 55 * Math.cos(ra));
        const ry = Math.round(H / 2 + 18 * Math.sin(ra));
        c.rect(rx - 4, ry - 2, 8, 4, 50, 90, 180);
      }
      // logo
      c.rect(W / 2 - 15, H / 2 - 8, 30, 16, 240, 60, 40);
      c.rect(W / 2 - 13, H / 2 - 6, 26, 12, 255, 80, 50);
    }
  },
];

landmarkDefs.forEach(({ file, w, h, draw }) => {
  const c = new PC(w, h);
  draw(c, w, h);
  c.save(p(file));
});

// ─── VEHICLE SPRITES ──────────────────────────────────────────────────────────
function makeCar(bodyR, bodyG, bodyB, label) {
  const W = 48, H = 24;
  const c = new PC(W, H);
  // body
  c.shade(2, 6, W - 4, H - 10, bodyR + 30, bodyG + 20, bodyB + 20, bodyR, bodyG, bodyB, bodyR - 30, bodyG - 25, bodyB - 25);
  // cabin
  c.shade(8, 2, 28, 8, bodyR + 40, bodyG + 30, bodyB + 30, bodyR + 20, bodyG + 10, bodyB + 10, bodyR - 10, bodyG - 10, bodyB - 10);
  // windows
  c.rect(10, 3, 10, 6, 160, 210, 240, 200);
  c.rect(22, 3, 12, 6, 160, 210, 240, 200);
  c.rect(11, 3, 2, 6, 200, 235, 255, 100);
  // wheels
  [[4, H - 7], [36, H - 7]].forEach(([wx, wy]) => {
    c.rect(wx, wy, 8, 7, 30, 30, 35);
    c.rect(wx + 2, wy + 1, 4, 5, 80, 80, 90);
    c.rect(wx + 3, wy + 2, 2, 3, 160, 160, 170);
  });
  // headlights
  c.rect(W - 4, 8, 4, 4, 255, 255, 200);
  c.rect(0, 8, 4, 4, 200, 80, 40);   // tail lights
  // licence plate
  c.rect(18, H - 6, 12, 4, 240, 240, 240);
  c.rect(19, H - 5, 10, 2, 200, 200, 220);
  c.outline(2, 2, W - 4, H - 4, 20, 15, 10);
  c.save(p(`car-${label}.png`));
}
makeCar(200, 40, 40, 'red');
makeCar(40, 80, 200, 'blue');
makeCar(220, 180, 30, 'yellow');

// Bus
{
  const W = 80, H = 28;
  const c = new PC(W, H);
  c.shade(0, 2, W, H - 6, 240, 180, 20, 210, 150, 10, 160, 110, 5);
  // windows row
  for (let wx = 8; wx < W - 12; wx += 14) {
    c.rect(wx, 4, 11, 12, 160, 215, 240, 200);
    c.outline(wx, 4, 11, 12, 40, 60, 80);
    c.rect(wx, 4, 2, 12, 200, 235, 255, 100);
  }
  // destination board
  c.rect(W - 18, 4, 14, 10, 20, 20, 60);
  c.rect(W - 17, 5, 12, 3, 50, 50, 200);
  // door
  c.rect(6, 4, 6, 14, 180, 140, 10);
  // wheels
  [[6, H - 8], [60, H - 8]].forEach(([wx, wy]) => {
    c.rect(wx, wy, 10, 8, 30, 30, 35);
    c.rect(wx + 2, wy + 1, 6, 6, 70, 70, 80);
  });
  c.rect(0, 14, 4, 4, 255, 100, 0);  // front light
  c.outline(0, 2, W, H - 4, 20, 15, 5);
  c.save(p('bus-gliwice.png'));
}

// Tram
{
  const W = 80, H = 26;
  const c = new PC(W, H);
  c.shade(0, 2, W, H - 4, 10, 140, 200, 0, 110, 170, 0, 70, 120);
  for (let wx = 4; wx < W - 8; wx += 12) {
    c.rect(wx, 4, 9, 12, 160, 215, 240, 190);
    c.outline(wx, 4, 9, 12, 20, 60, 90);
  }
  c.rect(0, 0, W, 2, 220, 220, 240); // tram rail contact
  c.rect(W - 12, 4, 8, 10, 20, 20, 60);
  [[4, H - 6], [62, H - 6]].forEach(([wx, wy]) => {
    c.rect(wx, wy, 10, 6, 30, 30, 35);
    c.rect(wx + 2, wy + 1, 6, 4, 70, 70, 80);
  });
  c.rect(0, 10, 4, 4, 255, 230, 50);
  c.outline(0, 2, W, H - 2, 0, 50, 90);
  c.save(p('tram-gliwice.png'));
}

console.log('\n✅ All high-quality pixel art assets generated!');
