// Validates src/data/ghosts.catalog.json against the schema rules.
// Read-only; runs on Windows with no device. Wired into `pretest`.
//
//   npm run validate:catalog
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RARITIES, ORIGIN_COUNTRIES } from '../src/data/catalog.types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'src', 'data', 'ghosts.catalog.json');

const errors: string[] = [];
const warnings: string[] = [];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const inRange = (v: unknown, min: number, max: number): boolean => isNum(v) && v >= min && v <= max;
const isLocalized = (v: unknown): boolean => isObj(v) && isStr(v.ko) && isStr(v.en);
const oneOf = (v: unknown, allowed: readonly string[]): boolean =>
  typeof v === 'string' && allowed.includes(v);

const data: unknown = JSON.parse(readFileSync(catalogPath, 'utf8'));
let count = 0;

if (!isObj(data) || !Array.isArray(data.ghosts)) {
  errors.push('catalog.ghosts must be an array');
} else {
  count = data.ghosts.length;
  if (count === 0) errors.push('catalog has no ghosts');
  const ids = new Set<string>();

  data.ghosts.forEach((g: unknown, idx: number) => {
    const at = isObj(g) && isStr(g.id) ? g.id : `ghost[${idx}]`;
    if (!isObj(g)) {
      errors.push(`${at} is not an object`);
      return;
    }
    if (!isStr(g.id)) errors.push(`${at}.id is required`);
    else if (ids.has(g.id)) errors.push(`duplicate id "${g.id}"`);
    else ids.add(g.id);

    if (!isLocalized(g.name)) errors.push(`${at}.name needs non-empty ko + en`);
    if (!isLocalized(g.lore)) errors.push(`${at}.lore needs non-empty ko + en`);
    if (!oneOf(g.origin, ORIGIN_COUNTRIES)) errors.push(`${at}.origin invalid: ${String(g.origin)}`);
    if (!oneOf(g.rarity, RARITIES)) errors.push(`${at}.rarity invalid: ${String(g.rarity)}`);
    if (!(isNum(g.spawnWeight) && g.spawnWeight > 0)) errors.push(`${at}.spawnWeight must be > 0`);
    if (!inRange(g.catchDifficulty, 1, 10)) errors.push(`${at}.catchDifficulty must be 1..10`);
    if (!inRange(g.catchProbability, 0, 1)) errors.push(`${at}.catchProbability must be 0..1`);
    if (!inRange(g.skittishness, 0, 1)) errors.push(`${at}.skittishness must be 0..1`);
    if (!inRange(g.ambushBias, 0, 1)) errors.push(`${at}.ambushBias must be 0..1`);
    if (!inRange(g.revealIntensity, 0, 1)) errors.push(`${at}.revealIntensity must be 0..1`);
    if (!(isNum(g.creditReward) && g.creditReward > 0)) errors.push(`${at}.creditReward must be > 0`);
    if (!(isNum(g.activeWindowMs) && g.activeWindowMs > 0)) errors.push(`${at}.activeWindowMs must be > 0`);

    if (!isObj(g.sprite) || !isStr(g.sprite.atlas)) {
      errors.push(`${at}.sprite.atlas is required`);
    } else {
      const sp = g.sprite;
      if (!(isNum(sp.frameWidth) && sp.frameWidth > 0)) errors.push(`${at}.sprite.frameWidth must be > 0`);
      if (!(isNum(sp.frameHeight) && sp.frameHeight > 0)) errors.push(`${at}.sprite.frameHeight must be > 0`);
      if (!(isNum(sp.frameCount) && sp.frameCount > 0)) errors.push(`${at}.sprite.frameCount must be > 0`);
      if (!(isNum(sp.fps) && sp.fps > 0)) errors.push(`${at}.sprite.fps must be > 0`);
      if (isStr(sp.atlas) && !existsSync(join(root, 'public', sp.atlas))) {
        warnings.push(`${at}: sprite art "${sp.atlas}" not found — using procedural fallback`);
      }
    }
  });
}

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n카탈로그 검증 실패: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`✓ 카탈로그 검증 통과 — ghosts: ${count}, warnings: ${warnings.length}`);
