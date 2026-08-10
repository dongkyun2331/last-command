import { BaseUnit } from "./BaseUnit.js";
import { UNIT } from "../config.js";

export class Player extends BaseUnit {
  constructor(scene, x, y) {
    super(scene, x, y, "player", UNIT.player, "player");
    this.lastDirection = new Phaser.Math.Vector2(1, 0);
    this.setScale(1.08);
  }

  updateMovement(inputVector) {
    if (this.isDying) return;
    const direction = inputVector.clone();
    if (direction.lengthSq() > 0) {
      direction.normalize();
      this.lastDirection.copy(direction);
      this.setVelocity(direction.x * this.moveSpeed, direction.y * this.moveSpeed);
      this.setFlipX(direction.x < -0.05);
    } else {
      this.setVelocity(0, 0);
    }
    this.updateOverlays();
  }
}
