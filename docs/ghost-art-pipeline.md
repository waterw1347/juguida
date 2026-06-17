# 귀신 아트 파이프라인 (AI 생성)

> 상태: **프롬프트 확정, 이미지 미생성.** 현재는 `engine/ghostTexture.ts`의 절차적(procedural) 다크 망령 플레이스홀더가 표시됨. 아래 프롬프트로 이미지를 생성해 넣으면 자동 교체된다.

## 목적

`세계의 다양한 귀신` 컨셉의 2D 호러 스프라이트를 나노바나나 2로 생성한다. 라이브 카메라 위에 **빌보드 스프라이트**로 합성되므로 투명 배경·정면·전신·중앙 정렬·일관된 다크 호러 룩이 필수.

## 적용 방법 (코드 수정 불필요)

`engine/ghostTexture.ts`의 `getGhostTexture(def)`가 **PNG 우선, 실패 시 절차적 폴백**으로 동작한다.

1. 이미지를 아래 파일명으로 저장해 `public/sprites/`에 넣는다 (카탈로그 `sprite.atlas` 경로와 일치):
   - `kr_cheonyeo.png` · `jp_kappa.png` · `eu_dullahan.png` · `cn_jiangshi.png` · `global_wraith.png`
2. 앱 새로고침 → 해당 귀신이 실제 아트로 표시됨. 없는 파일은 절차적 폴백 유지.
3. **사양**: 1:1 정사각(1024² 권장), 투명 배경 알파 PNG, 캐릭터가 프레임 대부분을 채우되 약간 여백.
4. **투명 배경이 안 되면**: 순수 검정 배경으로 생성 → 로더에 검정 키아웃(투명 처리)을 추가하면 됨 (`ghostTexture.ts`).

새 귀신을 추가하려면 `data/ghosts.catalog.json`에 항목 추가 + 같은 규칙으로 스프라이트 생성.

## 공통 네거티브 프롬프트 (5종 공용)

```
low quality, blurry, pixelated, jpeg artifacts, watermark, text, logo, signature,
background scenery, room, floor, ground, cast shadow on ground, multiple characters,
cute, chibi, kawaii, friendly, smiling, comedic, mascot, extra limbs, extra fingers,
fused fingers, deformed hands, bad anatomy, cropped, cut off, out of frame
```

## 프롬프트 5종

일관성 팁: 1번(처녀귀신)을 먼저 만든 뒤 "같은 화풍·같은 세트로" 참조시키면 룩이 통일된다. 희귀도별 림라이트 색을 다르게 해 도감에서 등급이 시각적으로 구분되게 한다.

### 1) 처녀귀신 · kr_cheonyeo (KR, common) — 파리한 청백색 림라이트
```
Full-body Korean cheonyeo gwisin (virgin ghost): a gaunt spectral woman in a flowing
white traditional hanbok burial robe (소복), impossibly long matted black hair veiling
her face, glimpses of hollow black eye sockets and bloodless grey skin, head tilted at
an unnatural angle, long pale clawed fingers, lower body dissolving into thin mist.
Facing forward, centered, isolated on a fully transparent background (alpha PNG, no
scene, no floor, no ground shadow). Cohesive dark horror video-game sprite, painterly
digital horror illustration with crisp clean cut-out edges, dramatic pale blue-white rim
lighting from behind, faint cold haze, eerie and dreadful, high detail, 1:1 square, 1024x1024.
```

### 2) 갓파 · jp_kappa (JP, uncommon) — 병색 녹색 림라이트
```
Full-body menacing Japanese kappa yokai: a hunched amphibious humanoid with slimy
mottled green-grey scaly skin, webbed clawed hands, a cracked turtle-like shell on its
back, a beak-like maw lined with jagged teeth, a shallow water-filled dish embedded on
top of its head, dripping murky pond water and clinging algae, bulbous glowing eyes,
predatory crouch. Facing forward, centered, isolated on a fully transparent background
(alpha PNG, no scene, no floor, no ground shadow). Cohesive dark horror video-game
sprite, painterly digital horror illustration with crisp clean cut-out edges, sickly green
rim lighting, damp volumetric haze, lurking and threatening, high detail, 1:1 square, 1024x1024.
```

### 3) 둘라한 · eu_dullahan (EU, rare) — 차가운 강철 블루 림라이트
추가 네거티브: `head attached to neck, head on shoulders, two heads, intact neck`
```
Full-body headless Irish Dullahan: a tall armored knight in tattered blackened medieval
plate armor, a smooth EMPTY neck stump with no head on the shoulders, cradling its own
severed grinning head aloft in one raised gauntleted hand, the severed head's eyes
glowing, a pale spine-whip coiled in the other hand, ragged black cloak, decayed sinew at
the neck. Facing forward, centered, isolated on a fully transparent background (alpha PNG,
no scene, no floor, no ground shadow). Cohesive dark horror video-game sprite, painterly
digital horror illustration with crisp clean cut-out edges, cold steel-blue rim lighting,
ominous mist, an omen of death, high detail, 1:1 square, 1024x1024.
```

### 4) 강시 · cn_jiangshi (CN, epic) — 보랏빛 바이올렛 림라이트
```
Full-body Chinese jiangshi hopping vampire: a stiff reanimated corpse in an ornate Qing
dynasty official's robe and round hat, greenish-grey decaying mottled skin, long black
fingernails, both arms rigidly outstretched straight forward, a yellow Taoist paper
talisman with red calligraphy stuck to its forehead, faint glowing eyes shadowed under
the hat brim, frozen mid-hop. Facing forward, centered, isolated on a fully transparent
background (alpha PNG, no scene, no floor, no ground shadow). Cohesive dark horror
video-game sprite, painterly digital horror illustration with crisp clean cut-out edges,
violet-purple rim lighting, grave-cold haze, ancient and cursed, high detail, 1:1 square, 1024x1024.
```

### 5) 고대의 망령 · global_wraith (GLOBAL, legendary) — 용암빛 골드 림라이트
```
Full-body ancient formless wraith, the oldest fear made manifest: a towering shapeless
entity of roiling black smoke and tattered shroud-like tendrils, a vague suggestion of a
skeletal face and many faint glowing eyes scattered within the darkness, clawed wisps of
shadow reaching forward, swirling embers and ash. Facing forward, centered, isolated on a
fully transparent background (alpha PNG, no scene, no floor, no ground shadow). Cohesive
dark horror video-game sprite, painterly digital horror illustration with crisp clean
cut-out edges, molten gold rim lighting piercing the smoke, primordial cosmic terror,
high detail, 1:1 square, 1024x1024.
```

## 향후 작업

- [ ] 5종 이미지 생성 후 `public/sprites/`에 배치, 기기에서 확인
- [ ] 필요 시 검정 키아웃 로더 추가 (`ghostTexture.ts`)
- [ ] (선택) 등장/포획용 다중 프레임 아틀라스로 확장 — `SpriteRef.frameCount`/`fps`는 이미 스키마에 있음
