export const GAME = Object.freeze({
  width: 1280,
  height: 720,
  worldWidth: 2400,
  worldHeight: 1600,
  maxAllies: 20,
  initialAllies: 8,
  aiDecisionMin: 200,
  aiDecisionMax: 500,
  commanderAuraRadius: 310,
  commanderAttackBonus: 1.25,
});

export const COMMAND = Object.freeze({
  ASSAULT: "ASSAULT",
  REGROUP: "REGROUP",
  DEFEND: "DEFEND",
});

export const COMMAND_LABEL = Object.freeze({
  [COMMAND.ASSAULT]: "돌격 / ASSAULT",
  [COMMAND.REGROUP]: "집결 / REGROUP",
  [COMMAND.DEFEND]: "방어 / DEFEND",
});

export const AI_STATE = Object.freeze({
  FOLLOW: "FOLLOW",
  ATTACK: "ATTACK",
  RETREAT: "RETREAT",
  PROTECT: "PROTECT",
  REGROUP: "REGROUP",
  DEFEND: "DEFEND",
});

export const PERSONALITIES = Object.freeze([
  "Aggressive",
  "Cautious",
  "Protector",
  "Coward",
]);

export const UNIT = Object.freeze({
  player: {
    hp: 200,
    speed: 210,
    damage: 32,
    attackRange: 92,
    attackCooldown: 480,
  },
  ally: {
    hp: 100,
    speed: 154,
    damage: 15,
    attackRange: 50,
    attackCooldown: 760,
  },
  enemy: {
    hp: 100,
    speed: 132,
    damage: 11,
    attackRange: 50,
    attackCooldown: 980,
    detectionRange: 470,
  },
  commander: {
    hp: 300,
    speed: 112,
    damage: 17,
    attackRange: 60,
    attackCooldown: 920,
    detectionRange: 520,
  },
});
