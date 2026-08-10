import { AI_STATE, COMMAND, GAME } from "../config.js";

export class BattleSystem {
  constructor(scene, spatialHash) {
    this.scene = scene;
    this.spatialHash = spatialHash;
    this.nextAuraUpdateAt = 0;
  }

  update(time, player, allies, enemies, command) {
    if (time >= this.nextAuraUpdateAt) {
      this.updateCommanderAuras(enemies);
      this.nextAuraUpdateAt = time + 420;
    }

    for (const ally of allies) {
      if (!ally.active || !ally.target?.active) continue;
      const combatState = [AI_STATE.ATTACK, AI_STATE.PROTECT, AI_STATE.DEFEND].includes(ally.aiState);
      if (combatState) this.tryMeleeAttack(ally, ally.target, time, command);
    }

    for (const enemy of enemies) {
      if (!enemy.active || enemy.aiState !== "ATTACK" || !enemy.target?.active) continue;
      this.tryMeleeAttack(enemy, enemy.target, time, command);
    }

    player.updateOverlays();
  }

  tryMeleeAttack(attacker, target, time, command) {
    if (time < attacker.nextAttackAt || !target.active) return false;
    if (attacker.distanceTo(target) > attacker.attackRange) return false;

    attacker.nextAttackAt = time + attacker.attackCooldown * Phaser.Math.FloatBetween(0.9, 1.1);
    let damage = attacker.damage * Phaser.Math.FloatBetween(0.9, 1.1);

    // Assault: +20% allied attack, but the target-side calculation below also
    // applies the requested -10% defense penalty to allies receiving damage.
    if (attacker.faction === "ally" && command === COMMAND.ASSAULT) damage *= 1.2;
    if (attacker.faction === "enemy" && attacker.isCommanderBuffed) {
      damage *= GAME.commanderAttackBonus;
    }

    // Defense values are represented as incoming-damage multipliers. +30% defense
    // becomes 1 / 1.3; -10% defense becomes 1 / 0.9.
    if (target.faction === "ally") {
      if (command === COMMAND.DEFEND) damage *= 1 / 1.3;
      if (command === COMMAND.ASSAULT) damage *= 1 / 0.9;
    }
    // The directly controlled hero is a tougher front-line anchor than a regular
    // soldier. Its fixed 200 HP remains meaningful even when several enemies pick
    // the same nearest target during a large melee.
    if (target.faction === "player") damage *= 0.74;

    target.takeDamage(damage, attacker);
    this.scene.spawnStrike(attacker, target, attacker.faction === "enemy" ? 0xff735f : 0xbffcff);
    return true;
  }

  playerAttack(player, direction, time) {
    if (!player.active || time < player.nextAttackAt) return false;
    player.nextAttackAt = time + player.attackCooldown;

    const aim = direction.clone();
    if (aim.lengthSq() < 0.01) aim.copy(player.lastDirection);
    aim.normalize();

    let selected = null;
    let selectedDistance = Infinity;
    for (const enemy of this.spatialHash.queryRadius(
      player.x,
      player.y,
      player.attackRange,
      (unit) => unit.faction === "enemy",
    )) {
      const toEnemy = new Phaser.Math.Vector2(enemy.x - player.x, enemy.y - player.y);
      const distance = toEnemy.length();
      if (distance > 0 && toEnemy.normalize().dot(aim) >= 0.22 && distance < selectedDistance) {
        selected = enemy;
        selectedDistance = distance;
      }
    }

    this.scene.spawnPlayerSlash(player, aim, Boolean(selected));
    if (selected) {
      selected.takeDamage(player.damage * Phaser.Math.FloatBetween(0.95, 1.08), player);
      this.scene.spawnStrike(player, selected, 0xf9eea8);
    }
    return true;
  }

  updateCommanderAuras(enemies) {
    const commanders = enemies.filter((enemy) => enemy.active && enemy.isCommander);
    for (const enemy of enemies) {
      if (!enemy.active || enemy.isCommander) {
        if (enemy.active) enemy.isCommanderBuffed = enemy.isCommander;
        continue;
      }
      enemy.isCommanderBuffed = commanders.some(
        (commander) => commander.distanceTo(enemy) <= GAME.commanderAuraRadius,
      );
      enemy.setAlpha(enemy.isCommanderBuffed ? 1 : 0.92);
    }
  }
}
