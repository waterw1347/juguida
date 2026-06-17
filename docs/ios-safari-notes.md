# iOS Safari 노트 & 실기기 테스트

개발 PC는 Windows, 타깃은 iPhone. Web AR이라 Mac 없이 개발·테스트 가능하지만 iOS Safari 특유의 제약이 있다.

## 실기기 테스트 (Windows → iPhone)

### 방법 A — cloudflared 터널 (권장, 폰에 인증서 설치 불필요)
```bash
npm run dev:tunnel                                   # http://localhost:5173 (mkcert 끔)
./tools/cloudflared.exe tunnel --url http://localhost:5173
```
출력되는 `https://<random>.trycloudflare.com` 주소를 아이폰 Safari에서 연다. 신뢰된 HTTPS라 카메라·동작 센서 권한이 정상 동작. (vite `server.allowedHosts`에 `.trycloudflare.com` 포함됨.)

> `tools/cloudflared.exe`는 gitignore됨. 없으면: `curl -L -o tools/cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe`

### 방법 B — mkcert LAN (오프라인 대안)
```bash
npm run dev          # vite-plugin-mkcert가 HTTPS 켬, Network URL 출력
```
아이폰(같은 Wi-Fi)에서 `https://<PC-IP>:5173` 접속. mkcert 루트 CA를 아이폰에 설치 후 신뢰해야 함(설정 > 일반 > 정보 > 인증서 신뢰 설정).

## 사활이 걸린 제약 (검증됨)

- **standalone PWA에서 카메라 동작함** (iOS 13.4에서 과거 버그 수정). 단 **getUserMedia 스트림은 앱 생명주기 동안 1개만 유지**하고 같은 문서 URL 변경(hash 라우팅)을 피한다. → `CameraFeed`는 재획득하지 않고 pause/resume만.
- **`DeviceOrientationEvent.requestPermission()`**(iOS 13+)는 **사용자 탭 제스처 안에서** 호출해야 하고 카메라 권한과 별개 프롬프트. → 둘 다 온보딩 탭 한 번에서 처리(`GameApp.beginSession`).
- **HTTPS 필수** (dev 포함) — 위 터널/mkcert.
- **`<video>`**: `muted + playsinline + autoplay`, `play()`는 제스처 안에서.
- **#root는 transparent 배경** 필수 — 안 그러면 카메라/캔버스를 가려 까만 화면.
- **iOS Safari는 `navigator.vibrate` 미지원** — 햅틱은 안드로이드만. 공포는 즉발 시각 팝으로.
- **PWA 저장**: ~50MB 상한 + 미사용 7일 후 제거. 세이브(크레딧·도감)는 작게 IndexedDB, 카탈로그·스프라이트는 SW 캐시(재다운로드 가능).

## 프로덕션 빌드 주의

`npm run build`는 일부 샌드박스/환경에서 Rollup 네이티브가 three.js 번들링 중 조용히 죽는 사례가 있었다(개발 환경 특이사항, 코드 문제 아님 — `tsc`·dev 서버·테스트는 정상). 실패 시 Node 메모리 상향(`NODE_OPTIONS=--max-old-space-size=4096`) 또는 의존성 재설치(`rm -rf node_modules && npm install`)로 네이티브 바이너리 재배치.

## 마일스톤별 실기기 체크리스트

- [ ] 권한 게이트: 탭 한 번에 카메라+동작 두 프롬프트, 거부 시 커스텀 팝업→재시도
- [ ] 카메라 풀스크린 배경, autoplay
- [ ] 자이로 둘러보기: 방향·화면회전 정상, 지터/드리프트 허용 범위
- [ ] 확! 등장(탐색/기습), 드레드 경고("주변에 귀신이 있습니다")
- [ ] 포획 루프(락온→홀드→게이지→성공/도주)
- [ ] 크레딧/도감 저장 — 재시작/standalone 후 유지
- [ ] **홈 화면에 추가 → standalone 실행 시 카메라 동작** (최대 리스크)
- [ ] 다국어(한/영)·테마(다크/라이트) 전환
- [ ] 잠금/백그라운드 복귀 후 정상 재개
- [ ] 다수 귀신 시 프레임·발열
