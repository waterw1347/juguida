# scripts

데이터 검수·자산 생성 스크립트 인덱스. (스크립트 추가/수정 시 이 파일도 갱신)

| 스크립트 | 명령 | 설명 |
|----------|------|------|
| `validate-catalog.ts` | `npm run validate:catalog` | `src/data/ghosts.catalog.json`를 스키마 규칙으로 검증 (id 유일성·enum·수치 범위·ko/en 존재·sprite 필드). 누락된 sprite 아트는 경고만. `pretest`에 연결되어 `npm test` 전 자동 실행. 오류 시 비정상 종료. |
| `generate-icons.mjs` | `npm run icons` | PWA/apple-touch 아이콘(192/512/maskable/180)을 `public/icons/`에 생성. 순수 JS PNG 인코더(네이티브 의존성 없음). 아이콘 디자인 변경 후 재실행. |
