# 아키텍처

"주변에 귀신이 있습니다" — 자이로 기반 Web AR 귀신 잡기 PWA. Vite + TypeScript + Three.js + React(HUD 전용).

## 레이어 경계

| 폴더 | 역할 | 의존성 |
|------|------|--------|
| `engine/` | AR·렌더링 (카메라 피드, 자이로→카메라, 스프라이트, 화면 효과). **게임 규칙 없음.** | Three.js, DOM |
| `game/` | 순수 게임 로직 (스폰, 희귀도, 포획, 경제). **DOM·Three 비의존 → 단위 테스트.** | 없음 |
| `services/` | 카탈로그·수집(도감)·설정·영속화(IndexedDB). | idb |
| `ui/` | React HUD/화면 (온보딩, 헌트, 결과, 도감, 설정). | React |
| `app/` | `GameApp` 오케스트레이터 + `GameStore`(관찰 가능 상태) + `HuntController`. | 전부 |
| `i18n/` | KO/EN 다국어 싱글톤 + React Provider. | React |
| `data/` | 귀신 카탈로그 JSON + 타입. | 없음 |

규칙: 파일 <300줄 목표(상한 1000), `game/`는 순수 유지.

## 레이어링 (화면)

```
<video> (카메라)      z 0   — engine/CameraFeed
<canvas> (WebGL)      z 1   — engine/ARScene (투명, 귀신 렌더)
#root (React HUD)     z 2   — ui/* (반드시 transparent 배경)
.fx-flash / .warning  z 8–9 — 확! 플래시 / 드레드 경고
popups / 도감 / 설정   z 10  — 모달·전체화면 오버레이
```

## 데이터 흐름

```
DeviceOrientation ─→ OrientationController ─(smoothed quat)→ ARScene.camera
                                                                │ rAF loop
GameApp.beginSession (사용자 탭) → 권한 → HuntController.start    │
                                                                ▼
HuntController.tick(dt):
  camera.forward ─→ SpawnManager.update → 이벤트(spawned/revealed/warning/expired)
                       │                         │
                       ▼                         ▼
                  GhostSprite (확! 팝)      ScreenEffects (shake/flash/SFX/haptic)
  camera.forward + active ghosts ─→ CatchMechanic.update → {targetedId, gauge, outcome}
                       │                                          │
              reticle CSS var(--catch-gauge) + is-targeting       ▼
                                              caught → Economy.reward + CollectionService + SaveStore
                                                     → GameStore(credits/result) → React HUD
```

- 60fps 값(게이지)은 React state가 아니라 **CSS 변수/ref로 명령형** 갱신.
- React는 거친 상태 전환만 `useSyncExternalStore(GameStore)`로 구독.

## 핵심 모듈

- `engine/OrientationController.ts` — 제거된 Three DeviceOrientationControls 알고리즘 vendor. 절대 북쪽 미사용(상대).
- `engine/CameraFeed.ts` — 단일 getUserMedia 스트림(재획득 금지), CSS 레이어드 `<video>`.
- `engine/ghostTexture.ts` — PNG 우선 + 절차적 망령 폴백(라이브 스왑). 아트 파이프라인: [ghost-art-pipeline.md](ghost-art-pipeline.md).
- `game/SpawnManager.ts` — gaze-pop(비추면 팍) + 기습(등 뒤, 드레드 경고 후). `DEFAULT_SPAWN_CONFIG`로 빈도 튜닝.
- `game/CatchMechanic.ts` — 조준 히트테스트 + 홀드 게이지 + 포획/도주.
- `app/GameApp.ts` — 권한·세션·결과·저장·설정 오케스트레이션.

## 테스트

`game/`·`services/` 순수 로직은 Vitest로 검증 (rarity 분포, 스폰 라이프사이클, 포획 확률, 경제 보상, 세이브 라운드트립/마이그레이션). 기기 의존부(카메라·자이로·연출)는 실기기 수동 확인 — [ios-safari-notes.md](ios-safari-notes.md).
