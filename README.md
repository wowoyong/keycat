# KeyCat

Bongo Cat 스타일 데스크톱 펫. 키보드를 치면 고양이가 따라 움직입니다.

![KeyCat](https://img.shields.io/badge/platform-macOS-blue) ![Tauri 2](https://img.shields.io/badge/Tauri-2.x-orange)

## Features

- **키보드 반응** - 키를 누르면 왼손/오른손이 키보드를 내려침
- **마우스 추적** - 커서 위치에 따라 눈동자가 따라감
- **드래그 이동** - 고양이를 클릭해서 원하는 위치로 이동
- **숨쉬기 애니메이션** - 아이들 상태에서 볼과 머리가 부풀었다 줄어드는 모션
- **눈 깜빡임** - 랜덤 간격으로 자연스러운 깜빡임
- **색상 커스터마이징** - 몸 색상(Body Color)과 악센트 색상(귀/발바닥/볼) 변경
- **크기 변경** - Small(150px) / Medium(200px) / Large(300px)
- **위치 기억** - 마지막 위치를 저장하고 재시작 시 복원
- **시작 시 자동 실행** - macOS 로그인 시 자동 시작 옵션
- **투명 창** - 고양이 외 영역은 클릭이 뒤로 통과

## Screenshot

```
    /\_/\
   ( o.o )  ← 눈이 커서를 따라감
    > ω <   ← 키 입력 시 손이 움직임
   /|   |\
  (_|   |_)
  ⌨⌨⌨⌨⌨⌨⌨
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Tauri 2](https://tauri.app/) |
| Frontend | TypeScript + Canvas 2D API |
| Backend | Rust |
| Input Capture | CoreGraphics CGEventTap (macOS) |
| Build | Vite + Cargo |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI](https://tauri.app/start/prerequisites/) (`npm install -g @tauri-apps/cli`)
- Xcode Command Line Tools (`xcode-select --install`)

## Build

```bash
# 의존성 설치
npm install

# 개발 모드
npm run tauri dev

# 프로덕션 빌드 (바이너리 + .app + .dmg)
npm run tauri build
```

빌드 결과물:
- `src-tauri/target/release/keycat` - 바이너리
- `src-tauri/target/release/bundle/macos/keycat.app` - macOS 앱
- `src-tauri/target/release/bundle/dmg/keycat_*.dmg` - DMG 설치 파일

## Usage

### macOS 접근성 권한

키보드/마우스 입력을 감지하려면 **접근성 권한**이 필요합니다.

1. 앱 최초 실행 시 권한 요청 팝업이 표시됨
2. **시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용**에서 KeyCat 활성화
3. 앱 재시작

> **개발 중 팁**: 매 빌드마다 바이너리가 바뀌어 권한이 초기화될 수 있습니다.
> 터미널에서 직접 실행하면 터미널의 접근성 권한을 상속받아 안정적입니다:
> ```bash
> ./src-tauri/target/release/keycat &
> ```

### 트레이 메뉴

메뉴바의 KeyCat 아이콘을 클릭하면:

| 메뉴 | 설명 |
|------|------|
| Body Color... | 몸(얼굴/팔) 색상 변경 |
| Accent Color... | 악센트(귀/발바닥/볼) 색상 변경 |
| Size | Small / Medium / Large |
| Reset Position | 화면 우하단으로 이동 |
| Start at Login | 로그인 시 자동 시작 |
| Show/Hide | 표시/숨김 토글 |
| Quit | 종료 |

## Project Structure

```
keycat/
├── src/
│   ├── main.ts          # 앱 진입점, 이벤트 핸들링
│   ├── sprites.ts       # Canvas 2D 고양이 렌더링
│   ├── animation.ts     # AnimationLoop, BlinkScheduler
│   ├── eye-consumer.ts  # 커서→눈 방향 변환
│   ├── color-picker.ts  # 색상 선택 UI 로직
│   └── style.css
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          # Tauri 앱 설정 및 플러그인
│   │   ├── input_hook.rs   # CGEventTap 글로벌 입력 캡처
│   │   ├── hit_test.rs     # 커서-창 충돌 감지 (클릭스루)
│   │   ├── tray.rs         # 시스템 트레이 메뉴
│   │   ├── config.rs       # 설정 저장/로드
│   │   └── permissions.rs  # macOS 접근성 권한 체크
│   ├── capabilities/
│   │   └── default.json    # Tauri 2 ACL 권한
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── color-picker.html
└── package.json
```

## How It Works

1. **입력 캡처**: Rust에서 CoreGraphics `CGEventTap`으로 글로벌 키보드/마우스 이벤트 수신
2. **이벤트 전달**: Tauri `emit`으로 프론트엔드에 `key-event`, `mouse-event`, `cursor-event` 전달
3. **상태 업데이트**: TypeScript에서 `CatState` (왼손/오른손/눈방향/숨쉬기) 업데이트
4. **렌더링**: Canvas 2D API로 매 프레임 고양이 그리기 (12fps idle, 30fps active)
5. **클릭스루**: `hit_test.rs`가 커서 위치 추적, 고양이 영역 밖이면 `set_ignore_cursor_events(true)`

## License

MIT
