# 예고 후 등장 (Warned Spawns) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate every ghost appearance behind a dread warning (예고) — no more instant unwarned pops — while allowing the warning to occasionally resolve into nothing (a fakeout).

**Architecture:** Generalize the ambush-only two-phase pattern in `SpawnManager` into one shared warning slot used by both the gaze and ambush triggers. A trigger fires a `warning` event and schedules a `PendingReveal`; after `warningLeadMs` the reveal resolves with a probability roll into either a `spawned`+`revealed` pop or a fakeout. The engine/HUD already render the `warning` cue, so no engine logic changes — only `SpawnManager`, a type comment, onboarding copy, and tests.

**Tech Stack:** TypeScript, Vitest (pure game-logic unit tests, no DOM), seeded `mulberry32` RNG.

Spec: `docs/superpowers/specs/2026-06-18-warned-spawns-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/game/SpawnManager.ts` | WHEN/WHERE ghosts appear (pure logic) | Core — config + `PendingReveal` + `resolvePending` + two-phase gaze/ambush |
| `src/game/types.ts` | Shared game types | One JSDoc comment on the `warning` event |
| `tests/spawn.test.ts` | SpawnManager unit tests | Update existing tests to two-phase; add fakeout + slot tests |
| `src/i18n/ko.json`, `src/i18n/en.json` | UI strings | `gate.desc` onboarding copy (no longer "without warning") |
| `src/app/HuntController.ts` | Engine ↔ logic bridge | One JSDoc comment (no logic change) |
| `src/app/GameApp.ts` | Orchestrator | One JSDoc comment (no logic change) |

---

## Task 1: Two-phase warned-spawn pipeline in SpawnManager

**Files:**
- Modify: `src/game/SpawnManager.ts`
- Modify: `src/game/types.ts`
- Test: `tests/spawn.test.ts`

- [ ] **Step 1: Replace the test file with the two-phase + fakeout specs**

Replace the entire contents of `tests/spawn.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SpawnManager } from '../src/game/SpawnManager';
import type { SpawnConfig } from '../src/game/SpawnManager';
import { RaritySystem } from '../src/game/RaritySystem';
import { mulberry32 } from '../src/game/rng';
import type { SpawnEvent, Vec3 } from '../src/game/types';
import { ONE_PER_TIER } from './fixtures';

const DEG = Math.PI / 180;
const FRONT: Vec3 = { x: 0, y: 0, z: -1 };

function revealed(events: SpawnEvent[]) {
  return events.filter((e): e is Extract<SpawnEvent, { type: 'revealed' }> => e.type === 'revealed');
}
function warnings(events: SpawnEvent[]) {
  return events.filter((e): e is Extract<SpawnEvent, { type: 'warning' }> => e.type === 'warning');
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

describe('SpawnManager', () => {
  let time = 0;
  const clock = () => time;

  function makeManager(config: Partial<SpawnConfig> = {}) {
    return new SpawnManager({
      catalog: ONE_PER_TIER,
      rarity: new RaritySystem(ONE_PER_TIER, mulberry32(5)),
      rng: mulberry32(123),
      clock,
      config,
    });
  }

  // Advance the fake clock and tick.
  function step(mgr: SpawnManager, forward: Vec3, dtMs: number): SpawnEvent[] {
    time += dtMs;
    return mgr.update(forward, dtMs / 1000);
  }

  // Gaze fires fast; warningLeadMs:0 means the pop resolves the tick after the warning.
  const GAZE: Partial<SpawnConfig> = {
    gazeDwellMs: [100, 100],
    gazeChance: 1,
    gazeCooldownMs: 1000,
    gazeCooldownJitter: 0,
    gazeOffset: [10 * DEG, 10 * DEG],
    steadyMaxSpeed: 100,
    warningLeadMs: 0,
    ambushIntervalMs: 1e9, // disable ambush in gaze tests
  };

  beforeEach(() => {
    time = 0;
  });

  it('warns first, then pops a ghost near where the player looked, after the lead', () => {
    const mgr = makeManager({ ...GAZE, warningLeadMs: 500 });
    expect(revealed(step(mgr, FRONT, 60))).toHaveLength(0); // dwell 60 < 100
    const warn = step(mgr, FRONT, 60); // dwell 120 ≥ 100 → warning only
    expect(warnings(warn).some((e) => e.ambush === false)).toBe(true);
    expect(revealed(warn)).toHaveLength(0);

    const ev = revealed(step(mgr, FRONT, 500)); // lead elapsed → pop
    expect(ev).toHaveLength(1);
    expect(ev[0].ambush).toBe(false);
    // Popped within ~the configured offset of the look direction.
    expect(dot(FRONT, ev[0].ghost.position.dir)).toBeGreaterThan(Math.cos(11 * DEG));
  });

  it('a gaze warning that fails its roll produces no ghost (fakeout)', () => {
    const mgr = makeManager({ ...GAZE, gazeChance: 0 });
    step(mgr, FRONT, 60);
    const warn = step(mgr, FRONT, 60); // dwell ≥ 100 → warning
    expect(warnings(warn)).toHaveLength(1);
    for (let i = 0; i < 10; i++) {
      expect(revealed(step(mgr, FRONT, 60))).toHaveLength(0); // never reveals
    }
    expect(mgr.ghosts.length).toBe(0);
  });

  it('does not start a second warning while one is pending', () => {
    const mgr = makeManager({ ...GAZE, warningLeadMs: 1000 });
    step(mgr, FRONT, 60);
    const first = step(mgr, FRONT, 60); // warning #1, pending ~1000ms
    expect(warnings(first)).toHaveLength(1);
    let count = 0;
    for (let i = 0; i < 10; i++) count += warnings(step(mgr, FRONT, 60)).length; // 600ms < lead
    expect(count).toBe(0);
  });

  it('never exceeds maxActive', () => {
    const mgr = makeManager({ ...GAZE, maxActive: 2, gazeCooldownMs: 0 });
    for (let i = 0; i < 40; i++) step(mgr, FRONT, 60); // < min activeWindow, so none expire
    expect(mgr.ghosts.length).toBeLessThanOrEqual(2);
  });

  it('respects the gaze cooldown between pops', () => {
    const mgr = makeManager(GAZE);
    step(mgr, FRONT, 60);
    step(mgr, FRONT, 60); // warning
    step(mgr, FRONT, 60); // resolve → first pop; cooldown 1000ms
    expect(mgr.ghosts.length).toBe(1);
    for (let i = 0; i < 8; i++) step(mgr, FRONT, 60); // ~480ms < cooldown
    expect(mgr.ghosts.length).toBe(1);
  });

  it('warns first, then fires a behind-the-player ambush after the lead time', () => {
    const mgr = makeManager({
      gazeDwellMs: [1e9, 1e9], // disable gaze pops
      ambushIntervalMs: 500,
      ambushJitter: 0,
      ambushChance: 1,
      warningLeadMs: 800,
    });
    step(mgr, FRONT, 100); // schedules ambush at now+500 = 600
    const warn = step(mgr, FRONT, 600); // now 700 ≥ 600 → warning only
    expect(warnings(warn).some((e) => e.ambush === true)).toBe(true);
    expect(revealed(warn)).toHaveLength(0);

    const ev = revealed(step(mgr, FRONT, 800)); // now 1500 ≥ 700+800 → pop behind
    expect(ev.some((e) => e.ambush)).toBe(true);
    expect(dot(FRONT, ev.find((e) => e.ambush)!.ghost.position.dir)).toBeLessThan(0);
  });

  it('an ambush warning that fails its roll produces no ghost (fakeout)', () => {
    const mgr = makeManager({
      gazeDwellMs: [1e9, 1e9],
      ambushIntervalMs: 500,
      ambushJitter: 0,
      ambushChance: 0,
      warningLeadMs: 800,
    });
    step(mgr, FRONT, 100); // schedule ambush at 600
    const warn = step(mgr, FRONT, 600); // 700 ≥ 600 → warning
    expect(warnings(warn).some((e) => e.ambush === true)).toBe(true);
    const ev = revealed(step(mgr, FRONT, 800)); // 1500 ≥ 1500 → resolve, chance 0 → fakeout
    expect(ev).toHaveLength(0);
    expect(mgr.ghosts.length).toBe(0);
  });

  it('expires an active ghost after its catch window', () => {
    const mgr = makeManager(GAZE);
    step(mgr, FRONT, 60);
    step(mgr, FRONT, 60); // warning
    step(mgr, FRONT, 60); // resolve → pop
    const ghost = mgr.ghosts[0];
    expect(ghost.expiresAt).not.toBeNull();

    const events = step(mgr, FRONT, ghost.expiresAt! - time + 1);
    expect(events.some((e) => e.type === 'expired' && e.ghost.instanceId === ghost.instanceId)).toBe(true);
    expect(mgr.ghosts.find((g) => g.instanceId === ghost.instanceId)).toBeUndefined();
  });

  it('removes a ghost by id and returns null for unknown ids', () => {
    const mgr = makeManager(GAZE);
    step(mgr, FRONT, 60);
    step(mgr, FRONT, 60); // warning
    step(mgr, FRONT, 60); // resolve → pop
    const ghost = mgr.ghosts[0];
    expect(mgr.remove(ghost.instanceId)?.instanceId).toBe(ghost.instanceId);
    expect(mgr.ghosts.find((g) => g.instanceId === ghost.instanceId)).toBeUndefined();
    expect(mgr.remove('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/spawn.test.ts`
Expected: FAIL. Compile/type errors on `warningLeadMs` / `ambushChance` (not yet in `SpawnConfig`), and the gaze tests fail because the current code pops in one tick with no `warning`.

- [ ] **Step 3: Generalize `SpawnConfig` and `DEFAULT_SPAWN_CONFIG`**

In `src/game/SpawnManager.ts`, replace the whole `export interface SpawnConfig { ... }` block with:

```ts
export interface SpawnConfig {
  /** Max concurrent ghosts on screen. Kept low so each "확!" lands. */
  maxActive: number;
  /** Randomized dwell [min, max] (ms) the player must look steadily before a gaze warning. */
  gazeDwellMs: [number, number];
  /** Minimum gap between gaze pops, milliseconds. */
  gazeCooldownMs: number;
  /** Fractional jitter (0..1) on the gaze cooldown. */
  gazeCooldownJitter: number;
  /** Probability a gaze warning (예고) resolves into a ghost — else a fakeout. */
  gazeChance: number;
  /** Angular offset [min, max] from screen center where a gaze ghost pops. Radians. */
  gazeOffset: [number, number];
  /** Above this view rotation speed (rad/s) the player is "searching" — dwell resets. */
  steadyMaxSpeed: number;
  /** Average gap between behind-you ambushes, milliseconds. */
  ambushIntervalMs: number;
  /** Fractional jitter (0..1) on the ambush interval. */
  ambushJitter: number;
  /** Probability an ambush warning (예고) resolves into a ghost — else a fakeout. */
  ambushChance: number;
  /** Lead time from a warning (예고) to the ghost popping. Shared by every trigger. */
  warningLeadMs: number;
  /** Azimuth spread of behind-the-player ambushes, radians. */
  ambushSpread: number;
  /** Elevation band [min, max] for ambush spawns, radians. */
  ambushElevation: [number, number];
}
```

Then replace the whole `export const DEFAULT_SPAWN_CONFIG: SpawnConfig = { ... };` block with:

```ts
export const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  // Rare + anticipated = scary. Few on screen, each one an event.
  maxActive: 2,
  // You must stare into a spot for 1.2–2.8s before a warning fires there.
  gazeDwellMs: [1200, 2800],
  // Long, jittered gap after a pop so it never feels metronomic.
  gazeCooldownMs: 5000,
  gazeCooldownJitter: 0.5,
  // ~30% of gaze warnings are fakeouts — keeps you uneasy.
  gazeChance: 0.7,
  gazeOffset: [6 * DEG2RAD, 22 * DEG2RAD],
  steadyMaxSpeed: 1.4,
  // Behind-you ambush every ~8–24s.
  ambushIntervalMs: 16000,
  ambushJitter: 0.5,
  // Ambushes are rare events, so they pay off more often (~10% fakeout).
  ambushChance: 0.9,
  // A dread cue precedes every spawn by ~1s.
  warningLeadMs: 1000,
  ambushSpread: 50 * DEG2RAD,
  ambushElevation: [-12 * DEG2RAD, 16 * DEG2RAD],
};
```

- [ ] **Step 4: Add the `PendingReveal` type and swap the state field**

In `src/game/SpawnManager.ts`, immediately above the `export class SpawnManager {` line, insert:

```ts
type RevealKind = 'gaze' | 'ambush';

/** A warned spawn waiting to resolve. Gaze locks its direction at warning time;
 *  ambush leaves it null and resolves behind the player at reveal time. */
interface PendingReveal {
  atMs: number;
  kind: RevealKind;
  position: SpawnPosition | null;
}
```

(`SpawnPosition` is already imported from `./types`.)

Then, in the class field declarations, replace this line:

```ts
  private pendingAmbushAt: number | null = null;
```

with:

```ts
  private pending: PendingReveal | null = null;
```

- [ ] **Step 5: Update the class JSDoc to describe the warned model**

In `src/game/SpawnManager.ts`, replace the class doc comment block directly above `export class SpawnManager` with:

```ts
/**
 * Decides WHEN and WHERE a ghost bursts into view ("확!"). Every spawn is gated
 * behind a dread warning (예고): a trigger fires a `warning`, then after
 * `warningLeadMs` the spawn resolves — sometimes into a ghost, sometimes into
 * nothing (a fakeout). Two triggers feed the one warning slot:
 *   - gaze: the player's view settles → a warning fires, then a ghost pops right
 *     where they were looking (slightly off-center). The "비추면 거기서 팍" feel.
 *   - ambush: a timer fires → a warning, then a ghost pops behind/beside the player.
 *
 * Pure logic: no Three.js, no DOM. `update()` returns the events that occurred,
 * which the engine turns into the warning cue, then a hard sprite pop + screen effects.
 */
```

- [ ] **Step 6: Wire `resolvePending` into `update()` and drop the unused ambush param**

In `src/game/SpawnManager.ts`, replace the whole `update(...) { ... }` method with:

```ts
  update(cameraForward: Vec3, dtSeconds: number): SpawnEvent[] {
    const now = this.clock();
    if (this.nextAmbushAt === null) this.scheduleNextAmbush(now);

    const events: SpawnEvent[] = [];
    this.expireStale(now, events);
    this.trackDwell(cameraForward, dtSeconds);
    this.resolvePending(cameraForward, now, events);
    this.maybeGazePop(cameraForward, now, events);
    this.maybeAmbush(now, events);
    return events;
  }
```

- [ ] **Step 7: Add `resolvePending`**

In `src/game/SpawnManager.ts`, directly below the `trackDwell(...) { ... }` method, insert:

```ts
  private resolvePending(forward: Vec3, now: number, events: SpawnEvent[]): void {
    const pending = this.pending;
    if (pending === null || now < pending.atMs) return;
    this.pending = null;

    // Single warning slot → nothing spawns during the lead, so the maxActive
    // check that passed at warning time still holds; no need to re-check here.
    const chance = pending.kind === 'gaze' ? this.config.gazeChance : this.config.ambushChance;
    if (this.rng() <= chance) {
      const position = pending.position ?? this.behindPosition(forward);
      this.spawnActive(position, now, pending.kind === 'ambush', events);
    }
    // Failed roll = fakeout: emit nothing; the HUD warning clears itself.

    if (pending.kind === 'gaze') {
      const { gazeCooldownMs, gazeCooldownJitter } = this.config;
      this.gazeCooldownUntil =
        now + gazeCooldownMs * (1 + randRange(this.rng, -gazeCooldownJitter, gazeCooldownJitter));
    } else {
      this.scheduleNextAmbush(now);
    }
  }
```

- [ ] **Step 8: Rewrite `maybeGazePop` to warn instead of pop**

In `src/game/SpawnManager.ts`, replace the whole `maybeGazePop(...) { ... }` method with:

```ts
  private maybeGazePop(forward: Vec3, now: number, events: SpawnEvent[]): void {
    if (this.pending !== null) return;
    if (now < this.gazeCooldownUntil) return;
    if (this.dwellMs < this.dwellTarget) return;
    if (this.instances.length >= this.config.maxActive) return;

    // Reset dwell so we don't re-arm every frame while staring.
    this.dwellMs = 0;
    this.dwellTarget = this.rollDwellTarget();

    // Lock the spot now; the ghost pops here after the warning lead even if the
    // player flinches away. The chance roll happens at resolution (fakeout).
    const [minOff, maxOff] = this.config.gazeOffset;
    const dir = offsetDirection(forward, randRange(this.rng, minOff, maxOff), this.rng() * Math.PI * 2);
    this.pending = { atMs: now + this.config.warningLeadMs, kind: 'gaze', position: positionFromDir(dir) };
    events.push({ type: 'warning', ambush: false });
  }
```

- [ ] **Step 9: Rewrite `maybeAmbush` to warn first, resolve later**

In `src/game/SpawnManager.ts`, replace the whole `maybeAmbush(...) { ... }` method with:

```ts
  private maybeAmbush(now: number, events: SpawnEvent[]): void {
    if (this.pending !== null) return;
    if (this.nextAmbushAt === null || now < this.nextAmbushAt) return;
    if (this.instances.length >= this.config.maxActive) {
      this.scheduleNextAmbush(now);
      return;
    }
    // Behind-you direction is computed at resolution (against the player's view then).
    this.pending = { atMs: now + this.config.warningLeadMs, kind: 'ambush', position: null };
    events.push({ type: 'warning', ambush: true });
  }
```

- [ ] **Step 10: Generalize the `warning` event comment in types.ts**

In `src/game/types.ts`, replace:

```ts
  /** A dread warning precedes an ambush; the ghost pops after ambushWarningMs. */
  | { type: 'warning'; ambush: boolean };
```

with:

```ts
  /** A dread warning (예고) precedes every spawn; the ghost pops after warningLeadMs. */
  | { type: 'warning'; ambush: boolean };
```

- [ ] **Step 11: Run the spawn tests to confirm they pass**

Run: `npx vitest run tests/spawn.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 12: Lint the changed logic**

Run: `npm run lint`
Expected: no errors (in particular, no "unused variable" — `maybeAmbush` no longer takes `forward`, and `pendingAmbushAt` is gone).

- [ ] **Step 13: Commit**

```bash
git add src/game/SpawnManager.ts src/game/types.ts tests/spawn.test.ts
git commit -m "feat: gate every spawn behind a dread warning, with fakeouts

Generalize the ambush two-phase warning into one shared slot used by gaze
and ambush. A trigger fires a warning, then after warningLeadMs resolves
into a pop or a fakeout (gazeChance / ambushChance). Removes the instant
unwarned gaze pop.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Align onboarding copy and comments

The onboarding copy promises ghosts "appear without warning" — now false. Three JSDoc comments still say the warning is ambush-only. None of this is logic; verify with lint + the full suite.

**Files:**
- Modify: `src/i18n/ko.json`
- Modify: `src/i18n/en.json`
- Modify: `src/app/HuntController.ts`
- Modify: `src/app/GameApp.ts`

- [ ] **Step 1: Update the Korean onboarding copy**

In `src/i18n/ko.json`, replace the `gate.desc` line:

```json
  "gate.desc": "카메라로 주위를 비추면 세계의 귀신들이 갑자기 나타납니다. 가운데 조준점에 맞춰 잡아 크레딧을 모으세요.",
```

with:

```json
  "gate.desc": "카메라로 주위를 비추면 서늘한 기운이 먼저 스치고, 곧 세계의 귀신이 나타납니다. 가운데 조준점에 맞춰 잡아 크레딧을 모으세요.",
```

- [ ] **Step 2: Update the English onboarding copy**

In `src/i18n/en.json`, replace the `gate.desc` line:

```json
  "gate.desc": "Point your camera around and ghosts from across the world appear without warning. Center one in the reticle to catch it and earn credits.",
```

with:

```json
  "gate.desc": "Point your camera around — a chill warns you, then a ghost from across the world appears. Center one in the reticle to catch it and earn credits.",
```

- [ ] **Step 3: Generalize the `onWarning` comment in HuntController**

In `src/app/HuntController.ts`, replace:

```ts
  /** Fired when a dread warning precedes an ambush. */
  onWarning: () => void;
```

with:

```ts
  /** Fired when a dread warning (예고) precedes a spawn. */
  onWarning: () => void;
```

- [ ] **Step 4: Generalize the WARNING_KEYS comment in GameApp**

In `src/app/GameApp.ts`, replace:

```ts
/** Dread message keys shown just before an ambush (weighted toward the title). */
```

with:

```ts
/** Dread message keys shown just before a spawn (weighted toward the title). */
```

- [ ] **Step 5: Lint + full test suite**

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: PASS — `validate:catalog` passes, then all unit tests (including the 9 spawn tests) green.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/ko.json src/i18n/en.json src/app/HuntController.ts src/app/GameApp.ts
git commit -m "docs(copy): onboarding + comments reflect warned spawns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual verification (on device)

Pure-logic tests can't feel the pacing. After both tasks, run the dev tunnel and confirm on a phone:

- Stare at a spot → a dread line + low rumble appears first, then ~1s later a ghost pops there (no more instant pops).
- Occasionally a warning fires and nothing appears (fakeout) — expected ~30% of gaze warnings.
- Behind-you ambushes still warn then pop, and usually (but not always) produce a ghost.

Run: `npm run dev:tunnel` + `cloudflared tunnel --url http://localhost:5173`

---

## Self-Review

**1. Spec coverage**
- 모든 등장 예고화 → Task 1 Steps 6–9 (gaze + ambush both set `pending` + emit `warning`). ✓
- 예고 없는 즉시 등장 제거 → Task 1 Step 8 (gaze no longer calls `spawnActive` directly). ✓
- 헛예고 → Task 1 Step 7 (`rng() <= chance` else nothing) + tests "fakeout" (gaze & ambush). ✓
- 통합 2단계 파이프라인 / 단일 슬롯 → Step 4 (`pending`) + Steps 7–9 (`pending !== null` guards) + test "second warning while pending". ✓
- 위치 처리 (gaze lock / ambush behind-at-reveal) → Step 8 (`positionFromDir` at warning) + Step 7 (`pending.position ?? behindPosition`). ✓
- 파라미터 (`warningLeadMs` 1000, `gazeChance` 0.7, `ambushChance` 0.9, drop `ambushWarningMs`) → Step 3. ✓
- 카피 `gate.desc` ko/en → Task 2 Steps 1–2. ✓
- 주석 일반화 (types/HuntController/GameApp) → Task 1 Step 10 + Task 2 Steps 3–4. ✓
- 테스트 (갱신 5 + 신규 3) → Task 1 Step 1. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output. ✓

**3. Type consistency:** `PendingReveal { atMs, kind, position }` defined in Step 4 is used identically in Steps 7–9. `warningLeadMs` / `ambushChance` defined in Step 3 used in Steps 7–9 and tests. `maybeAmbush(now, events)` signature matches its call in Step 6. `pending.position ?? this.behindPosition(forward)` — `behindPosition` already exists and is unchanged. ✓
```
