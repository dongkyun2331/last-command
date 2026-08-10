import { GAME, COMMAND, COMMAND_LABEL } from "../config.js";
import { Player } from "../entities/Player.js";
import { Ally } from "../entities/Ally.js";
import { Enemy } from "../entities/Enemy.js";
import { SpatialHash } from "../systems/SpatialHash.js";
import { AISystem } from "../systems/AISystem.js";
import { BattleSystem } from "../systems/BattleSystem.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    this.command = COMMAND.REGROUP;
    this.allies = [];
    this.enemies = [];
    this.recruits = [];
    this.commandersRemaining = 3;
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
    this.player = new Player(this, 310, 805);
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

    this.spatialHash = new SpatialHash(180);
    this.aiSystem = new AISystem(this, this.spatialHash);
    this.battleSystem = new BattleSystem(this, this.spatialHash);

    this.spawnInitialAllies();
    this.spawnEnemySquads();
    this.spawnRecruit(535, 744);
    this.spawnRecruit(1085, 675);
    this.spawnRecruit(1610, 960);
    this.spawnRecruit(2070, 720);

    this.createInput();
    this.createHUD();
    this.setupCamera();
    this.showOpeningGuide();

    this.events.off("unit-damaged");
    this.events.on("unit-damaged", (unit) => {
      if (unit === this.player) this.cameras.main.shake(70, 0.0022);
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
    g.fillStyle(0x244630, 1).fillRect(0, 0, GAME.worldWidth, GAME.worldHeight);
    g.fillStyle(0x37533a, 0.38);
    for (let i = 0; i < 105; i += 1) {
      const x = 45 + ((i * 263) % (GAME.worldWidth - 90));
      const y = 35 + ((i * 137) % (GAME.worldHeight - 70));
      g.fillEllipse(x, y, 42 + (i % 4) * 19, 16 + (i % 3) * 8);
    }
    g.lineStyle(78, 0x75684a, 0.24);
    g.beginPath().moveTo(90, 820).lineTo(890, 790).lineTo(1320, 520).lineTo(1900, 480).strokePath();
    g.beginPath().moveTo(1190, 570).lineTo(1370, 1260).lineTo(2020, 1080).strokePath();
    g.lineStyle(2, 0x95b479, 0.09);
    for (let x = 0; x <= GAME.worldWidth; x += 160) g.lineBetween(x, 0, x, GAME.worldHeight);
    for (let y = 0; y <= GAME.worldHeight; y += 160) g.lineBetween(0, y, GAME.worldWidth, y);

    this.add.text(160, 935, "EMBERFIELD OUTSKIRTS", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "32px",
      color: "#d9e5c5",
      alpha: 0.12,
      letterSpacing: 5,
    }).setDepth(-10).setRotation(-0.04);
  }

  createObstacleField() {
    this.obstacles = this.physics.add.staticGroup();
    const trees = [
      [170, 620], [220, 1020], [420, 520], [620, 1035], [845, 540], [975, 1040],
      [1140, 280], [1210, 1030], [1420, 770], [1530, 260], [1660, 700],
      [1800, 330], [2050, 620], [2200, 980], [2270, 1320], [1650, 1400],
    ];
    const rocks = [
      [455, 930], [690, 600], [940, 720], [1110, 1220], [1310, 330], [1470, 1090],
      [1730, 520], [1860, 880], [2140, 410], [2040, 1360], [760, 1340],
    ];
    trees.forEach(([x, y], i) => this.obstacles.create(x, y, "tree").setScale(i % 3 === 0 ? 1.15 : 1).refreshBody());
    rocks.forEach(([x, y], i) => this.obstacles.create(x, y, "rock").setScale(i % 4 === 0 ? 1.25 : 1).refreshBody());

    const wallSegments = [
      [865, 1180, 0], [961, 1180, 0], [1057, 1180, 0],
      [1510, 610, Math.PI / 2], [1510, 706, Math.PI / 2],
      [1980, 1260, 0], [2076, 1260, 0], [2172, 1260, 0],
    ];
    wallSegments.forEach(([x, y, rotation]) => {
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
    ]);
    for (let i = 0; i < GAME.initialAllies; i += 1) {
      const angle = (i / GAME.initialAllies) * Math.PI * 2;
      this.spawnAlly(
        this.player.x + Math.cos(angle) * 74,
        this.player.y + Math.sin(angle) * 65,
        personalityDeck[i],
      );
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
    const squads = [
      { x: 775, y: 795, count: 5, commander: true },
      { x: 1390, y: 430, count: 7, commander: true },
      { x: 1900, y: 1050, count: 8, commander: true },
      { x: 1290, y: 1320, count: 6, commander: false },
    ];

    squads.forEach((squad, squadId) => {
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
      if (squad.commander) this.spawnEnemy(squad.x, squad.y, squadId, squad, true);
    });
  }

  spawnEnemy(x, y, squadId, squadCenter, isCommander) {
    const enemy = new Enemy(this, x, y, squadId, squadCenter, isCommander);
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy);
    if (isCommander) {
      enemy.targetLabel = this.add.text(x, y - 55, "COMMANDER", {
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
    this.keys.restart.on("down", () => this.scene.restart());
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
    }).setOrigin(0.5).setScrollFactor(0).setDepth(uiDepth + 10).setAlpha(0);

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
    const panel = this.add.rectangle(GAME.width / 2, 305, 630, 192, 0x06100e, 0.9)
      .setStrokeStyle(2, 0x84d9b8, 0.7)
      .setScrollFactor(0)
      .setDepth(1500);
    const text = this.add.text(GAME.width / 2, 305,
      "MOVE  ·  WASD / 방향키\nATTACK  ·  범위 안의 적 자동공격\nCOMMAND  ·  1 돌격   2 집결   3 방어\n\n근처의 포로를 구하고 지휘관 3명을 격파하세요", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        color: "#e7f0e8",
        align: "center",
        lineSpacing: 8,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1501);
    this.time.delayedCall(4200, () => {
      this.tweens.add({ targets: [panel, text], alpha: 0, duration: 700, onComplete: () => {
        panel.destroy();
        text.destroy();
      } });
    });
  }

  update(time) {
    if (this.gameEnded || this.isPaused || !this.player.active) return;

    const input = new Phaser.Math.Vector2(
      Number(this.cursors.right.isDown || this.keys.right.isDown || this.touchMovement.right)
        - Number(this.cursors.left.isDown || this.keys.left.isDown || this.touchMovement.left),
      Number(this.cursors.down.isDown || this.keys.down.isDown || this.touchMovement.down)
        - Number(this.cursors.up.isDown || this.keys.up.isDown || this.touchMovement.up),
    );
    this.player.updateMovement(input);

    this.spatialHash.rebuild([this.allies, this.enemies, [this.player]]);
    this.enforceUnitSpacing();
    // Spacing can move a unit across a cell boundary, so refresh the index before
    // AI perception and automatic target acquisition use it.
    this.spatialHash.rebuild([this.allies, this.enemies, [this.player]]);
    this.aiSystem.updateAllies(time, this.allies, this.player, this.command);
    this.aiSystem.updateEnemies(time, this.enemies, this.player);
    this.battleSystem.update(time, this.player, this.allies, this.enemies, this.command);

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
      this.showToast("새로운 동료가 합류했습니다.", "#9effdc");
      this.spawnBurst(ally.x, ally.y, 0x7fffd1);
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
      if (this.commandersRemaining === 0) this.time.delayedCall(700, () => this.endGame(true));
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
    this.toastText.setText(message).setColor(color).setAlpha(1).setY(126);
    this.tweens.add({ targets: this.toastText, alpha: 0, y: 112, delay: 1500, duration: 480 });
  }

  updateCommanderLabels() {
    for (const enemy of this.enemies) {
      if (enemy.active && enemy.isCommander && enemy.targetLabel) {
        enemy.targetLabel.setPosition(enemy.x, enemy.y - 55);
      }
    }
  }

  updateHUD() {
    if (!this.playerHpText) return;
    const allyCount = this.allies.filter((ally) => ally.active).length;
    this.playerHpText.setText(`PLAYER HP   ${Math.ceil(this.player.hp)} / ${this.player.maxHp}`);
    this.allyCountText.setText(`아군 병력     ${allyCount} / ${GAME.maxAllies}`);
    this.commanderText.setText(`적 지휘관     ${this.commandersRemaining} / 3`);
    this.commandText.setText(`현재 명령   ${COMMAND_LABEL[this.command]}`);
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
    this.miniMap.fillStyle(0x7ee8ff, 1).fillCircle(mapX(this.player.x), mapY(this.player.y), 4);
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
    this.createEndOverlay(
      victory ? "VICTORY" : "GAME OVER",
      victory ? "세 지휘관을 모두 격파했습니다." : "지휘관이 쓰러졌습니다.",
      victory ? 0xffdf7b : 0xff776c,
      true,
    );
  }

  createEndOverlay(title, subtitle, color, showButtons) {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);
    // Children of a fixed container still participate in Phaser's input hit test
    // with their own scroll factor. Explicitly fixing every child keeps its click
    // area aligned with the rendered button after the world camera has moved.
    const shade = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x020807, 0.82)
      .setOrigin(0)
      .setScrollFactor(0);
    const panel = this.add.rectangle(GAME.width / 2, GAME.height / 2, 610, showButtons ? 300 : 210, 0x0b1915, 0.98)
      .setStrokeStyle(2, color, 0.8)
      .setScrollFactor(0);
    const heading = this.add.text(GAME.width / 2, showButtons ? 286 : 320, title, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: showButtons ? "56px" : "46px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: "#07110e",
      strokeThickness: 7,
    }).setOrigin(0.5).setScrollFactor(0);
    const description = this.add.text(GAME.width / 2, showButtons ? 366 : 395, subtitle, {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      color: "#d9e3dd",
    }).setOrigin(0.5).setScrollFactor(0);
    container.add([shade, panel, heading, description]);

    if (showButtons) {
      const restart = this.add.rectangle(GAME.width / 2 - 105, 447, 180, 48, 0x2b9e79, 1)
        .setScrollFactor(0).setInteractive({ useHandCursor: true }).setData("isUI", true);
      const menu = this.add.rectangle(GAME.width / 2 + 105, 447, 180, 48, 0x1c332c, 1)
        .setStrokeStyle(1, 0x6c9584).setScrollFactor(0)
        .setInteractive({ useHandCursor: true }).setData("isUI", true);
      const restartText = this.add.text(GAME.width / 2 - 105, 447, "다시 시작 (R)", { fontStyle: "bold", fontSize: "17px", color: "#07110e" })
        .setOrigin(0.5).setScrollFactor(0);
      const menuText = this.add.text(GAME.width / 2 + 105, 447, "메인 화면", { fontStyle: "bold", fontSize: "17px", color: "#dbe7e0" })
        .setOrigin(0.5).setScrollFactor(0);
      restart.on("pointerdown", () => this.scene.restart());
      menu.on("pointerdown", () => this.scene.start("MenuScene"));
      container.add([restart, menu, restartText, menuText]);
    }
    return container;
  }
}
