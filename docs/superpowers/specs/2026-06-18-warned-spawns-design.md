# 예고 후 등장 (Warned Spawns) — 설계 문서

- 날짜: 2026-06-18
- 상태: 승인됨 (구현 대기)
- 범위: `src/game/SpawnManager.ts` 중심의 동작 변경

## 배경 / 문제

현재 `SpawnManager`에는 두 가지 등장 트리거가 있다.

- **시선 팝(gaze pop):** 플레이어가 한 곳을 1.2~2.8초 응시하면, `gazeChance`(0.7) 굴림에 성공할 경우
  **예고 없이** 그 자리에 귀신이 즉시 등장한다. → "그냥 막 나오는" 동작.
- **백어택(ambush):** 약 8~24초마다 타이머가 발동, `ambushWarningMs`(950ms) 동안 공포 예고
  (중앙 문구 + 저음 럼블)가 먼저 뜨고 그 뒤 등 뒤에서 귀신이 팍.

즉 예고 메커니즘은 이미 존재하지만 **백어택에만** 적용된다. 시선 팝은 예고 없이 즉시 튀어나온다.

## 목표

1. **모든** 귀신 등장 앞에 예고(중앙 문구 + 저음 럼블)를 둔다.
2. 예고 없는 즉시 등장을 제거한다.
3. 예고가 떠도 가끔 아무것도 안 나오는 **헛예고(fakeout)** 를 허용해 긴장감을 유지한다.

## 비목표 (out of scope)

- 등장 지점에 나타나는 시각 텔레그래프(연기/그림자/실루엣). 예고 형태는 **A안(기존 공포 큐 재사용)** 으로
  결정. 시각 텔레그래프는 차후 과제.
- 신규 사운드/아트 자산.
- 시선·백어택 외 새로운 등장 트리거.
- 캐치(포획) 로직, 경제, 희귀도 변경.

## 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 예고 형태 | A — 기존 공포 큐(중앙 문구 + 저음 럼블) 재사용 |
| 헛예고 | 허용 — 예고가 떠도 확률적으로 미등장 |
| 구현 구조 | 통합 2단계 파이프라인 (`SpawnManager` 내부) |
| 예고→등장 리드타임 | `warningLeadMs = 1000ms` |
| 시선 헛예고율 | 30% (`gazeChance = 0.7`, 기존 값 유지) |
| 백어택 헛예고율 | 10% (`ambushChance = 0.9`, 신설) |

## 모델

모든 등장은 다음 순서를 따른다.

```
트리거 충족 → [예고] warning 이벤트 + 공포 큐 → (warningLeadMs) → [해소] 확률 굴림
                                                                  ├─ 성공: spawned + revealed (확!)
                                                                  └─ 실패/가득참: 헛예고 (아무 일 없음)
```

예고는 **공용 슬롯 하나**만 존재한다. 예고가 떠 있는 동안에는 다른 트리거가 새 예고를 띄우지 않는다
(동시에 두 개의 공포 큐가 겹치지 않게).

## 상세 설계

### SpawnManager 상태 변경

- 제거: `pendingAmbushAt: number | null`
- 추가: `pending: PendingReveal | null`

```ts
type RevealKind = 'gaze' | 'ambush';

interface PendingReveal {
  /** 해소 예정 시각(ms). */
  atMs: number;
  kind: RevealKind;
  /** 시선 팝은 예고 시점의 응시 방향을 고정해 저장. 백어택은 null(해소 시 등 뒤로 계산). */
  position: SpawnPosition | null;
}
```

기존 `gazeCooldownUntil`, `nextAmbushAt`, dwell 추적 필드는 유지한다.

### update() 틱 순서

```
1. now = clock()
2. nextAmbushAt 미설정이면 scheduleNextAmbush(now)
3. expireStale(now)
4. trackDwell(forward, dt)
5. resolvePending(forward, now)     // ← 신규: 예고 해소를 먼저 처리
6. maybeGazePop(forward, now)        // pending !== null 이면 즉시 return
7. maybeAmbush(forward, now)         // pending !== null 이면 즉시 return
```

### 1단계: 예고 발생

**maybeGazePop** (변경)

```
if (pending !== null) return
if (now < gazeCooldownUntil) return
if (dwellMs < dwellTarget) return
if (instances.length >= maxActive) return     // 가득이면 예고도 안 띄움(확정 헛예고 방지)

dwellMs = 0
dwellTarget = rollDwellTarget()
// 확률 굴림은 여기서 하지 않는다 — 해소 단계로 이동.
const dir = offsetDirection(forward, randRange(minOff, maxOff), rng()*2π)
pending = { atMs: now + warningLeadMs, kind: 'gaze', position: positionFromDir(dir) }
events.push({ type: 'warning', ambush: false })
// 쿨다운은 해소 시점에 설정.
```

**maybeAmbush** (변경)

```
if (pending !== null) return
if (nextAmbushAt === null || now < nextAmbushAt) return
if (instances.length >= maxActive) { scheduleNextAmbush(now); return }   // 가득이면 미루기

pending = { atMs: now + warningLeadMs, kind: 'ambush', position: null }
events.push({ type: 'warning', ambush: true })
// 다음 백어택 스케줄은 해소 시점에.
```

### 2단계: 해소 (resolvePending, 신규)

```
if (pending === null) return
if (now < pending.atMs) return

const p = pending
pending = null

const chance = p.kind === 'gaze' ? gazeChance : ambushChance
if (rng() <= chance) {
  const position = p.position ?? behindPosition(forward)   // gaze=고정 방향, ambush=등 뒤
  spawnActive(position, now, /* ambush */ p.kind === 'ambush', events)   // spawned + revealed
}
// 굴림 실패 = 헛예고: 아무 이벤트도 내지 않는다.

if (p.kind === 'gaze') {
  gazeCooldownUntil = now + gazeCooldownMs * (1 + randRange(-jitter, jitter))
} else {
  scheduleNextAmbush(now)
}
```

> 참고: 기존 코드의 굴림은 `rng() > gazeChance`로 **거부**를 판정한다. 동일 의미를 유지하려면
> 위 `rng() <= chance`(성공 판정)로 옮기되, 경계 동작이 같도록 주의한다.

> **상한 재확인 불필요(단일 슬롯 불변식):** 예고 슬롯이 하나뿐이라 예고~해소 사이에는 다른 등장이 일어나지
> 않는다(만료로 줄어들 수만 있음). 따라서 예고 시점에 통과한 `maxActive` 조건이 해소 시점에도 항상
> 유지되므로, 해소 단계에서 상한을 다시 검사하지 않는다.

### 위치 처리

- **시선 팝:** 예고가 뜨는 순간의 응시 방향을 `pending.position`에 고정. 리드타임 동안 시선을 돌려도
  고정된 그 자리에 등장한다. ("응시 → 예고 → 그 자리에 확"의 인과가 분명하고 더 무섭다.)
- **백어택:** 현행 유지. 해소 시점의 `forward` 기준으로 `behindPosition()`을 계산해 "지금 보는 방향의 등 뒤"에 등장.

### 파라미터 (SpawnConfig)

| 필드 | 변경 | 기본값 | 설명 |
|---|---|---|---|
| `ambushWarningMs` | **제거** | — | `warningLeadMs`로 일반화 |
| `warningLeadMs` | **신설** | `1000` | 예고 → 등장 리드타임(ms), 시선·백어택 공용 |
| `gazeChance` | 의미 조정 | `0.7` | 시선 예고가 등장으로 이어질 확률(30% 헛예고). 값 유지, 굴림 시점만 이동 |
| `ambushChance` | **신설** | `0.9` | 백어택 예고가 등장으로 이어질 확률(10% 헛예고). `1.0`이면 항상 등장 |

나머지 필드(`maxActive`, `gazeDwellMs`, `gazeCooldownMs`, `gazeCooldownJitter`, `gazeOffset`,
`steadyMaxSpeed`, `ambushIntervalMs`, `ambushJitter`, `ambushSpread`, `ambushElevation`)는 변경 없음.

### 타입 / 이벤트

- `SpawnEvent`의 `warning` 변형은 그대로(`{ type: 'warning'; ambush: boolean }`). 시선 예고는
  `ambush: false`, 백어택 예고는 `ambush: true`.
- **새 이벤트 추가 없음.** 헛예고는 "이벤트 미발생"으로 표현된다(예고 문구는 `GameApp`의 타이머가 자동으로 지움).
- `types.ts`의 `warning` 주석을 백어택 한정 → 일반화 문구로 수정.

### 엔진 / HUD / 카피

- **`HuntController`:** `warning` 핸들러가 이미 `effects.warningCue()` + `onWarning()`을 호출하므로
  시선 팝에도 **코드 변경 없이** 자동 적용된다. (주석의 "ambush" 표현만 일반화.)
- **`GameApp.showWarning`:** 변경 없음. 문구 표시 1300ms ⊃ 리드 1000ms이므로 등장 직후까지 자연스럽게 덮인다.
- **온보딩 카피 `gate.desc` (ko/en):** "appear without warning" 류 표현이 새 동작과 모순되므로 수정.
  - ko 예: "주변을 비추면 서늘한 기운이 먼저 스치고, 곧 세계의 귀신이 나타납니다. 조준점에 맞춰 잡으세요."
  - en 예: "Point your camera around — a chill warns you, then a ghost appears. Center one in the reticle to catch it."

## 테스트 계획 (`tests/spawn.test.ts`)

기존 테스트는 "응시 완료 → 같은 틱 등장"을 가정하므로 2단계로 갱신한다.

**갱신**

- `pops a ghost ... after a steady dwell`: 응시 완료 틱에는 `warning`만(등장 0), `warningLeadMs` 경과 후
  `revealed` 1개(`ambush=false`)·응시 방향 근처임을 검증.
- `respects the gaze cooldown between pops`: 쿨다운 기준 시각이 해소 시점으로 이동한 것을 반영.
- `never exceeds maxActive`: 2단계 흐름에서도 상한 유지 검증.
- `expires ...`, `removes ...`: 등장까지 예고+리드를 거치도록 스텝 수정.
- 백어택 테스트: `ambushWarningMs` → `warningLeadMs` 리네임.

**신규**

1. **시선 헛예고:** `gazeChance: 0`에서 응시 완료 시 `warning`은 뜨지만 이후 어떤 틱에도 `revealed` 없음.
2. **예고 슬롯 단일성:** 예고가 떠 있는 동안 추가 응시/타이머가 새 `warning`을 만들지 않음.
3. **백어택 헛예고:** `ambushChance: 0`에서 백어택 예고 후 미등장.

## 영향 받는 파일

| 파일 | 변경 |
|---|---|
| `src/game/SpawnManager.ts` | 핵심 — 통합 2단계 파이프라인, 상태/파라미터 |
| `src/game/types.ts` | `warning` 주석 일반화 |
| `src/app/HuntController.ts` | 주석만(동작은 자동 적용) |
| `src/i18n/ko.json`, `src/i18n/en.json` | `gate.desc` 카피 |
| `tests/spawn.test.ts` | 테스트 갱신 + 신규 |
| `docs/superpowers/specs/2026-06-18-warned-spawns-design.md` | 본 문서 |

## 리스크 / 완화

- **백어택 기아(starvation):** 시선 예고가 슬롯을 점유해 백어택이 밀릴 수 있음. 시선 쿨다운(5s)·리드(1s)
  대비 백어택 간격(8~24s)이 충분히 커서 영향은 미미. 필요 시 우선순위/별도 슬롯으로 후속 조정.
- **헛예고 과다로 인한 피로:** 기본율(시선 30% / 백어택 10%)을 보수적으로 설정. 플레이 테스트 후 튜닝.
- **리드타임 체감:** 1000ms가 길거나 짧게 느껴질 수 있음 → `warningLeadMs` 한 곳에서 조정 가능.
```
