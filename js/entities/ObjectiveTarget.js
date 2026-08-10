import { BaseUnit } from "./BaseUnit.js";

export class ObjectiveTarget extends BaseUnit {
  constructor(scene, x, y, config) {
    super(scene, x, y, "relay", {
      hp: config.hp ?? 180,
      speed: 0,
      damage: 0,
      attackRange: 0,
      attackCooldown: 999999,
    }, "enemy");
    this.isObjective = true;
    this.objectiveLabel = config.label ?? "RELAY";
    this.body.setImmovable(true);
    this.setPushable(false);
    this.stateDot.setVisible(false);
    this.label = scene.add.text(x, y - 55, this.objectiveLabel, {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "11px",
      color: "#9ff7ff",
      backgroundColor: "#12373fdd",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(28);
  }

  updateOverlays() {
    super.updateOverlays();
    this.hpBack.setVisible(true).setPosition(this.x, this.y - 37).setDisplaySize(42, 5);
    this.hpFill.setVisible(true).setPosition(this.x - 20, this.y - 37).setDisplaySize(40 * this.hpRatio, 3);
    this.label?.setPosition(this.x, this.y - 55);
    this.stateDot.setVisible(false);
  }

  destroy(fromScene) {
    this.label?.destroy();
    super.destroy(fromScene);
  }
}
