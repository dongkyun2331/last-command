import { GAME } from "../config.js";
import { STORY_STAGES } from "../data/StageConfig.js";
import { CampaignSystem } from "../systems/CampaignSystem.js";
import { ScoreSystem } from "../systems/ScoreSystem.js";

const NODE_POSITIONS = [
  { x: 230, y: 450 },
  { x: 500, y: 300 },
  { x: 790, y: 445 },
  { x: 1060, y: 270 },
];

export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super("WorldMapScene");
  }

  create() {
    this.state = CampaignSystem.ensure();
    this.selectedIndex = Math.min(
      this.state.selectedStageIndex ?? this.state.currentStageIndex,
      STORY_STAGES.length - 1,
    );
    this.resetArmed = false;
    this.nodeObjects = [];

    this.drawMap();
    this.createHeader();
    this.createNodes();
    this.createInfoPanel();
    this.createInput();
    this.selectNode(this.selectedIndex, false);

    if (this.state.completed) {
      this.showToast("최종 명령 복구 완료 — 누구도 전장에 남겨두지 마라.", "#ffe79b");
    }
  }

  drawMap() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x10241e, 0x10241e, 0x07100e, 0x07100e, 1);
    g.fillRect(0, 0, GAME.width, GAME.height);

    g.fillStyle(0x19362c, 0.72);
    for (let i = 0; i < 36; i += 1) {
      const x = 35 + ((i * 211) % 1210);
      const y = 95 + ((i * 127) % 450);
      g.fillCircle(x, y, 12 + (i % 5) * 6);
    }
    g.lineStyle(1, 0x74a58e, 0.09);
    for (let x = 0; x <= GAME.width; x += 80) g.lineBetween(x, 80, x, 555);
    for (let y = 80; y <= 555; y += 70) g.lineBetween(0, y, GAME.width, y);

    for (let i = 0; i < NODE_POSITIONS.length - 1; i += 1) {
      const from = NODE_POSITIONS[i];
      const to = NODE_POSITIONS[i + 1];
      const cleared = i < this.state.currentStageIndex;
      g.lineStyle(10, cleared ? 0x52b995 : 0x42554d, cleared ? 0.52 : 0.45);
      g.lineBetween(from.x, from.y, to.x, to.y);
      g.lineStyle(2, cleared ? 0xa7f5d4 : 0x73847d, cleared ? 0.7 : 0.36);
      g.lineBetween(from.x, from.y, to.x, to.y);
    }

    this.add.text(64, 515, "LUMENFALL EVACUATION FRONT", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "31px",
      color: "#d9eadc",
      alpha: 0.08,
      letterSpacing: 4,
    }).setRotation(-0.02);
  }

  createHeader() {
    this.add.text(48, 28, "TACTICAL CAMPAIGN MAP", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "28px",
      color: "#e9f0dc",
      letterSpacing: 2,
    });
    this.add.text(50, 66, "끊어진 지휘 신호를 따라 루멘폴 최종 방어선으로 이동하라", {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      color: "#87b6a3",
    });

    this.add.text(730, 43, `CAMPAIGN SCORE  ${ScoreSystem.formatScore(this.state.totalScore)}`, {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "14px",
      color: "#f1dc91",
      backgroundColor: "#091712cc",
      padding: { x: 12, y: 7 },
    }).setOrigin(0.5);

    this.makeButton(1090, 43, 140, 38, "MAIN MENU", () => this.scene.start("MenuScene"), false, 14);
    this.newCampaignButton = this.makeButton(925, 43, 160, 38, "NEW CAMPAIGN", () => this.confirmNewCampaign(), false, 13);
  }

  createNodes() {
    STORY_STAGES.forEach((stage, index) => {
      const position = NODE_POSITIONS[index];
      const cleared = index < this.state.currentStageIndex || this.state.completed;
      const current = index === this.state.currentStageIndex && !this.state.completed;
      const unlocked = index <= this.state.currentStageIndex;
      const fill = cleared ? 0x2f9d79 : current ? 0xd2a94d : 0x27332f;
      const stroke = cleared ? 0x9effd7 : current ? 0xffe39b : 0x59665f;

      const pulse = this.add.circle(position.x, position.y, 42, fill, current ? 0.18 : 0.05)
        .setStrokeStyle(2, stroke, unlocked ? 0.7 : 0.3);
      const node = this.add.circle(position.x, position.y, 24, fill, unlocked ? 1 : 0.72)
        .setStrokeStyle(3, stroke, unlocked ? 1 : 0.48);
      const number = this.add.text(position.x, position.y, `${index + 1}`, {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "18px",
        color: unlocked ? "#07110e" : "#85928c",
      }).setOrigin(0.5);
      const label = this.add.text(position.x, position.y + 58, stage.titleKo, {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "15px",
        color: unlocked ? "#dce8df" : "#66746e",
        backgroundColor: "#07110ec4",
        padding: { x: 7, y: 4 },
      }).setOrigin(0.5);
      const status = this.add.text(position.x, position.y - 55, cleared ? "CLEARED" : current ? "NEXT MISSION" : "LOCKED", {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "10px",
        color: cleared ? "#8fffd4" : current ? "#ffe091" : "#626d68",
      }).setOrigin(0.5);

      if (unlocked) {
        node.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectNode(index));
        label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectNode(index));
      }
      if (current) {
        this.tweens.add({ targets: pulse, scale: 1.25, alpha: 0, duration: 1000, repeat: -1 });
      }
      this.nodeObjects.push({ pulse, node, number, label, status });
    });

    const markerPosition = NODE_POSITIONS[this.selectedIndex];
    this.marker = this.add.triangle(markerPosition.x, markerPosition.y - 78, 0, 18, 10, 0, 20, 18, 0x7fffd1, 1)
      .setStrokeStyle(2, 0xeafff6, 0.9);
    this.tweens.add({ targets: this.marker, y: markerPosition.y - 86, duration: 560, yoyo: true, repeat: -1 });
  }

  createInfoPanel() {
    this.add.rectangle(GAME.width / 2, 635, 980, 134, 0x091611, 0.94)
      .setStrokeStyle(1, 0x5f917d, 0.7);
    this.stageCounterText = this.add.text(172, 585, "", {
      fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: "12px", color: "#7fc2a7",
    });
    this.stageTitleText = this.add.text(172, 607, "", {
      fontFamily: "Arial Black, sans-serif", fontSize: "22px", color: "#edf1df",
    });
    this.stageDescriptionText = this.add.text(172, 642, "", {
      fontFamily: "Arial, sans-serif", fontSize: "14px", color: "#b5c8bd", wordWrap: { width: 650 },
    });
    this.stageObjectiveText = this.add.text(172, 674, "", {
      fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: "13px", color: "#e2cb7d",
    });
    this.deployButton = this.makeButton(1060, 635, 180, 58, "DEPLOY", () => this.deploy(), true, 18);

    this.toastText = this.add.text(GAME.width / 2, 112, "", {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "18px",
      color: "#ffffff",
      backgroundColor: "#06110ee8",
      padding: { x: 16, y: 9 },
    }).setOrigin(0.5).setAlpha(0).setDepth(50);
  }

  createInput() {
    const keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    });
    keys.left.on("down", () => this.moveSelection(-1));
    keys.a.on("down", () => this.moveSelection(-1));
    keys.right.on("down", () => this.moveSelection(1));
    keys.d.on("down", () => this.moveSelection(1));
    keys.enter.on("down", () => this.deploy());
    keys.space.on("down", () => this.deploy());
    keys.esc.on("down", () => this.scene.start("MenuScene"));
  }

  moveSelection(delta) {
    const maxIndex = Math.min(this.state.currentStageIndex, STORY_STAGES.length - 1);
    this.selectNode(Phaser.Math.Clamp(this.selectedIndex + delta, 0, maxIndex));
  }

  selectNode(index, animate = true) {
    const maxIndex = Math.min(this.state.currentStageIndex, STORY_STAGES.length - 1);
    this.selectedIndex = Phaser.Math.Clamp(index, 0, maxIndex);
    CampaignSystem.setSelectedStage(this.selectedIndex);
    const position = NODE_POSITIONS[this.selectedIndex];
    this.tweens.killTweensOf(this.marker);
    if (animate) {
      this.tweens.add({
        targets: this.marker,
        x: position.x,
        y: position.y - 78,
        duration: 260,
        ease: "Sine.easeOut",
        onComplete: () => this.tweens.add({ targets: this.marker, y: position.y - 86, duration: 560, yoyo: true, repeat: -1 }),
      });
    } else {
      this.marker.setPosition(position.x, position.y - 78);
      this.tweens.add({ targets: this.marker, y: position.y - 86, duration: 560, yoyo: true, repeat: -1 });
    }
    this.refreshInfo();
  }

  refreshInfo() {
    const stage = STORY_STAGES[this.selectedIndex];
    const isCurrent = this.selectedIndex === this.state.currentStageIndex && !this.state.completed;
    const isCleared = this.selectedIndex < this.state.currentStageIndex || this.state.completed;
    const bestScore = this.state.stageScores[stage.id] ?? 0;
    const bestLabel = bestScore ? `   ·   BEST ${ScoreSystem.formatScore(bestScore)}` : "";
    this.stageCounterText.setText(`MISSION ${this.selectedIndex + 1} / ${STORY_STAGES.length}   ·   ${isCleared ? "CLEARED" : "ACTIVE"}${bestLabel}`);
    this.stageTitleText.setText(`${stage.titleKo}  /  ${stage.title}`);
    this.stageDescriptionText.setText(stage.description);
    this.stageObjectiveText.setText(`목표: ${stage.objective}`);
    this.deployButton.text.setText(isCurrent ? "DEPLOY" : this.state.completed ? "COMPLETE" : "CLEARED");
    this.deployButton.background.setAlpha(isCurrent ? 1 : 0.42);
  }

  deploy() {
    if (this.state.completed) {
      this.showToast("캠페인이 완료되었습니다. 새 캠페인으로 다시 시작할 수 있습니다.", "#ffe194");
      return;
    }
    if (this.selectedIndex !== this.state.currentStageIndex) {
      this.showToast("완료된 작전입니다. NEXT MISSION 지역으로 이동하세요.", "#b8c7c0");
      return;
    }
    const stage = STORY_STAGES[this.selectedIndex];
    this.scene.start("GameScene", { mode: "story", stageId: stage.id });
  }

  confirmNewCampaign() {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.newCampaignButton.text.setText("CONFIRM RESET");
      this.showToast("진행 상황을 초기화하려면 버튼을 한 번 더 누르세요.", "#ffc58f");
      this.time.delayedCall(3000, () => {
        if (!this.sys.isActive()) return;
        this.resetArmed = false;
        this.newCampaignButton.text.setText("NEW CAMPAIGN");
      });
      return;
    }
    CampaignSystem.startNew();
    this.scene.restart();
  }

  makeButton(x, y, width, height, label, callback, primary = false, fontSize = 16) {
    const background = this.add.rectangle(x, y, width, height, primary ? 0x2fa67f : 0x142a23, 0.96)
      .setStrokeStyle(1, primary ? 0x95ffda : 0x527567, 0.85)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: `${fontSize}px`,
      color: primary ? "#07110e" : "#d6e5de",
    }).setOrigin(0.5);
    background.on("pointerdown", callback);
    background.on("pointerover", () => background.setScale(1.025));
    background.on("pointerout", () => background.setScale(1));
    return { background, text };
  }

  showToast(message, color = "#ffffff") {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(message).setColor(color).setAlpha(1).setY(112);
    this.tweens.add({ targets: this.toastText, alpha: 0, y: 101, delay: 1700, duration: 420 });
  }
}
