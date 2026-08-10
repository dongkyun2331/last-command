import { GAME, COMMAND, COMMAND_LABEL } from "../config.js";
import { Player } from "../entities/Player.js";
import { Ally } from "../entities/Ally.js";
import { Enemy } from "../entities/Enemy.js";
import { ObjectiveTarget } from "../entities/ObjectiveTarget.js";
import { SpatialHash } from "../systems/SpatialHash.js";
import { AISystem } from "../systems/AISystem.js";
import { BattleSystem } from "../systems/BattleSystem.js";
import { CampaignSystem } from "../systems/CampaignSystem.js";
import { ScoreSystem } from "../systems/ScoreSystem.js";
import { getStageConfig } from "../data/StageConfig.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data = {}) {
    this.mode = data.mode === "story" ? "story" : "quick";
    this.stage = getStageConfig(data.stageId, this.mode);
  }

  create() {
    this.command = COMMAND.REGROUP;
    this.allies = [];
    this.enemies = [];
    this.recruits = [];
    this.objectiveTargets = [];
    this.totalCommanders = this.stage.squads.filter((squad) => squad.commander).length;
    this.commandersRemaining = this.totalCommanders;
    this.rescuedThisStage = 0;
    this.roundElapsedMs = 0;
    this.defenseElapsed = 0;
    this.defenseStarted = false;
    this.defenseActive = false;
    this.triggeredDefenseWaves = new Set();
    this.stageClearPending = false;
    this.gameEnded = false;
    this.isPaused = false;
    this.nextRecruitCheckAt = 0;
    this.nextMiniMapUpdateAt = 0;
    this.touchMovement = { up: false, down: false, left: false, right: false };

    this.createTextures();
    this.createBattlefield();
    this.createObstacleField();

    this.allyGroup = this.physics.add.group();
    this.enemyGroup = this.physics.add.group();
    this.objectiveGroup = this.physics.add.group({ immovable: true, allowGravity: false });
    this.player = new Player(this, this.stage.playerStart[0], this.stage.playerStart[1]);
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.allyGroup, this.obstacles);
    this.physics.add.collider(this.enemyGroup, this.obstacles);
    // Arcade Physics prevents units from passing through opposing formations.
    // Same-faction colliders reinforce the lightweight separation steering so a
    // dense melee still keeps readable silhouettes instead of stacked sprites.
    this.physics.add.collider(this.player, this.enemyGroup);
    this.physics.add.collider(this.allyGroup, this.enemyGroup);
    this.physics.add.collider(this.allyGroup, this.allyGroup);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.player, this.objectiveGroup);
    this.physics.add.collider(this.allyGroup, this.objectiveGroup);

    this.spatialHash = new SpatialHash(180);
    this.aiSystem = new AISystem(this, this.spatialHash);
    this.battleSystem = new BattleSystem(this, this.spatialHash);

    this.spawnInitialAllies();
    this.startingAllyCount = this.allies.filter((ally) => ally.active).length;
    this.spawnEnemySquads();
    this.stage.recruits.forEach(([x, y]) => this.spawnRecruit(x, y));
    this.createStageObjectives();

    this.createInput();
    this.createHUD();
    this.setupCamera();
    this.showOpeningGuide();

    this.events.off("unit-damaged");
    this.events.on("unit-damaged", (unit) => {
      if (unit === this.player) this.cameras.main.shake(70, 0.0022);
      if (unit.isBoss) this.updateBossPhase(unit);
    });
  }

  createTextures() {
    const makeUnit = (key, bodyColor, trimColor, commander = false) => {
      if (this.textures.exists(key)) return;
      const size = commander ? 48 : 36;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x07110f, 0.34);
      g.fillEllipse(size / 2 + 2, size - 4, size * 0.72, 8);
      g.fillStyle(bodyColor, 1);
      g.fillRoundedRect(size * 0.2, size * 0.36, size * 0.6, size * 0.48, 5);
      g.fillStyle(trimColor, 1);
      g.fillCircle(size / 2, size * 0.28, size * 0.18);
      g.lineStyle(commander ? 4 : 3, trimColor, 1);
      g.lineBetween(size * 0.17, size * 0.48, size * 0.05, size * 0.75);
      g.lineBetween(size * 0.83, size * 0.48, size * 0.95, size * 0.75);
      if (commander) {
        g.fillStyle(0xffd56a, 1);
        g.fillTriangle(size * 0.29, size * 0.14, size * 0.5, 1, size * 0.71, size * 0.14);
        g.lineStyle(2, 0xffd56a, 1);
        g.strokeCircle(size / 2, size / 2, size * 0.43);
      }
      g.generateTexture(key, size, size);
      g.destroy();
    };

    makeUnit("player", 0x2ca77e, 0xe8f4d4);
    makeUnit("ally", 0x397db4, 0xb9edff);
    makeUnit("enemy", 0xa83f3b, 0xffc0a0);
    makeUnit("commander", 0x741e2e, 0xffd56a, true);
    makeUnit("recruit", 0x4b8176, 0xc8fff1);

    if (!this.textures.exists("relay")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x0b1719, 0.45).fillEllipse(29, 50, 44, 9);
      g.fillStyle(0x315963, 1).fillRoundedRect(10, 27, 38, 23, 5);
      g.fillStyle(0x77d9e8, 1).fillRect(25, 9, 5, 25);
      g.lineStyle(3, 0x9ff6ff, 0.9).strokeCircle(28, 11, 7);
      g.lineStyle(2, 0x66bdca, 0.8).lineBetween(28, 16, 14, 29).lineBetween(28, 16, 43, 29);
      g.fillStyle(0x9ff6ff, 0.9).fillCircle(19, 38, 3).fillCircle(28, 38, 3).fillCircle(37, 38, 3);
      g.generateTexture("relay", 58, 56);
      g.destroy();
    }

    if (!this.textures.exists("tree")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x553e2b, 1).fillRoundedRect(25, 38, 12, 30, 3);
      g.fillStyle(0x244c35, 1).fillCircle(20, 30, 17).fillCircle(39, 30, 18).fillCircle(30, 17, 19);
      g.fillStyle(0x3b6846, 0.9).fillCircle(24, 19, 9);
      g.generateTexture("tree", 64, 72);
      g.destroy();
    }
    if (!this.textures.exists("rock")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x758079, 1).fillRoundedRect(4, 11, 52, 35, 12);
      g.fillStyle(0x9aa39b, 0.8).fillTriangle(10, 25, 24, 9, 39, 22);
      g.generateTexture("rock", 60, 50);
      g.destroy();
    }
    if (!this.textures.exists("wall")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x77766c, 1).fillRect(0, 4, 96, 28);
      g.lineStyle(2, 0x4d514d, 0.8);
      g.strokeRect(0, 4, 96, 28);
      for (let x = 0; x < 96; x += 24) g.lineBetween(x, 5, x, 31);
      g.lineBetween(0, 18, 96, 18);
      g.generateTexture("wall", 96, 36);
      g.destroy();
    }
  }

  createBattlefield() {
    this.physics.world.setBounds(0, 0, GAME.worldWidth, GAME.worldHeight);
    const g = this.add.graphics().setDepth(-20);
    g.fillStyle(this.stage.field.base, 1).fillRect(0, 0, GAME.worldWidth, GAME.worldHeight);
    g.fillStyle(this.stage.field.patch, 0.38);
    for (let i = 0; i < 105; i += 1) {
      const x = 45 + ((i * 263) % (GAME.worldWidth - 90));
      const y = 35 + ((i * 137) % (GAME.worldHeight - 70));
      g.fillEllipse(x, y, 42 + (i % 4) * 19, 16 + (i % 3) * 8);
    }
    g.lineStyle(78, this.stage.field.road, 0.24);
    for (const path of this.stage.field.paths) {
      g.beginPath();
      g.moveTo(path[0][0], path[0][1]);
      for (let i = 1; i < path.length; i += 1) g.lineTo(path[i][0], path[i][1]);
      g.strokePath();
    }
    g.lineStyle(2, this.stage.field.grid, 0.09);
    for (let x = 0; x <= GAME.worldWidth; x += 160) g.lineBetween(x, 0, x, GAME.worldHeight);
    for (let y = 0; y <= GAME.worldHeight; y += 160) g.lineBetween(0, y, GAME.worldWidth, y);

    this.add.text(160, 935, this.stage.title, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "32px",
      color: this.stage.field.labelColor,
      alpha: 0.12,
      letterSpacing: 5,
    }).setDepth(-10).setRotation(-0.04);
  }

  createObstacleField() {
    this.obstacles = this.physics.add.staticGroup();
    this.stage.obstacles.trees.forEach(([x, y], i) => this.obstacles.create(x, y, "tree").setScale(i % 3 === 0 ? 1.15 : 1).refreshBody());
    this.stage.obstacles.rocks.forEach(([x, y], i) => this.obstacles.create(x, y, "rock").setScale(i % 4 === 0 ? 1.25 : 1).refreshBody());

    this.stage.obstacles.walls.forEach(([x, y, rotation]) => {
      const wall = this.obstacles.create(x, y, "wall").setRotation(rotation);
      wall.refreshBody();
      if (rotation) wall.body.setSize(36, 96).setOffset(30, -30);
    });
  }

  spawnInitialAllies() {
    // Shuffle a balanced personality deck: every run randomizes which formation
    // slot receives each trait while guaranteeing that all four behaviors can be
    // observed in a short competition demo.
    const personalityDeck = Phaser.Utils.Array.Shuffle([
      "Aggressive", "Cautious", "Protector", "Coward",
      "Aggressive", "Cautious", "Protector", "Coward",
      "Aggressive", "Cautious", "Protector", "Coward",
      "Aggressive", "Cautious", "Protector", "Coward",
      "Aggressive", "Cautious", "Protector", "Coward",
    ]);
    const savedRoster = this.mode === "story" ? CampaignSystem.getRoster() : null;
    const roster = savedRoster ?? Array.from({ length: GAME.initialAllies }, (_, index) => ({
      personality: personalityDeck[index],
      hp: 100,
    }));
    for (let i = 0; i < roster.length; i += 1) {
      const ring = Math.floor(i / 8) + 1;
      const angle = ((i % 8) / 8) * Math.PI * 2;
      const ally = this.spawnAlly(
        this.player.x + Math.cos(angle) * (54 + ring * 24),
        this.player.y + Math.sin(angle) * (48 + ring * 20),
        roster[i].personality,
      );
      if (ally) ally.hp = Phaser.Math.Clamp(roster[i].hp ?? 100, 1, 100);
    }
  }

  spawnAlly(x, y, personality = null) {
    if (this.allies.filter((ally) => ally.active).length >= GAME.maxAllies) return null;
    const ally = new Ally(this, x, y, this.allies.length, personality);
    this.allies.push(ally);
    this.allyGroup.add(ally);
    return ally;
  }

  spawnEnemySquads() {
    this.stage.squads.forEach((squad, squadId) => {
      for (let i = 0; i < squad.count; i += 1) {
        const angle = (i / squad.count) * Math.PI * 2;
        const radius = 72 + (i % 2) * 34;
        this.spawnEnemy(
          squad.x + Math.cos(angle) * radius,
          squad.y + Math.sin(angle) * radius,
          squadId,
          squad,
          false,
        );
      }
      if (squad.commander) this.spawnEnemy(squad.x, squad.y, squadId, squad, true, squad.boss);
    });
  }

  spawnEnemy(x, y, squadId, squadCenter, isCommander, isBoss = false) {
    const enemy = new Enemy(this, x, y, squadId, squadCenter, isCommander);
    if (isBoss) {
      enemy.isBoss = true;
      enemy.bossPhase = 1;
      enemy.auraRadius = GAME.commanderAuraRadius;
      enemy.maxHp = 520;
      enemy.hp = 520;
      enemy.damage *= 1.25;
      enemy.attackCooldown *= 0.86;
      enemy.setScale(1.42);
      enemy.auraRing?.setRadius(145).setStrokeStyle(3, 0xffd36d, 0.72);
    }
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy);
    if (isCommander) {
      enemy.targetLabel = this.add.text(x, y - 55, isBoss ? "SUPREME COMMANDER" : "COMMANDER", {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "11px",
        color: "#ffca83",
        backgroundColor: "#501a24aa",
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5).setDepth(28);
    }
  }

  spawnRecruit(x, y) {
    const sprite = this.add.image(x, y, "recruit").setDepth(9).setAlpha(0.88);
    const ring = this.add.circle(x, y, 30, 0x66ffe0, 0.08)
      .setStrokeStyle(2, 0x77f5d6, 0.72)
      .setDepth(5);
    const marker = this.add.text(x, y - 46, "RESCUE", {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "11px",
      color: "#adffeb",
      backgroundColor: "#123a32bb",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: ring, scale: 1.22, alpha: 0.28, duration: 820, yoyo: true, repeat: -1 });
    this.recruits.push({ sprite, ring, marker, active: true, fullMessageShown: false });
  }

  createStageObjectives() {
    const objective = this.stage.objectiveConfig;
    if (objective.type === "destroy-targets") {
      for (const targetConfig of objective.targets) {
        const target = new ObjectiveTarget(this, targetConfig.x, targetConfig.y, targetConfig);
        this.objectiveTargets.push(target);
        this.objectiveGroup.add(target);
      }
      this.objectiveTargetsRemaining = this.objectiveTargets.length;
    }

    if (objective.type === "defend") {
      const { x, y, radius } = objective.zone;
      this.defenseZone = this.add.circle(x, y, radius, 0x71e4ba, 0.07)
        .setStrokeStyle(4, 0x8fffd4, 0.72)
        .setDepth(3);
      this.defenseZonePulse = this.add.circle(x, y, radius * 0.84, 0x71e4ba, 0)
        .setStrokeStyle(2, 0xc9ffe9, 0.5)
        .setDepth(3);
      this.defenseZoneLabel = this.add.text(x, y - radius - 24, "SIGNAL DEFENSE ZONE", {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: "#a8ffdd",
        backgroundColor: "#12372ddd",
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setDepth(26);
      this.tweens.add({
        targets: this.defenseZonePulse,
        scale: 1.16,
        alpha: 0,
        duration: 900,
        repeat: -1,
      });
    }
  }

  spawnDefenseWave(wave, waveIndex) {
    const squadCenter = { x: wave.x, y: wave.y };
    for (let i = 0; i < wave.count; i += 1) {
      const angle = (i / wave.count) * Math.PI * 2;
      const radius = 48 + (i % 2) * 24;
      this.spawnEnemy(
        Phaser.Math.Clamp(wave.x + Math.cos(angle) * radius, 35, GAME.worldWidth - 35),
        Phaser.Math.Clamp(wave.y + Math.sin(angle) * radius, 35, GAME.worldHeight - 35),
        this.stage.squads.length + waveIndex,
        squadCenter,
        false,
      );
    }
    this.showToast(`적 증원 ${waveIndex + 1}차 접근! 방어 대형을 유지하세요.`, "#ffad8d");
  }

  updateBossPhase(boss) {
    if (!boss.active || boss.isDying || boss.hp <= 0) return;

    if (boss.hpRatio <= 0.7 && boss.bossPhase < 2) {
      boss.bossPhase = 2;
      boss.auraRadius = 470;
      boss.damage *= 1.16;
      boss.auraRing?.setRadius(185).setStrokeStyle(4, 0xffba6b, 0.78);
      this.showToast("총지휘관 2단계 — 강화 오라와 증원 신호 감지!", "#ffd27f");
      this.spawnBossReinforcements(boss, 5, 2);
      this.cameras.main.shake(260, 0.006);
    }

    if (boss.hpRatio <= 0.35 && boss.bossPhase < 3) {
      boss.bossPhase = 3;
      boss.attackCooldown *= 0.68;
      boss.moveSpeed *= 1.22;
      boss.detectionRange = 850;
      this.showToast("총지휘관 최종 단계 — 영웅을 직접 추적합니다!", "#ff806f");
      this.spawnBossReinforcements(boss, 7, 3);
      this.cameras.main.flash(180, 255, 95, 70, false);
    }
  }

  spawnBossReinforcements(boss, count, phase) {
    const center = { x: boss.x, y: boss.y };
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 125 + (i % 2) * 35;
      this.spawnEnemy(
        Phaser.Math.Clamp(boss.x + Math.cos(angle) * radius, 35, GAME.worldWidth - 35),
        Phaser.Math.Clamp(boss.y + Math.sin(angle) * radius, 35, GAME.worldHeight - 35),
        100 + phase,
        center,
        false,
      );
    }
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      assault: Phaser.Input.Keyboard.KeyCodes.ONE,
      regroup: Phaser.Input.Keyboard.KeyCodes.TWO,
      defend: Phaser.Input.Keyboard.KeyCodes.THREE,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
    });

    this.keys.assault.on("down", () => this.setCommand(COMMAND.ASSAULT));
    this.keys.regroup.on("down", () => this.setCommand(COMMAND.REGROUP));
    this.keys.defend.on("down", () => this.setCommand(COMMAND.DEFEND));
    this.keys.restart.on("down", () => this.restartStage());
    this.keys.pause.on("down", () => this.togglePause());

  }

  setupCamera() {
    this.cameras.main.setBounds(0, 0, GAME.worldWidth, GAME.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);
  }

  createHUD() {
    const uiDepth = 1000;
    this.add.rectangle(20, 18, 260, 112, 0x07110f, 0.82)
      .setOrigin(0)
      .setStrokeStyle(1, 0x6ca88e, 0.5)
      .setScrollFactor(0)
      .setDepth(uiDepth);
    this.playerHpText = this.add.text(38, 34, "", this.hudStyle(18)).setScrollFactor(0).setDepth(uiDepth + 1);
    this.allyCountText = this.add.text(38, 66, "", this.hudStyle(16)).setScrollFactor(0).setDepth(uiDepth + 1);
    this.commanderText = this.add.text(38, 96, "", this.hudStyle(16)).setScrollFactor(0).setDepth(uiDepth + 1);

    this.add.rectangle(GAME.width / 2, 16, 360, 58, 0x07110f, 0.86)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0xe7d787, 0.58)
      .setScrollFactor(0)
      .setDepth(uiDepth);
    this.commandText = this.add.text(GAME.width / 2, 45, "", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "20px",
      color: "#f7e8a1",
      align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(uiDepth + 1);
    this.add.text(GAME.width / 2, 86, `${this.stage.titleKo}  ·  ${this.stage.objective}`, {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "12px",
      color: "#c5d8ce",
      backgroundColor: "#07110fbf",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(uiDepth + 1);
    this.bossNameText = this.add.text(GAME.width / 2, 114, "", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "11px",
      color: "#ffd382",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(uiDepth + 3).setVisible(false);
    this.bossHpBack = this.add.rectangle(GAME.width / 2, 132, 342, 10, 0x160b0c, 0.92)
      .setStrokeStyle(1, 0xffb168, 0.7)
      .setScrollFactor(0).setDepth(uiDepth + 2).setVisible(false);
    this.bossHpFill = this.add.rectangle(GAME.width / 2 - 169, 132, 338, 6, 0xff6d55, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(uiDepth + 3).setVisible(false);

    this.createCommandButton(380, 680, 170, "1  돌격", "+ATK  /  -DEF", COMMAND.ASSAULT);
    this.createCommandButton(570, 680, 170, "2  집결", "HOLD FORMATION", COMMAND.REGROUP);
    this.createCommandButton(760, 680, 170, "3  방어", "+DEF  /  -SPEED", COMMAND.DEFEND);

    this.toastText = this.add.text(GAME.width / 2, 126, "", {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "21px",
      color: "#ffffff",
      backgroundColor: "#06110ed9",
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(uiDepth + 10).setAlpha(0).setY(170);

    this.createMiniMap(uiDepth);
    this.createTouchControls(uiDepth);
    this.updateHUD();
  }

  hudStyle(size) {
    return {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: `${size}px`,
      color: "#dce9df",
    };
  }

  createCommandButton(x, y, width, title, subtitle, command) {
    const depth = 1002;
    const background = this.add.rectangle(x, y, width, 58, 0x12231e, 0.94)
      .setStrokeStyle(1, 0x759686, 0.7)
      .setScrollFactor(0)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true })
      .setData("isUI", true);
    const titleText = this.add.text(x, y - 9, title, {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "17px",
      color: "#e8eee8",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.add.text(x, y + 13, subtitle, {
      fontFamily: "Arial, sans-serif",
      fontSize: "10px",
      color: "#86a598",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    background.on("pointerdown", () => this.setCommand(command));
    background.on("pointerover", () => titleText.setColor("#7fffd2"));
    background.on("pointerout", () => titleText.setColor("#e8eee8"));
    this.commandButtons ??= new Map();
    this.commandButtons.set(command, background);
  }

  createMiniMap(depth) {
    this.add.rectangle(1158, 80, 208, 128, 0x07110f, 0.78)
      .setStrokeStyle(1, 0x6ca88e, 0.5)
      .setScrollFactor(0)
      .setDepth(depth);
    this.add.text(1062, 24, "TACTICAL MAP", {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "10px",
      color: "#769b8b",
      letterSpacing: 1,
    }).setScrollFactor(0).setDepth(depth + 2);
    this.miniMap = this.add.graphics().setScrollFactor(0).setDepth(depth + 1);
  }

  createTouchControls(depth) {
    const coarsePointer = this.sys.game.device.input.touch || window.matchMedia("(pointer: coarse)").matches;
    if (!coarsePointer) return;
    const makeDirection = (x, y, label, key) => {
      const button = this.add.circle(x, y, 31, 0x0b1815, 0.68)
        .setStrokeStyle(2, 0xa5d7c3, 0.55)
        .setScrollFactor(0)
        .setDepth(depth + 20)
        .setInteractive()
        .setData("isUI", true);
      this.add.text(x, y, label, { fontSize: "24px", color: "#dcebe4" })
        .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 21);
      const start = () => { this.touchMovement[key] = true; };
      const stop = () => { this.touchMovement[key] = false; };
      button.on("pointerdown", start).on("pointerup", stop).on("pointerout", stop);
    };
    makeDirection(96, 575, "▲", "up");
    makeDirection(96, 647, "▼", "down");
    makeDirection(28, 611, "◀", "left");
    makeDirection(164, 611, "▶", "right");

  }

  showOpeningGuide() {
    const tutorial = Boolean(this.stage.tutorial);
    const panel = this.add.rectangle(GAME.width / 2, 305, 670, tutorial ? 205 : 142, 0x06100e, 0.9)
      .setStrokeStyle(2, 0x84d9b8, 0.7)
      .setScrollFactor(0)
      .setDepth(1500);
    const guideContent = tutorial
      ? `MISSION  ·  ${this.stage.titleKo}\nMOVE  ·  WASD / 방향키\nATTACK  ·  범위 안의 적 자동공격\nCOMMAND  ·  1 돌격   2 집결   3 방어\n\n${this.stage.objective}`
      : `MISSION ${this.stage.campaignIndex + 1}  ·  ${this.stage.titleKo}\n\n${this.stage.objective}`;
    const text = this.add.text(GAME.width / 2, 305,
      guideContent, {
        fontFamily: "Arial, sans-serif",
        fontSize: tutorial ? "19px" : "21px",
        color: "#e7f0e8",
        align: "center",
        lineSpacing: 8,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1501);
    this.time.delayedCall(tutorial ? 4200 : 2600, () => {
      this.tweens.add({ targets: [panel, text], alpha: 0, duration: 700, onComplete: () => {
        panel.destroy();
        text.destroy();
      } });
    });
  }

  update(time, delta) {
    if (this.gameEnded || this.isPaused || !this.player.active) return;
    // Only active play time affects the clear-time bonus. Pausing the battle
    // never penalizes the player or makes mobile interruptions lower a score.
    this.roundElapsedMs += delta;

    const input = new Phaser.Math.Vector2(
      Number(this.cursors.right.isDown || this.keys.right.isDown || this.touchMovement.right)
        - Number(this.cursors.left.isDown || this.keys.left.isDown || this.touchMovement.left),
      Number(this.cursors.down.isDown || this.keys.down.isDown || this.touchMovement.down)
        - Number(this.cursors.up.isDown || this.keys.up.isDown || this.touchMovement.up),
    );
    this.player.updateMovement(input);

    this.spatialHash.rebuild([this.allies, this.enemies, this.objectiveTargets, [this.player]]);
    this.enforceUnitSpacing();
    // Spacing can move a unit across a cell boundary, so refresh the index before
    // AI perception and automatic target acquisition use it.
    this.spatialHash.rebuild([this.allies, this.enemies, this.objectiveTargets, [this.player]]);
    this.aiSystem.updateAllies(time, this.allies, this.player, this.command);
    this.aiSystem.updateEnemies(time, this.enemies, this.player);
    this.battleSystem.update(time, this.player, this.allies, this.enemies, this.command);
    this.objectiveTargets.forEach((target) => {
      if (target.active) target.updateOverlays();
    });
    this.updateStageObjective(delta);
    if (this.gameEnded) return;

    if (time >= this.nextRecruitCheckAt) {
      this.checkRecruitment();
      this.nextRecruitCheckAt = time + 180;
    }
    if (time >= this.nextMiniMapUpdateAt) {
      this.updateMiniMap();
      this.nextMiniMapUpdateAt = time + 120;
    }
    this.updateCommanderLabels();
    this.updateHUD();
  }

  updateStageObjective(delta) {
    const objective = this.stage.objectiveConfig;
    if (objective.type !== "defend" || this.gameEnded) return;

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      objective.zone.x,
      objective.zone.y,
    );
    const insideZone = distance <= objective.zone.radius;

    if (insideZone) {
      if (!this.defenseStarted) {
        this.defenseStarted = true;
        this.showToast("방어 신호 연결! 거점을 이탈하지 말고 유지하세요.", "#9effd8");
      } else if (!this.defenseActive) {
        this.showToast("방어 신호 재연결 — 타이머가 계속 진행됩니다.", "#9effd8");
      }
      this.defenseActive = true;
      this.defenseElapsed = Math.min(objective.durationMs, this.defenseElapsed + delta);
      this.defenseZone?.setFillStyle(0x71e4ba, 0.15).setStrokeStyle(5, 0xafffe2, 0.94);

      objective.waves.forEach((wave, index) => {
        if (this.defenseElapsed >= wave.atMs && !this.triggeredDefenseWaves.has(index)) {
          this.triggeredDefenseWaves.add(index);
          this.spawnDefenseWave(wave, index);
        }
      });
      this.checkStageVictory();
    } else {
      if (this.defenseActive) this.showToast("거점 이탈 — 방어 타이머가 일시 정지됩니다.", "#ffc18c");
      this.defenseActive = false;
      this.defenseZone?.setFillStyle(0x71e4ba, 0.07).setStrokeStyle(4, 0x8fffd4, 0.72);
    }
  }

  checkStageVictory() {
    if (this.gameEnded || this.stageClearPending) return;
    const objective = this.stage.objectiveConfig;
    let complete = false;

    if (objective.type === "eliminate") complete = this.commandersRemaining <= 0;
    if (objective.type === "rescue-eliminate") {
      complete = this.commandersRemaining <= 0 && this.rescuedThisStage >= objective.rescueRequired;
    }
    if (objective.type === "defend") complete = this.defenseElapsed >= objective.durationMs;
    if (objective.type === "destroy-targets") complete = this.objectiveTargetsRemaining <= 0;

    if (complete) {
      this.stageClearPending = true;
      this.time.delayedCall(450, () => this.endGame(true));
    }
  }

  getObjectiveProgressText() {
    const objective = this.stage.objectiveConfig;
    if (objective.type === "rescue-eliminate") {
      return `구출 ${this.rescuedThisStage}/${objective.rescueRequired}  ·  지휘관 ${this.commandersRemaining}/${this.totalCommanders}`;
    }
    if (objective.type === "defend") {
      const seconds = Math.floor(this.defenseElapsed / 1000);
      const total = Math.ceil(objective.durationMs / 1000);
      const state = !this.defenseStarted ? "거점 도달" : this.defenseActive ? "방어 중" : "거점 이탈";
      return `${state}     ${seconds} / ${total}초`;
    }
    if (objective.type === "destroy-targets") {
      return `방해 장치     ${this.objectiveTargetsRemaining} / ${objective.targets.length}`;
    }
    return `적 지휘관     ${this.commandersRemaining} / ${this.totalCommanders}`;
  }

  enforceUnitSpacing() {
    const units = [this.player, ...this.allies, ...this.enemies].filter((unit) => unit.active);
    const order = new Map(units.map((unit, index) => [unit, index]));

    for (const unit of units) {
      const unitIndex = order.get(unit);
      const neighbors = this.spatialHash.queryRadius(unit.x, unit.y, 72, (other) => {
        if (other === unit || order.get(other) <= unitIndex) return false;
        // Only pairs involving an enemy need hard spacing. Allies retain their
        // softer steering formation and never block the directly controlled hero.
        return unit.faction === "enemy" || other.faction === "enemy";
      });

      for (const other of neighbors) {
        const minimumDistance = unit.displayWidth * 0.43 + other.displayWidth * 0.43 + 2;
        let dx = other.x - unit.x;
        let dy = other.y - unit.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minimumDistance) continue;

        if (distance < 0.01) {
          const angle = ((unitIndex + 1) * 2.399) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const correction = (minimumDistance - distance) / 2;
        const normalX = dx / distance;
        const normalY = dy / distance;
        const unitX = Phaser.Math.Clamp(unit.x - normalX * correction, 24, GAME.worldWidth - 24);
        const unitY = Phaser.Math.Clamp(unit.y - normalY * correction, 24, GAME.worldHeight - 24);
        const otherX = Phaser.Math.Clamp(other.x + normalX * correction, 24, GAME.worldWidth - 24);
        const otherY = Phaser.Math.Clamp(other.y + normalY * correction, 24, GAME.worldHeight - 24);
        unit.body.reset(unitX, unitY);
        other.body.reset(otherX, otherY);
      }
    }
  }

  setCommand(command) {
    if (this.gameEnded || this.isPaused || this.command === command) return;
    this.command = command;
    const notes = {
      [COMMAND.ASSAULT]: "전군 돌격! 공격력 상승 · 방어력 저하",
      [COMMAND.REGROUP]: "대열 재정비! 영웅 주변으로 집결",
      [COMMAND.DEFEND]: "방어 대형! 방어력 상승 · 이동 속도 저하",
    };
    this.showToast(notes[command], command === COMMAND.ASSAULT ? "#ffb083" : "#dfffc9");
    const wave = this.add.circle(this.player.x, this.player.y, 22, 0x7fffd1, 0)
      .setStrokeStyle(4, command === COMMAND.ASSAULT ? 0xff8b69 : 0x7fffd1, 0.85)
      .setDepth(40);
    this.tweens.add({ targets: wave, scale: 5.5, alpha: 0, duration: 520, onComplete: () => wave.destroy() });
    this.updateHUD();
  }

  checkRecruitment() {
    const activeAllies = this.allies.filter((ally) => ally.active).length;
    for (const recruit of this.recruits) {
      if (!recruit.active) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, recruit.sprite.x, recruit.sprite.y);
      if (distance > 82) continue;

      if (activeAllies >= GAME.maxAllies) {
        if (!recruit.fullMessageShown) {
          this.showToast("최대 병력 20명에 도달했습니다.", "#f7d47e");
          recruit.fullMessageShown = true;
        }
        continue;
      }

      const ally = this.spawnAlly(recruit.sprite.x, recruit.sprite.y);
      if (!ally) continue;
      recruit.active = false;
      this.tweens.killTweensOf(recruit.ring);
      recruit.sprite.destroy();
      recruit.ring.destroy();
      recruit.marker.destroy();
      this.rescuedThisStage += 1;
      this.showToast("새로운 동료가 합류했습니다.", "#9effdc");
      this.spawnBurst(ally.x, ally.y, 0x7fffd1);
      this.checkStageVictory();
      break;
    }
  }

  handleUnitDeath(unit) {
    unit.body.enable = false;
    unit.setVelocity(0, 0);
    unit.setActive(false);
    unit.hpBack.setVisible(false);
    unit.hpFill.setVisible(false);
    unit.stateDot.setVisible(false);

    if (unit === this.player) {
      this.updateHUD();
      this.endGame(false);
      return;
    }

    if (unit.faction === "enemy" && unit.isCommander) {
      this.commandersRemaining = Math.max(0, this.commandersRemaining - 1);
      unit.targetLabel?.destroy();
      this.cameras.main.flash(180, 255, 214, 113, false);
      this.showToast(`적 지휘관 격파! 남은 지휘관 ${this.commandersRemaining}`, "#ffe28a");
      this.checkStageVictory();
    }

    if (unit.isObjective) {
      this.objectiveTargetsRemaining = Math.max(0, this.objectiveTargetsRemaining - 1);
      this.cameras.main.flash(120, 120, 235, 255, false);
      this.showToast(`방해 장치 파괴! 남은 장치 ${this.objectiveTargetsRemaining}`, "#a4f7ff");
      this.checkStageVictory();
    }

    this.spawnBurst(unit.x, unit.y, unit.faction === "enemy" ? 0xff655d : 0x6dbfff);
    this.tweens.add({
      targets: unit,
      alpha: 0,
      angle: unit.faction === "enemy" ? 70 : -70,
      scale: 0.5,
      duration: 280,
      onComplete: () => unit.destroy(),
    });
    this.updateHUD();
  }

  spawnStrike(attacker, target, color) {
    const g = this.add.graphics().setDepth(45);
    g.lineStyle(4, color, 0.95);
    const midX = (attacker.x + target.x) / 2;
    const midY = (attacker.y + target.y) / 2;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const length = Math.max(12, Math.min(30, Math.hypot(dx, dy) * 0.5));
    const normal = new Phaser.Math.Vector2(-dy, dx).normalize().scale(length * 0.35);
    const forward = new Phaser.Math.Vector2(dx, dy).normalize().scale(length * 0.5);
    g.lineBetween(midX - forward.x + normal.x, midY - forward.y + normal.y, midX + forward.x - normal.x, midY + forward.y - normal.y);
    this.tweens.add({ targets: g, alpha: 0, duration: 130, onComplete: () => g.destroy() });
  }

  spawnPlayerSlash(player, direction, hit) {
    const angle = direction.angle();
    const g = this.add.graphics({ x: player.x, y: player.y }).setDepth(50);
    g.lineStyle(7, hit ? 0xfff2a6 : 0xbfd7cf, 0.85);
    g.beginPath();
    g.arc(0, 0, 63, angle - 0.7, angle + 0.7, false);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, scale: 1.18, duration: 190, onComplete: () => g.destroy() });
  }

  spawnBurst(x, y, color) {
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2;
      const shard = this.add.rectangle(x, y, 5, 5, color, 0.9).setDepth(55).setRotation(angle);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * 34,
        y: y + Math.sin(angle) * 34,
        alpha: 0,
        duration: 280,
        onComplete: () => shard.destroy(),
      });
    }
  }

  showToast(message, color = "#ffffff") {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(message).setColor(color).setAlpha(1).setY(170);
    this.tweens.add({ targets: this.toastText, alpha: 0, y: 154, delay: 1500, duration: 480 });
  }

  updateCommanderLabels() {
    for (const enemy of this.enemies) {
      if (enemy.active && enemy.isCommander && enemy.targetLabel) {
        enemy.targetLabel.setPosition(enemy.x, enemy.y - (enemy.isBoss ? 68 : 55));
      }
    }
  }

  updateHUD() {
    if (!this.playerHpText) return;
    const allyCount = this.allies.filter((ally) => ally.active).length;
    this.playerHpText.setText(`PLAYER HP   ${Math.ceil(this.player.hp)} / ${this.player.maxHp}`);
    this.allyCountText.setText(`아군 병력     ${allyCount} / ${GAME.maxAllies}`);
    this.commanderText.setText(this.getObjectiveProgressText());
    this.commandText.setText(`현재 명령   ${COMMAND_LABEL[this.command]}`);
    const boss = this.enemies.find((enemy) => enemy.active && enemy.isBoss);
    const showBoss = Boolean(boss && (boss.hp < boss.maxHp || boss.distanceTo(this.player) < 650));
    this.bossNameText.setVisible(showBoss);
    this.bossHpBack.setVisible(showBoss);
    this.bossHpFill.setVisible(showBoss);
    if (showBoss) {
      this.bossNameText.setText(`SUPREME COMMANDER  ·  PHASE ${boss.bossPhase}`);
      this.bossHpFill.setScale(boss.hpRatio, 1).setFillStyle(boss.bossPhase >= 3 ? 0xff3d3d : 0xff6d55);
    }
    this.commandButtons?.forEach((button, key) => {
      const active = key === this.command;
      button.setFillStyle(active ? 0x2b6b58 : 0x12231e, active ? 1 : 0.94);
      button.setStrokeStyle(active ? 2 : 1, active ? 0x8effd5 : 0x759686, active ? 0.95 : 0.7);
    });
  }

  updateMiniMap() {
    if (!this.miniMap) return;
    const left = 1058;
    const top = 34;
    const width = 200;
    const height = 120;
    const mapX = (x) => left + (x / GAME.worldWidth) * width;
    const mapY = (y) => top + (y / GAME.worldHeight) * height;
    this.miniMap.clear();
    this.miniMap.fillStyle(0x173428, 0.8).fillRect(left, top, width, height);
    this.miniMap.lineStyle(1, 0x94bea9, 0.22).strokeRect(left, top, width, height);
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      this.miniMap.fillStyle(enemy.isCommander ? 0xffd06b : 0xd6534e, enemy.isCommander ? 1 : 0.55);
      this.miniMap.fillCircle(mapX(enemy.x), mapY(enemy.y), enemy.isCommander ? 4 : 1.5);
    }
    for (const recruit of this.recruits) {
      if (!recruit.active) continue;
      this.miniMap.fillStyle(0x6fffd6, 0.9).fillCircle(mapX(recruit.sprite.x), mapY(recruit.sprite.y), 2.5);
    }
    for (const target of this.objectiveTargets) {
      if (!target.active) continue;
      this.miniMap.fillStyle(0x83f4ff, 1).fillRect(mapX(target.x) - 2, mapY(target.y) - 2, 5, 5);
    }
    this.miniMap.fillStyle(0x7ee8ff, 1).fillCircle(mapX(this.player.x), mapY(this.player.y), 4);
  }

  restartStage() {
    if (this.mode === "story" && this.gameEnded && this.commandersRemaining === 0) {
      this.scene.start("WorldMapScene");
      return;
    }
    this.scene.restart({ mode: this.mode, stageId: this.stage.id });
  }

  togglePause() {
    if (this.gameEnded) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.world.pause();
      this.pauseOverlay = this.createEndOverlay("PAUSED", "ESC  계속하기   ·   R  재시작", 0x9edbc4, false);
    } else {
      this.physics.world.resume();
      this.pauseOverlay?.destroy(true);
      this.pauseOverlay = null;
    }
  }

  endGame(victory) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.physics.world.pause();
    const roundResult = ScoreSystem.calculate({
      victory,
      elapsedMs: this.roundElapsedMs,
      player: this.player,
      allies: this.allies,
      startingAllyCount: this.startingAllyCount,
      rescued: this.rescuedThisStage,
      stage: this.stage,
    });
    this.lastRoundResult = roundResult;
    let title = victory ? "VICTORY" : "GAME OVER";
    let subtitle = victory ? `${this.totalCommanders}명의 지휘관을 격파했습니다.` : "지휘관이 쓰러졌습니다.";
    let primaryLabel = "다시 시작 (R)";
    let primaryAction = () => this.restartStage();

    if (victory && this.mode === "story") {
      CampaignSystem.completeStage(this.stage.id, this.allies, this.rescuedThisStage, roundResult);
      title = this.stage.final ? "CAMPAIGN COMPLETE" : "MISSION COMPLETE";
      subtitle = this.stage.final
        ? "최종 명령 복구: 누구도 전장에 남겨두지 마라."
        : "생존 부대가 다음 작전 지역으로 이동합니다.";
      primaryLabel = "전술 지도";
      primaryAction = () => this.scene.start("WorldMapScene");
    }

    this.createEndOverlay(
      title,
      subtitle,
      victory ? 0xffdf7b : 0xff776c,
      true,
      {
        primaryLabel,
        primaryAction,
        secondaryLabel: "메인 화면",
        secondaryAction: () => this.scene.start("MenuScene"),
      },
      roundResult,
    );
  }

  createEndOverlay(title, subtitle, color, showButtons, buttonOptions = {}, roundResult = null) {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);
    // Children of a fixed container still participate in Phaser's input hit test
    // with their own scroll factor. Explicitly fixing every child keeps its click
    // area aligned with the rendered button after the world camera has moved.
    const shade = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x020807, 0.82)
      .setOrigin(0)
      .setScrollFactor(0);
    const resultVisible = showButtons && Boolean(roundResult);
    const panel = this.add.rectangle(
      GAME.width / 2,
      GAME.height / 2,
      resultVisible ? 860 : 610,
      resultVisible ? 560 : showButtons ? 300 : 210,
      0x0b1915,
      0.98,
    )
      .setStrokeStyle(2, color, 0.8)
      .setScrollFactor(0);
    const heading = this.add.text(GAME.width / 2, resultVisible ? 130 : showButtons ? 286 : 320, title, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: resultVisible ? (title.length > 16 ? "42px" : "50px") : showButtons ? "56px" : "46px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: "#07110e",
      strokeThickness: 7,
    }).setOrigin(0.5).setScrollFactor(0);
    const description = this.add.text(GAME.width / 2, resultVisible ? 188 : showButtons ? 366 : 395, subtitle, {
      fontFamily: "Arial, sans-serif",
      fontSize: resultVisible ? "16px" : "18px",
      color: "#d9e3dd",
    }).setOrigin(0.5).setScrollFactor(0);
    container.add([shade, panel, heading, description]);

    if (resultVisible) this.addRoundResultContents(container, roundResult, color);

    if (showButtons) {
      const buttonY = resultVisible ? 590 : 447;
      const primary = this.add.rectangle(GAME.width / 2 - 105, buttonY, 180, 48, 0x2b9e79, 1)
        .setScrollFactor(0).setInteractive({ useHandCursor: true }).setData("isUI", true);
      const secondary = this.add.rectangle(GAME.width / 2 + 105, buttonY, 180, 48, 0x1c332c, 1)
        .setStrokeStyle(1, 0x6c9584).setScrollFactor(0)
        .setInteractive({ useHandCursor: true }).setData("isUI", true);
      const primaryText = this.add.text(GAME.width / 2 - 105, buttonY, buttonOptions.primaryLabel ?? "다시 시작 (R)", { fontStyle: "bold", fontSize: "17px", color: "#07110e" })
        .setOrigin(0.5).setScrollFactor(0);
      const secondaryText = this.add.text(GAME.width / 2 + 105, buttonY, buttonOptions.secondaryLabel ?? "메인 화면", { fontStyle: "bold", fontSize: "17px", color: "#dbe7e0" })
        .setOrigin(0.5).setScrollFactor(0);
      primary.on("pointerdown", buttonOptions.primaryAction ?? (() => this.restartStage()));
      secondary.on("pointerdown", buttonOptions.secondaryAction ?? (() => this.scene.start("MenuScene")));
      container.add([primary, secondary, primaryText, secondaryText]);
    }
    return container;
  }

  addRoundResultContents(container, result, accentColor) {
    const fixed = (object) => object.setScrollFactor(0);
    const score = (value) => `+${ScoreSystem.formatScore(value)}`;
    const gradeColors = {
      S: "#ffe47f",
      A: "#8fffd4",
      B: "#8edbff",
      C: "#e3e9dc",
      D: "#ff9a8f",
    };

    const divider = fixed(this.add.rectangle(GAME.width / 2, 220, 720, 1, accentColor, 0.35));
    const columnDivider = fixed(this.add.rectangle(548, 380, 1, 280, 0x709486, 0.28));
    const rankLabel = fixed(this.add.text(385, 246, "TACTICAL RANK", {
      fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: "13px", color: "#789f8f", letterSpacing: 2,
    }).setOrigin(0.5));
    const grade = fixed(this.add.text(385, 332, result.grade, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "104px",
      color: gradeColors[result.grade],
      stroke: "#06110e",
      strokeThickness: 8,
    }).setOrigin(0.5));
    const totalLabel = fixed(this.add.text(385, 422, "TOTAL SCORE", {
      fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: "12px", color: "#789f8f", letterSpacing: 2,
    }).setOrigin(0.5));
    const totalScore = fixed(this.add.text(385, 459, ScoreSystem.formatScore(result.total), {
      fontFamily: "Arial Black, sans-serif", fontSize: "31px", color: "#f0f5e8",
    }).setOrigin(0.5));
    const casualty = fixed(this.add.text(385, 501, `전사 ${result.stats.fallenAllies}명`, {
      fontFamily: "Arial, sans-serif", fontSize: "13px", color: result.stats.fallenAllies ? "#e8aa96" : "#8ee7c4",
    }).setOrigin(0.5));

    const detailTitle = fixed(this.add.text(595, 247, "SCORE BREAKDOWN", {
      fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: "13px", color: "#8fc2ad", letterSpacing: 1,
    }));
    const detailStyle = {
      fontFamily: "Arial, sans-serif", fontSize: "15px", color: "#dbe7e0",
    };
    const valueStyle = {
      fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: "15px", color: "#f6df91", align: "right",
    };
    const rows = [
      ["클리어 보너스", score(result.breakdown.clear)],
      [`생존 아군  ${result.stats.aliveAllies} / ${result.stats.participants}`, score(result.breakdown.survival)],
      [`잔여 체력  영웅 ${result.stats.playerHpPercent}% · 부대 ${result.stats.averageAllyHpPercent}%`, score(result.breakdown.health)],
      [`클리어 시간  ${ScoreSystem.formatTime(result.stats.elapsedSeconds)} / ${ScoreSystem.formatTime(result.stats.parTimeSec)}`, score(result.breakdown.time)],
      [`구출한 동료  ${result.stats.rescued}명`, score(result.breakdown.rescue)],
    ];
    const detailObjects = [];
    rows.forEach(([label, value], index) => {
      const y = 286 + index * 48;
      detailObjects.push(fixed(this.add.text(595, y, label, detailStyle)));
      detailObjects.push(fixed(this.add.text(1010, y, value, valueStyle).setOrigin(1, 0)));
    });
    const timeNote = fixed(this.add.text(595, 526,
      result.victory ? "기준 시간보다 빠를수록 시간 보너스가 증가합니다." : "패배 시 클리어·시간 보너스는 지급되지 않습니다.", {
        fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#78978a",
      }));

    container.add([
      divider, columnDivider, rankLabel, grade, totalLabel, totalScore, casualty,
      detailTitle, ...detailObjects, timeNote,
    ]);
  }
}
