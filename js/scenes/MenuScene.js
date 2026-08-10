import { GAME } from "../config.js";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#071411");
    this.drawBackdrop();

    this.add.text(GAME.width / 2, 138, "LAST COMMAND", {
      fontFamily: "Arial Black, Impact, sans-serif",
      fontSize: "76px",
      color: "#f0e7c9",
      stroke: "#0c1714",
      strokeThickness: 10,
      letterSpacing: 5,
    }).setOrigin(0.5);

    this.add.text(GAME.width / 2, 211, "AI SQUAD BATTLE RPG", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      color: "#73e2bc",
      letterSpacing: 8,
    }).setOrigin(0.5);

    this.add.text(GAME.width / 2, 278, "AI 동료 병사들을 지휘하며 적 부대를 돌파하라", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      color: "#c3cec8",
    }).setOrigin(0.5);

    this.makeButton(GAME.width / 2, 388, 310, 64, "GAME START", () => {
      this.scene.start("GameScene");
    }, true);
    this.makeButton(GAME.width / 2, 472, 310, 56, "HOW TO PLAY", () => {
      this.openHowToPlay();
    });

    this.add.text(GAME.width / 2, 652, "ORIGINAL HTML5 PROTOTYPE  ·  PHASER GRAPHICS", {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      color: "#5f7c71",
      letterSpacing: 2,
    }).setOrigin(0.5);
  }

  drawBackdrop() {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x0a2019, 0x0a2019, 0x07100e, 0x07100e, 1);
    graphics.fillRect(0, 0, GAME.width, GAME.height);

    graphics.lineStyle(1, 0x5ba786, 0.08);
    for (let x = -200; x < GAME.width + 200; x += 80) {
      graphics.lineBetween(x, 0, x + 420, GAME.height);
    }
    for (let y = 40; y < GAME.height; y += 80) graphics.lineBetween(0, y, GAME.width, y);

    const unitColors = [0x5ce0c1, 0x5ce0c1, 0x5ce0c1, 0xeb6d5f, 0xeb6d5f];
    for (let i = 0; i < 24; i += 1) {
      const x = 90 + ((i * 179) % 1120);
      const y = 70 + ((i * 107) % 560);
      const dot = this.add.circle(x, y, i % 7 === 0 ? 7 : 4, unitColors[i % unitColors.length], 0.24);
      this.tweens.add({
        targets: dot,
        alpha: { from: 0.12, to: 0.46 },
        duration: 900 + (i % 5) * 240,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  makeButton(x, y, width, height, label, callback, primary = false) {
    const background = this.add.rectangle(
      x,
      y,
      width,
      height,
      primary ? 0x2fba8d : 0x132c25,
      primary ? 0.94 : 0.95,
    ).setStrokeStyle(2, primary ? 0x8fffd6 : 0x406c5e, 1).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: primary ? "23px" : "18px",
      color: primary ? "#071712" : "#d4e4dd",
      letterSpacing: 2,
    }).setOrigin(0.5);

    background.on("pointerover", () => {
      background.setScale(1.025);
      text.setScale(1.025);
    });
    background.on("pointerout", () => {
      background.setScale(1);
      text.setScale(1);
    });
    background.on("pointerdown", callback);
    return { background, text };
  }

  openHowToPlay() {
    if (this.howOverlay) return;
    const overlay = this.add.container(0, 0).setDepth(100);
    this.howOverlay = overlay;
    const shade = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x020706, 0.82)
      .setOrigin(0)
      .setInteractive();
    const panel = this.add.rectangle(GAME.width / 2, GAME.height / 2, 700, 490, 0x10251f, 1)
      .setStrokeStyle(2, 0x62c9a5, 0.85);
    const title = this.add.text(GAME.width / 2, 142, "HOW TO PLAY", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "32px",
      color: "#eff6e8",
    }).setOrigin(0.5);
    const body = this.add.text(GAME.width / 2, 335,
      "WASD / 방향키   이동\n공격 범위의 가장 가까운 적 자동공격\n\n1  돌격  ·  공격력 +20%, 방어력 -10%\n2  집결  ·  영웅 주변으로 복귀\n3  방어  ·  방어력 +30%, 이동 속도 -20%\n\n전장의 적 지휘관 3명을 모두 쓰러뜨리세요.\n포로에게 접근하면 최대 20명까지 자동으로 합류합니다.\nR 재시작   ·   ESC 일시정지", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        color: "#d4e2dc",
        align: "center",
        lineSpacing: 10,
      }).setOrigin(0.5);
    const close = this.makeButton(GAME.width / 2, 575, 210, 48, "BACK", () => {
      overlay.destroy(true);
      this.howOverlay = null;
    });
    overlay.add([shade, panel, title, body, close.background, close.text]);
  }
}
