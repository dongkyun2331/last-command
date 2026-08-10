import { BaseUnit } from "./BaseUnit.js";
import { UNIT } from "../config.js";

export class Enemy extends BaseUnit {
  constructor(scene, x, y, squadId, squadCenter, isCommander = false) {
    const stats = isCommander ? UNIT.commander : UNIT.enemy;
    super(scene, x, y, isCommander ? "commander" : "enemy", stats, "enemy");
    this.isCommander = isCommander;
    this.squadId = squadId;
    this.squadCenter = new Phaser.Math.Vector2(squadCenter.x, squadCenter.y);
    this.detectionRange = stats.detectionRange;
    this.aiState = "GUARD";
    this.nextDecisionAt = Phaser.Math.Between(0, 350);
    this.isCommanderBuffed = false;

    if (isCommander) {
      this.setScale(1.22);
      this.auraRing = scene.add.circle(x, y, 108, 0xff574f, 0.035)
        .setStrokeStyle(2, 0xff8a69, 0.55)
        .setDepth(5);
    }
  }

  updateOverlays() {
    super.updateOverlays();
    this.auraRing?.setPosition(this.x, this.y);
  }

  destroy(fromScene) {
    this.auraRing?.destroy();
    super.destroy(fromScene);
  }
}
