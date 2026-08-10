const treesQuick = [
  [170, 620], [220, 1020], [420, 520], [620, 1035], [845, 540], [975, 1040],
  [1140, 280], [1210, 1030], [1420, 770], [1530, 260], [1660, 700],
  [1800, 330], [2050, 620], [2200, 980], [2270, 1320], [1650, 1400],
];

const rocksQuick = [
  [455, 930], [690, 600], [940, 720], [1110, 1220], [1310, 330], [1470, 1090],
  [1730, 520], [1860, 880], [2140, 410], [2040, 1360], [760, 1340],
];

export const QUICK_STAGE = {
  id: "quick-battle",
  campaignIndex: -1,
  title: "EMBERFIELD SKIRMISH",
  titleKo: "엠버필드 전면전",
  description: "세 지휘관을 신속하게 격파하는 3~5분 독립 전투입니다.",
  objective: "적 지휘관 3명을 모두 격파하라",
  playerStart: [310, 805],
  tutorial: true,
  field: {
    base: 0x244630,
    patch: 0x37533a,
    road: 0x75684a,
    grid: 0x95b479,
    labelColor: "#d9e5c5",
    paths: [
      [[90, 820], [890, 790], [1320, 520], [1900, 480]],
      [[1190, 570], [1370, 1260], [2020, 1080]],
    ],
  },
  squads: [
    { x: 775, y: 795, count: 5, commander: true },
    { x: 1390, y: 430, count: 7, commander: true },
    { x: 1900, y: 1050, count: 8, commander: true },
    { x: 1290, y: 1320, count: 6, commander: false },
  ],
  recruits: [[535, 744], [1085, 675], [1610, 960], [2070, 720]],
  obstacles: {
    trees: treesQuick,
    rocks: rocksQuick,
    walls: [
      [865, 1180, 0], [961, 1180, 0], [1057, 1180, 0],
      [1510, 610, Math.PI / 2], [1510, 706, Math.PI / 2],
      [1980, 1260, 0], [2076, 1260, 0], [2172, 1260, 0],
    ],
  },
};

export const STORY_STAGES = [
  {
    id: "emberfield-outskirts",
    campaignIndex: 0,
    title: "EMBERFIELD OUTSKIRTS",
    titleKo: "엠버필드 외곽",
    description: "끊어진 지휘망의 첫 신호가 발견됐다. 포로를 구출하고 외곽 봉쇄를 해제하라.",
    objective: "외곽 지휘관을 격파하고 생존자를 구출하라",
    playerStart: [260, 810],
    tutorial: true,
    field: {
      base: 0x244630, patch: 0x37533a, road: 0x75684a, grid: 0x95b479,
      labelColor: "#d9e5c5",
      paths: [[[80, 820], [720, 800], [1250, 650], [1850, 610]]],
    },
    squads: [
      { x: 720, y: 800, count: 5, commander: false },
      { x: 1230, y: 650, count: 6, commander: false },
      { x: 1850, y: 610, count: 7, commander: true },
    ],
    recruits: [[520, 720], [1040, 850], [1580, 735]],
    obstacles: {
      trees: [[160, 570], [210, 1040], [430, 480], [620, 1050], [840, 540], [970, 1080], [1180, 330], [1390, 930], [1620, 420], [1810, 980], [2110, 520], [2240, 1130]],
      rocks: [[450, 930], [690, 610], [940, 720], [1160, 1130], [1460, 520], [1710, 790], [2030, 770]],
      walls: [[1320, 1030, 0], [1416, 1030, 0], [1512, 1030, 0], [2050, 420, Math.PI / 2]],
    },
  },
  {
    id: "broken-pass",
    campaignIndex: 1,
    title: "THE BROKEN PASS",
    titleKo: "붕괴한 협곡",
    description: "적의 매복선이 퇴로를 가로막고 있다. 좁은 협곡을 따라 북쪽 관문을 돌파하라.",
    objective: "협곡 매복 부대를 돌파하고 관문 지휘관을 격파하라",
    playerStart: [260, 1320],
    field: {
      base: 0x4b4534, patch: 0x5d533b, road: 0x8a7752, grid: 0xb8a875,
      labelColor: "#f0dfb6",
      paths: [[[120, 1380], [650, 1240], [960, 900], [1370, 720], [1660, 390], [2190, 260]]],
    },
    squads: [
      { x: 650, y: 1220, count: 6, commander: false },
      { x: 1050, y: 870, count: 7, commander: false },
      { x: 1540, y: 520, count: 6, commander: false },
      { x: 2070, y: 270, count: 8, commander: true },
    ],
    recruits: [[510, 1390], [1180, 720], [1800, 390]],
    obstacles: {
      trees: [[180, 1080], [420, 950], [770, 1420], [1160, 1240], [1470, 980], [1860, 760], [2150, 620]],
      rocks: [[320, 1190], [510, 1030], [730, 1080], [830, 720], [1100, 560], [1260, 920], [1450, 410], [1680, 650], [1880, 280], [2160, 450], [2250, 940]],
      walls: [[760, 910, Math.PI / 2], [760, 1006, Math.PI / 2], [1280, 670, 0], [1376, 670, 0], [1730, 330, Math.PI / 2], [1730, 426, Math.PI / 2]],
    },
  },
  {
    id: "silent-relay",
    campaignIndex: 2,
    title: "THE SILENT RELAY",
    titleKo: "침묵한 중계소",
    description: "최종 명령의 암호 조각이 폐허가 된 중계소에 남아 있다. 방해 신호를 제거하라.",
    objective: "중계소 방어군을 격파하고 마지막 통신 조각을 복구하라",
    playerStart: [250, 790],
    field: {
      base: 0x263c43, patch: 0x34535a, road: 0x68777a, grid: 0x7ca0a5,
      labelColor: "#c9edf0",
      paths: [
        [[80, 800], [650, 780], [1100, 500], [1640, 520], [2110, 790]],
        [[960, 590], [1190, 1160], [1790, 1110]],
      ],
    },
    squads: [
      { x: 690, y: 780, count: 6, commander: false },
      { x: 1120, y: 500, count: 7, commander: false },
      { x: 1260, y: 1170, count: 6, commander: false },
      { x: 1790, y: 1080, count: 7, commander: false },
      { x: 2070, y: 770, count: 8, commander: true },
    ],
    recruits: [[520, 680], [980, 930], [1530, 980], [1880, 650]],
    obstacles: {
      trees: [[140, 530], [260, 1090], [480, 430], [720, 1100], [950, 260], [1320, 310], [1530, 740], [1840, 330], [2180, 1050]],
      rocks: [[420, 890], [800, 590], [1010, 760], [1180, 980], [1420, 520], [1640, 1250], [1950, 920], [2190, 510]],
      walls: [[890, 390, 0], [986, 390, 0], [1082, 390, 0], [1430, 860, Math.PI / 2], [1430, 956, Math.PI / 2], [1900, 610, 0], [1996, 610, 0]],
    },
  },
  {
    id: "lumenfall-last-line",
    campaignIndex: 3,
    title: "LUMENFALL — LAST LINE",
    titleKo: "루멘폴 최종 방어선",
    description: "봉쇄선 너머에 피난 통로가 있다. 살아남은 모든 동료와 함께 최후의 지휘부를 무너뜨려라.",
    objective: "봉쇄 지휘관과 적 총지휘관을 모두 격파하라",
    playerStart: [250, 820],
    final: true,
    field: {
      base: 0x342c31, patch: 0x49343a, road: 0x76605c, grid: 0x9b7774,
      labelColor: "#f0d8d3",
      paths: [
        [[80, 820], [670, 820], [1110, 600], [1540, 430], [2080, 790]],
        [[1110, 600], [1420, 1180], [1970, 1080], [2080, 790]],
      ],
    },
    squads: [
      { x: 680, y: 820, count: 8, commander: false },
      { x: 1110, y: 600, count: 7, commander: false },
      { x: 1450, y: 1160, count: 7, commander: false },
      { x: 1550, y: 420, count: 8, commander: true },
      { x: 1990, y: 1080, count: 7, commander: false },
      { x: 2090, y: 780, count: 8, commander: true, boss: true },
    ],
    recruits: [[500, 720], [950, 900], [1710, 980]],
    obstacles: {
      trees: [[170, 520], [250, 1130], [550, 430], [820, 1160], [1230, 300], [1730, 300], [2210, 1160]],
      rocks: [[430, 930], [770, 610], [980, 780], [1220, 980], [1450, 680], [1760, 830], [1990, 520], [2200, 930]],
      walls: [[850, 500, Math.PI / 2], [850, 596, Math.PI / 2], [1300, 780, 0], [1396, 780, 0], [1492, 780, 0], [1800, 610, Math.PI / 2], [1800, 706, Math.PI / 2], [2180, 500, 0]],
    },
  },
];

export function getStageConfig(stageId, mode = "quick") {
  if (mode === "quick") return QUICK_STAGE;
  return STORY_STAGES.find((stage) => stage.id === stageId) ?? STORY_STAGES[0];
}
