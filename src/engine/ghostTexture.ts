import * as THREE from 'three';
import type { GhostDef, Rarity } from '../data/catalog.types';

/**
 * Per-ghost texture. Prefers a real AI-generated sprite at the catalog's
 * `sprite.atlas` path (served from /public); falls back to a procedural dark
 * wraith tinted by rarity. The fallback shows instantly and the real image,
 * once decoded, swaps into the same texture object — so every sprite already
 * referencing it upgrades live, and dropping PNGs into public/sprites/ "just
 * works" with no code change.
 */

const RARITY_GLOW: Record<Rarity, string> = {
  common: '#9fb0d8',
  uncommon: '#7bf0a8',
  rare: '#6fa8ff',
  epic: '#b977ff',
  legendary: '#ffcf5a',
};

const cache = new Map<string, THREE.Texture>();

export function getGhostTexture(def: GhostDef): THREE.Texture {
  const cached = cache.get(def.id);
  if (cached) return cached;

  const texture = new THREE.Texture(drawWraith(RARITY_GLOW[def.rarity]));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cache.set(def.id, texture);

  if (def.sprite.atlas) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      texture.image = img;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    };
    // On 404/decode failure we simply keep the procedural fallback.
    img.onerror = () => {};
    img.src = `/${def.sprite.atlas}`;
  }

  return texture;
}

function drawWraith(glow: string): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const cx = size / 2;

  // Sickly aura — dim, not friendly.
  const aura = ctx.createRadialGradient(cx, 120, 10, cx, 130, 140);
  aura.addColorStop(0, hexToRgba(glow, 0.28));
  aura.addColorStop(0.6, hexToRgba(glow, 0.06));
  aura.addColorStop(1, hexToRgba(glow, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);

  // Shrouded body: hooded peak, flaring robe, tattered spiked hem.
  ctx.beginPath();
  ctx.moveTo(cx, 26);
  ctx.bezierCurveTo(118, 30, 84, 70, 78, 120);
  ctx.bezierCurveTo(70, 168, 66, 198, 64, 226);
  // Jagged torn hem (sharp spikes, not cute scallops).
  const hemY = 226;
  const points = [82, 100, 120, 140, 160, 178];
  let up = true;
  for (const x of points) {
    ctx.lineTo(x, up ? hemY - 30 : hemY);
    up = !up;
  }
  ctx.lineTo(192, 198);
  ctx.bezierCurveTo(190, 168, 186, 168, 178, 120);
  ctx.bezierCurveTo(172, 70, 138, 30, cx, 26);
  ctx.closePath();

  const body = ctx.createLinearGradient(0, 20, 0, 230);
  body.addColorStop(0, 'rgba(26, 24, 34, 0.97)');
  body.addColorStop(0.55, 'rgba(16, 15, 22, 0.92)');
  body.addColorStop(1, 'rgba(8, 7, 12, 0.55)');
  ctx.fillStyle = body;
  ctx.shadowColor = hexToRgba(glow, 0.5);
  ctx.shadowBlur = 22;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Recessed face shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.ellipse(cx, 104, 40, 52, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hollow glowing eyes — angled inward, slightly uneven (unsettling).
  glowEye(ctx, cx - 20, 98, glow, 1);
  glowEye(ctx, cx + 21, 100, glow, 0.92);

  // Gaping, downturned mouth with faint inner glow.
  ctx.save();
  ctx.shadowColor = hexToRgba(glow, 0.55);
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
  ctx.beginPath();
  ctx.moveTo(cx - 16, 138);
  ctx.quadraticCurveTo(cx, 134, cx + 16, 138);
  ctx.quadraticCurveTo(cx + 8, 170, cx, 176);
  ctx.quadraticCurveTo(cx - 8, 170, cx - 16, 138);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  return canvas;
}

function glowEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glow: string,
  scale: number,
): void {
  // Dark socket.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.beginPath();
  ctx.ellipse(x, y, 15 * scale, 19 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glowing core.
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 26;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * scale, 6 * scale, 8.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * scale, 2.6 * scale, 3.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
