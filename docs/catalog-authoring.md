# 귀신 카탈로그 작성 가이드

귀신 데이터는 `src/data/ghosts.catalog.json`. 디자이너가 코드 없이 JSON으로 밸런스를 튜닝한다. 스키마: `src/data/catalog.types.ts`.

## 귀신 추가 절차

1. `ghosts.catalog.json`의 `ghosts` 배열에 항목 추가:

```jsonc
{
  "id": "jp_onryo",                      // 유일, snake_case (origin_name 권장)
  "name": { "ko": "원령", "en": "Onryo" },
  "origin": "JP",                        // KR | JP | CN | EU | US | GLOBAL
  "rarity": "epic",                      // common | uncommon | rare | epic | legendary
  "spawnWeight": 4,                      // 같은 티어 내 상대 가중치 (>0)
  "catchDifficulty": 8,                  // 1..10, 높을수록 게이지 느림
  "catchProbability": 0.4,               // 0..1, 게이지 만충 시 성공 확률
  "skittishness": 0.75,                  // 0..1, 포획 난이도 가중(게이지 느려짐)
  "creditReward": 140,                   // 기본 크레딧(>0). 기습 +25%, 첫포획 +50%
  "lore": { "ko": "…", "en": "…" },
  "sprite": { "atlas": "sprites/jp_onryo.png", "frameWidth": 256, "frameHeight": 256, "frameCount": 1, "fps": 1 },
  "activeWindowMs": 3500,                // 확! 등장 후 잡을 수 있는 시간(ms, >0)
  "ambushBias": 0.7,                     // 0..1 (현재 등장은 전역 설정 기반, 향후 사용)
  "revealIntensity": 0.85                // 0..1, 확! 연출 강도(shake/flash/SFX)
}
```

2. 검증: `npm run validate:catalog` — 오류 시 무엇이 틀렸는지 출력. (`npm test` 전 자동 실행)

3. 아트: `public/sprites/<id>.png` 추가 → 새로고침하면 절차적 폴백에서 실제 아트로 자동 교체. 없으면 검증이 경고만 내고 폴백 유지. 프롬프트·사양: [ghost-art-pipeline.md](ghost-art-pipeline.md).

## 밸런스 가이드

- **티어 등장 확률**은 카탈로그가 아니라 `game/RaritySystem.ts`의 `DEFAULT_TIER_PROBABILITIES` (common 0.55 … legendary 0.015). "어떤 귀신이 나올지"는 `spawnWeight`, "그 티어가 얼마나 자주 나올지"는 티어 확률 — 독립 튜닝.
- 높은 희귀도 → 보통 `catchDifficulty`·`skittishness`↑, `catchProbability`↓, `creditReward`↑, `activeWindowMs`↓(빨리 도망), `revealIntensity`↑.
- **등장 빈도/동시 수**는 카탈로그가 아니라 `game/SpawnManager.ts`의 `DEFAULT_SPAWN_CONFIG` (maxActive, gaze dwell/cooldown/chance, ambush interval). 무서움은 "드물고 + 기다림"에서 나오므로 빈도는 보수적으로.

## 다국어

`name`/`lore`는 ko+en 필수(검증됨). UI 문자열은 `src/i18n/{ko,en}.json`. 새 UI 텍스트 추가 시 두 파일 모두 키를 넣을 것.
