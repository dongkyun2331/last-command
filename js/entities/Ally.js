import { BaseUnit } from "./BaseUnit.js";
import { AI_STATE, PERSONALITIES, UNIT } from "../config.js";

export class Ally extends BaseUnit {
  constructor(scene, x, y, formationIndex = 0, personality = null) {
    super(scene, x, y, "ally", UNIT.ally, "ally");
    this.personality = personality ?? Phaser.Utils.Array.GetRandom(PERSONALITIES);
    this.aiState = AI_STATE.FOLLOW;
    this.formationIndex = formationIndex;
    this.formationOffset = this.makeFormationOffset(formationIndex);
    this.nextDecisionAt = Phaser.Math.Between(0, 300);
    this.protectTarget = null;
    this.retreatUntil = 0;
  }

  makeFormationOffset(index) {
    const ring = Math.floor(index / 6) + 1;
    const slot = index % 6;
    const angle = (slot / 6) * Math.PI * 2 + ring * 0.35;
    return new Phaser.Math.Vector2(Math.cos(angle) * ring * 58, Math.sin(angle) * ring * 48);
  }

  setDecision(state, target = null, protectTarget = null) {
    this.aiState = state;
    this.target = target?.active ? target : null;
    this.protectTarget = protectTarget?.active ? protectTarget : null;
    this.setAIStateVisual(state);
  }
}
