// Generates the PWA / apple-touch icons into public/icons as PNGs.
// Pure-JS (no native image deps): draws a dark ghost with glowing green eyes and
// encodes PNG via Node's zlib. Re-run after changing the icon design.
//
//   node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function ghostBody(x, y, size, cx) {
  const rx = size * 0.27;
  const top = size * 0.2;
  const bottom = size * 0.82;
  if (Math.abs(x - cx) > rx) return false;
  if (y < top) return Math.hypot(x - cx, y - top) < rx;
  if (y <= bottom - size * 0.05) return true;
  if (y <= bottom) {
    const wave = Math.abs(Math.sin(((x - cx) / rx) * Math.PI * 3)) * size * 0.05;
    return y < bottom - wave;
  }
  return false;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = 10;
      let g = 10;
      let b = 15;
      // Green aura behind the ghost.
      const dist = Math.hypot(x - cx, y - size * 0.45) / size;
      const aura = Math.max(0, 0.5 - dist) * 0.5;
      r += 107 * aura;
      g += 255 * aura;
      b += 158 * aura;

      if (ghostBody(x, y, size, cx)) {
        r = 30;
        g = 28;
        b = 40;
        const eL = Math.hypot(x - (cx - size * 0.1), y - size * 0.42) < size * 0.055;
        const eR = Math.hypot(x - (cx + size * 0.1), y - size * 0.42) < size * 0.055;
        if (eL || eR) {
          r = 107;
          g = 255;
          b = 158;
          const cL = Math.hypot(x - (cx - size * 0.1), y - size * 0.42) < size * 0.022;
          const cR = Math.hypot(x - (cx + size * 0.1), y - size * 0.42) < size * 0.022;
          if (cL || cR) {
            r = 255;
            g = 255;
            b = 255;
          }
        }
      }
      rgba[i] = clamp(r);
      rgba[i + 1] = clamp(g);
      rgba[i + 2] = clamp(b);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

mkdirSync(OUT, { recursive: true });
const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512], // full-bleed dark bg → maskable-safe
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of targets) {
  writeFileSync(join(OUT, name), encodePng(size, drawIcon(size)));
  console.log(`wrote icons/${name} (${size}x${size})`);
}
