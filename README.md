# LAST COMMAND

> AI 동료 병사들을 지휘하며 적 부대를 돌파하는 실시간 부대 RPG

`LAST COMMAND`는 한 명의 영웅을 직접 조작하면서 최대 20명의 AI 동료 부대를 지휘하는 오리지널 HTML5 실시간 전투 RPG 프로토타입입니다. 다수 동료 실시간 전투라는 장르적 재미에서 영감을 받았지만 캐릭터, 세계관, 명칭, 맵, 그래픽, UI와 전투 규칙은 새롭게 제작했습니다.

## 플레이 방법

플레이어 주변의 8명으로 전투를 시작합니다. 이동 중 만난 포로에게 접근하면 자동으로 부대에 합류하며, 최대 병력은 20명입니다. 전장에 배치된 세 명의 적 지휘관을 모두 격파하면 승리합니다. 플레이어 HP가 0이 되면 게임 오버입니다.

각 지휘관은 주변 일반 적군의 공격력을 25% 높입니다. 먼저 지휘관을 노릴지, 일반병부터 줄일지 판단하고 상황에 맞는 부대 명령을 사용하세요.

## 조작 방법

| 입력 | 동작 |
| --- | --- |
| `WASD` / 방향키 | 이동 |
| 자동 | 공격 범위에 들어온 가장 가까운 적을 쿨타임마다 공격 |
| `1` | 돌격: 아군 공격력 +20%, 방어력 -10% |
| `2` | 집결: 영웅 주변으로 대열 복귀 |
| `3` | 방어: 아군 방어력 +30%, 이동 속도 -20% |
| `R` | 현재 게임 재시작 |
| `ESC` | 일시정지 / 계속하기 |

터치 기기에서는 화면의 방향 버튼과 하단 명령 버튼을 사용할 수 있습니다. 공격은 PC와 모바일 모두 자동입니다.

## 실행 방법

빌드와 패키지 설치가 필요하지 않습니다. ES Module을 안정적으로 불러오기 위해 프로젝트 루트에서 간단한 정적 서버를 실행하세요.

```bash
python3 -m http.server 8080
```

Chrome에서 `http://localhost:8080`을 엽니다. Phaser는 CDN에서 불러오므로 최초 실행 시 인터넷 연결이 필요합니다.

## GitHub Pages 배포

1. 이 디렉터리의 파일을 GitHub 저장소 기본 브랜치에 push합니다.
2. 저장소의 **Settings → Pages**로 이동합니다.
3. **Build and deployment**의 Source를 **Deploy from a branch**로 선택합니다.
4. 배포할 브랜치(예: `main`)와 `/(root)`를 선택하고 저장합니다.
5. 안내되는 `https://<account>.github.io/<repository>/` 주소로 접속합니다.

모든 프로젝트 경로는 `./` 또는 모듈 기준 상대경로를 사용하며 Node.js 서버나 별도 백엔드가 필요하지 않습니다.

## 기술 스택

- HTML5
- JavaScript ES Modules
- Phaser 3.90 (CDN)
- CSS3 반응형 레이아웃
- Phaser Arcade Physics
- GitHub Pages 정적 호스팅

## AI 시스템

각 동료는 `Aggressive`, `Cautious`, `Protector`, `Coward` 중 하나의 성향을 가집니다. 성향 이름을 머리 위에 표시하는 대신 전투 중 실제 행동 차이로 드러납니다.

AI는 200~500ms의 서로 다른 주기로 다음 정보를 다시 인식하고 `FOLLOW`, `ATTACK`, `RETREAT`, `PROTECT`, `REGROUP`, `DEFEND` 중 하나의 상태를 선택합니다.

- 자신의 HP 비율
- 플레이어와의 거리
- 가장 가까운 적과의 거리
- 주변 아군과 적군의 수
- 현재 부대 명령
- 자신의 성향
- 보호가 필요한 저체력 동료와 그 주변 위협

`AISystem`은 인식 스냅샷, 상태 결정, 행동 실행을 분리했습니다. 따라서 향후 `decideAlly()`만 행동 트리, LLM 정책 또는 강화학습 모델의 출력 어댑터로 교체하고 기존 이동·전투·렌더링 계층을 유지할 수 있습니다.

성능을 위해 AI 인식과 separation은 전체 유닛 쌍을 비교하지 않습니다. `SpatialHash`가 전장을 셀로 분할하고 병사는 자신의 주변 셀만 검색합니다. 판단 주기도 유닛마다 분산되어 한 프레임에 연산이 몰리지 않습니다.

## 프로젝트 구조

```text
/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   ├── main.js
│   ├── scenes/
│   │   ├── MenuScene.js
│   │   └── GameScene.js
│   ├── entities/
│   │   ├── BaseUnit.js
│   │   ├── Player.js
│   │   ├── Ally.js
│   │   └── Enemy.js
│   └── systems/
│       ├── BattleSystem.js
│       ├── AISystem.js
│       └── SpatialHash.js
└── assets/
    └── README.md
```

## 외부 에셋 및 라이선스

본 프로토타입은 외부 상용 게임 에셋을 사용하지 않고 Phaser Graphics 기반의 자체 생성 그래픽을 사용했습니다.

현재 이미지, 음악, 효과음 파일은 포함하지 않았습니다. 게임 엔진인 Phaser 3는 MIT License로 배포됩니다. 프로젝트에 새 에셋을 추가할 때는 해당 저작권과 라이선스를 이 문서에 별도로 기록해야 합니다.
