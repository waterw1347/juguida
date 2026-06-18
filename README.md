# 주변에 귀신이 있습니다 (Ghosts Are Around You)

자이로 기반 Web AR 귀신 잡기 게임 (PWA). 카메라로 주위를 비추면 서늘한 기운이 먼저 스치고, 곧 세계 각국의 귀신이 **확!** 나타난다. 화면 중앙 조준점에 맞춰 잡으면 크레딧을 얻고 도감을 채운다. iPhone Safari에서 "홈 화면에 추가"로 설치.

A gyroscope-driven Web AR ghost-catching game (PWA). Point your camera around — a chill warns you, then a ghost bursts into view; center one in the reticle and hold to catch it.

## 스택

Vite · TypeScript · Three.js · React(HUD 전용) · vite-plugin-pwa · Vitest

Windows에서 전부 개발·테스트 가능하도록 네이티브/Unity 대신 Web AR을 선택했다. AR은 월드 앵커가 아니라 자이로로 카메라를 회전시키는 방식.

## 실행

```bash
npm install
npm run dev          # mkcert HTTPS (LAN 테스트)
npm run dev:tunnel   # 평문 HTTP — cloudflared 터널과 함께 사용 (실기기 테스트)
npm run build        # 프로덕션 빌드 (dist/)
npm test             # 카탈로그 검증 + 단위 테스트
npm run lint
```

아이폰 실기기 테스트 방법은 [docs/ios-safari-notes.md](docs/ios-safari-notes.md) 참고. HTTPS가 필수(카메라·동작 센서).

## 구조

```
src/
  engine/    AR·렌더 (카메라, 자이로, 스프라이트, 화면 효과) — 게임 규칙 없음
  game/      순수 게임 로직 (스폰·희귀도·포획·경제) — 단위 테스트 대상
  services/  카탈로그·도감·설정·영속화(IndexedDB)
  ui/        React HUD/화면
  app/       오케스트레이터 + 관찰 가능 스토어
  i18n/      한/영 다국어
  data/      귀신 카탈로그 (JSON)
scripts/     검수·아이콘 생성 스크립트
docs/        아키텍처·iOS 노트·카탈로그 작성·아트 파이프라인
```

## 문서

- [아키텍처](docs/architecture.md)
- [iOS Safari 노트 & 실기기 테스트](docs/ios-safari-notes.md)
- [카탈로그 작성 가이드](docs/catalog-authoring.md)
- [귀신 아트 파이프라인 (AI 생성)](docs/ghost-art-pipeline.md)

## 상태

핵심 게임 루프 완성 (카메라 AR · 자이로 · 확! 등장 · 포획 · 크레딧/도감 저장 · 다국어 · 테마 · PWA). 귀신 아트는 절차적 플레이스홀더 사용 중 — AI 생성 스프라이트를 `public/sprites/<id>.png`에 넣으면 자동 교체된다.
