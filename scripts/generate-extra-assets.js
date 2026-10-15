import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const c = crc32(typeAndData);
  chunk.writeUInt32BE(c, 8 + len);
  return chunk;
}

function encodePNG(width, height, rgbaBuffer) {
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = makeChunk('IHDR', ihdr);

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let srcOffset = 0;
  let dstOffset = 0;
  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0;
    rgbaBuffer.copy(scanlines, dstOffset, srcOffset, srcOffset + width * 4);
    dstOffset += width * 4;
    srcOffset += width * 4;
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }

  set(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const idx = (y * this.w + x) * 4;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }

  setHex(x, y, hex, a = 255) {
    if (!hex) return;
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    this.set(x, y, r, g, b, a);
  }

  rect(x, y, w, h, hex, a = 255) {
    for (let py = Math.floor(y); py < Math.floor(y + h); py++) {
      for (let px = Math.floor(x); px < Math.floor(x + w); px++) {
        this.setHex(px, py, hex, a);
      }
    }
  }

  strokeRect(x, y, w, h, hex) {
    for (let px = x; px < x + w; px++) {
      this.setHex(px, y, hex);
      this.setHex(px, y + h - 1, hex);
    }
    for (let py = y; py < y + h; py++) {
      this.setHex(x, py, hex);
      this.setHex(x + w - 1, py, hex);
    }
  }

  fillCircle(cx, cy, radius, hex, a = 255) {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (Math.hypot(x - cx, y - cy) <= radius) {
          this.setHex(x, y, hex, a);
        }
      }
    }
  }

  strokeCircle(cx, cy, radius, hex) {
    for (let deg = 0; deg < 360; deg += 3) {
      const rad = deg * Math.PI / 180;
      const px = Math.round(cx + Math.cos(rad) * radius);
      const py = Math.round(cy + Math.sin(rad) * radius);
      this.setHex(px, py, hex);
    }
  }

  line(x0, y0, x1, y1, hex) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;
    while (true) {
      this.setHex(cx, cy, hex);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
  }

  toBuffer() {
    return encodePNG(this.w, this.h, this.data);
  }
}

const outDir = path.resolve('public/assets/images');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function save(name, canvas) {
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, canvas.toBuffer());
  console.log(`Saved: ${name} (${canvas.w}x${canvas.h})`);
}

// =========================================================================
// 1. DUŻY GRACZ I POSTACIE NPC (BARDZIEJ WIDOCZNI, WYŻSZA ROZDZIELCZOŚĆ)
// =========================================================================

// --- GRACZ / TURYSTA (40x48) - WYRAŹNY, CZYTELNY ---
{
  const c = new PixelCanvas(40, 48);
  const outline = '#1A1A1A';

  // Cień
  c.fillCircle(20, 44, 11, '#000000', 130);

  // Buty / trampki czerwone
  c.rect(11, 38, 7, 7, '#C62828');
  c.rect(22, 38, 7, 7, '#C62828');
  c.strokeRect(10, 37, 9, 9, outline);
  c.strokeRect(21, 37, 9, 9, outline);

  // Dżinsy niebieskie
  c.rect(12, 26, 16, 13, '#1565C0');
  c.strokeRect(11, 25, 18, 15, outline);
  c.rect(19, 29, 2, 10, '#0D47A1');

  // Kurtka turystyczna zielona z plecakiem
  c.rect(9, 14, 22, 13, '#2E7D32');
  c.strokeRect(8, 13, 24, 15, outline);

  // Paski plecaka i zamek
  c.rect(12, 14, 3, 12, '#8D6E63');
  c.rect(25, 14, 3, 12, '#8D6E63');
  c.rect(19, 14, 2, 12, '#FFD700'); // złoty suwak

  // Szalik w barwach Piasta Gliwice (niebiesko-czerwony!)
  c.rect(11, 11, 18, 5, '#1565C0');
  c.rect(15, 11, 6, 5, '#E53935');
  c.rect(24, 13, 4, 9, '#E53935'); // zwisający koniec szalika

  // Głowa i twarz
  c.rect(13, 2, 14, 11, '#FFCC80');
  c.strokeRect(12, 1, 16, 13, outline);
  // Brązowe włosy
  c.rect(12, 1, 16, 5, '#4E342E');
  // Oczy
  c.setHex(16, 6, outline);
  c.setHex(23, 6, outline);
  // Uśmiech
  c.rect(18, 9, 4, 1, '#D84315');

  save('player.png', c);
  save('player-idle-32x32.png', c);
}

// --- NPC 1: STUDENT POLITECHNIKI (36x44) ---
{
  const c = new PixelCanvas(36, 44);
  const outline = '#1A1A1A';
  c.fillCircle(18, 40, 9, '#000000', 120);

  // Buty i spodnie
  c.rect(10, 24, 16, 17, '#37474F');
  c.strokeRect(9, 23, 18, 19, outline);

  // Bluza z kapturem (niebieska)
  c.rect(9, 13, 18, 12, '#0277BD');
  c.strokeRect(8, 12, 20, 14, outline);

  // Torba na ramię na laptopa
  c.rect(22, 18, 7, 10, '#5D4037');
  c.line(10, 13, 24, 20, '#3E2723');

  // Głowa
  c.rect(12, 2, 12, 11, '#FFE082');
  c.strokeRect(11, 1, 14, 13, outline);
  c.rect(11, 1, 14, 4, '#3E2723'); // czapka bejsbolówka
  c.setHex(15, 6, outline); // okulary
  c.setHex(19, 6, outline);
  c.rect(14, 5, 8, 3, '#000000', 150);

  save('npc-student.png', c);
}

// --- NPC 2: KIBIC PIASTA GLIWICE (36x44) ---
{
  const c = new PixelCanvas(36, 44);
  const outline = '#1A1A1A';
  c.fillCircle(18, 40, 9, '#000000', 120);

  // Spodnie dresowe
  c.rect(10, 24, 16, 17, '#212121');
  c.strokeRect(9, 23, 18, 19, outline);

  // Koszulka meczowa Piasta (niebiesko-czerwona w pasy!)
  c.rect(9, 13, 18, 12, '#1565C0');
  c.rect(14, 13, 4, 12, '#E53935');
  c.rect(22, 13, 4, 12, '#E53935');
  c.strokeRect(8, 12, 20, 14, outline);

  // Szal w dłoni
  c.rect(4, 18, 6, 14, '#1565C0');
  c.rect(4, 22, 6, 4, '#E53935');

  // Głowa
  c.rect(12, 2, 12, 11, '#FFCC80');
  c.strokeRect(11, 1, 14, 13, outline);
  c.setHex(15, 6, outline);
  c.setHex(19, 6, outline);

  save('npc-fan.png', c);
}

// --- NPC 3: MIESZKANKA / TURYSTKA (36x44) ---
{
  const c = new PixelCanvas(36, 44);
  const outline = '#1A1A1A';
  c.fillCircle(18, 40, 9, '#000000', 120);

  // Czerwona sukienka / spódnica
  c.rect(9, 15, 18, 22, '#D81B60');
  c.strokeRect(8, 14, 20, 24, outline);

  // Głowa i blond włosy
  c.rect(12, 2, 12, 11, '#FFE082');
  c.strokeRect(11, 1, 14, 13, outline);
  c.rect(10, 1, 16, 6, '#FBC02D'); // długie blond włosy
  c.rect(9, 7, 3, 10, '#FBC02D');
  c.rect(24, 7, 3, 10, '#FBC02D');
  c.setHex(15, 6, outline);
  c.setHex(19, 6, outline);

  save('npc-citizen.png', c);
}

// =========================================================================
// 2. SKLEPY, KAWIARNIE I ELEMENTY RYNKU (BOGATA TKANKA MIEJSKA)
// =========================================================================

// --- SKLEP 1: KAWIARNIA I PIEKARNIA NA RYNKU (96x80) ---
{
  const c = new PixelCanvas(96, 80);
  const brick = '#D7CCC8';
  const outline = '#1A1A1A';

  c.rect(4, 74, 88, 6, '#000000', 120);
  c.rect(6, 16, 84, 58, brick);
  c.strokeRect(5, 15, 86, 60, outline);

  // Mansardowy dach
  c.rect(4, 8, 88, 8, '#5D4037');
  c.strokeRect(3, 7, 90, 10, outline);

  // Szyld "KAWIARNIA & PIEKARNIA"
  c.rect(16, 20, 64, 8, '#3E2723');
  c.strokeRect(15, 19, 66, 10, '#FFD700');
  c.rect(18, 22, 60, 4, '#FFD54F');

  // Pasiasta markiza kawiarniana
  for (let mx = 10; mx < 86; mx += 8) {
    c.rect(mx, 32, 4, 8, '#C62828');
    c.rect(mx + 4, 32, 4, 8, '#FFFFFF');
  }
  c.strokeRect(9, 31, 78, 10, outline);

  // Witryna z ciastami i chlebem
  c.rect(14, 44, 42, 26, '#FFE082');
  c.strokeRect(13, 43, 44, 28, outline);
  // Rysunek filiżanki kawy w witrynie
  c.rect(28, 54, 8, 6, '#4E342E');
  c.rect(36, 56, 3, 3, '#4E342E');

  // Drzwi ze szklaną szybą
  c.rect(64, 44, 20, 28, '#3E2723');
  c.strokeRect(63, 43, 22, 30, outline);
  c.rect(68, 48, 12, 12, '#81D4FA');

  save('shop-bakery.png', c);
}

// --- SKLEP 2: PAMIĄTKI Z GLIWIC I KSIĘGARNIA (96x80) ---
{
  const c = new PixelCanvas(96, 80);
  const wall = '#B0BEC5';
  const outline = '#1A1A1A';

  c.rect(4, 74, 88, 6, '#000000', 120);
  c.rect(6, 16, 84, 58, wall);
  c.strokeRect(5, 15, 86, 60, outline);

  // Dach
  c.rect(4, 8, 88, 8, '#37474F');
  c.strokeRect(3, 7, 90, 10, outline);

  // Szyld "PAMIĄTKI Z GLIWIC"
  c.rect(14, 20, 68, 8, '#0D47A1');
  c.strokeRect(13, 19, 70, 10, '#FFD700');

  // Niebieska markiza
  for (let mx = 10; mx < 86; mx += 8) {
    c.rect(mx, 32, 4, 8, '#1565C0');
    c.rect(mx + 4, 32, 4, 8, '#FFF9C4');
  }
  c.strokeRect(9, 31, 78, 10, outline);

  // Wielka przeszklona witryna sklepowa
  c.rect(14, 44, 44, 26, '#81D4FA');
  c.strokeRect(13, 43, 46, 28, outline);
  // Miniaturka wieży radiostacji w witrynie!
  c.rect(32, 48, 6, 16, '#8D6E63');

  // Drzwi
  c.rect(64, 44, 20, 28, '#263238');
  c.strokeRect(63, 43, 22, 30, outline);

  save('shop-souvenir.png', c);
}

// --- PARASOL KAWIARNIANY ZE STOLIKIEM NA RYNEK (48x48) ---
{
  const c = new PixelCanvas(48, 48);
  const outline = '#1A1A1A';

  // Cień parasola
  c.fillCircle(24, 38, 16, '#000000', 100);

  // Stolik i krzesełka
  c.fillCircle(24, 36, 7, '#8D6E63');
  c.strokeCircle(24, 36, 7, outline);
  c.fillCircle(14, 36, 4, '#4E342E');
  c.fillCircle(34, 36, 4, '#4E342E');

  // Maszt parasola
  c.rect(23, 14, 2, 22, '#37474F');

  // Czasza parasola (czerwono-biała)
  c.fillCircle(24, 16, 18, '#C62828');
  for (let a = 0; a < 360; a += 60) {
    const rad = a * Math.PI / 180;
    c.line(24, 16, Math.round(24 + Math.cos(rad) * 18), Math.round(16 + Math.sin(rad) * 18), '#FFFFFF');
  }
  c.strokeCircle(24, 16, 18, outline);

  save('cafe-umbrella.png', c);
}

// --- ŁAWKA PARKOWA (32x20) ---
{
  const c = new PixelCanvas(32, 20);
  const outline = '#1A1A1A';
  c.rect(2, 16, 28, 4, '#000000', 110);
  // Nóżki żeliwne
  c.rect(4, 8, 3, 10, '#263238');
  c.rect(25, 8, 3, 10, '#263238');
  // Drewniane deski ławki
  c.rect(2, 6, 28, 3, '#8D6E63');
  c.rect(2, 11, 28, 3, '#A1887F');
  c.strokeRect(1, 5, 30, 10, outline);
  save('bench.png', c);
}

// --- KWIATY MIEJSKIE W DONICY (24x24) ---
{
  const c = new PixelCanvas(24, 24);
  const outline = '#1A1A1A';
  c.rect(4, 12, 16, 10, '#795548');
  c.strokeRect(3, 11, 18, 12, outline);
  // Kolorowe kwiaty (czerwone, żółte, różowe)
  c.fillCircle(8, 8, 4, '#E91E63');
  c.fillCircle(16, 7, 4, '#FFEB3B');
  c.fillCircle(12, 10, 4, '#FF5722');
  c.setHex(8, 8, '#FFD54F');
  c.setHex(16, 7, '#FF9800');
  save('flower-pot.png', c);
}

console.log('Extra dense, high-quality shops, cafes, umbrellas, and NPCs generated!');
