import { AI_STATE, COMMAND, GAME } from "../config.js";

/**
 * Rule-based squad brain.
 *
 * decideAlly() is deliberately pure-ish: it converts a perception snapshot into
 * an explicit state and target. A future LLM policy, behavior tree, or trained
 * reinforcement-learning policy can replace this method while reusing perception,
 * movement, combat, and rendering unchanged.
 */
export class AISystem {
  constructor(scene, spatialHash) {
    this.scene = scene;
    this.spatialHash = spatialHash;
  }

  updateAllies(time, allies, player, command) {
    for (const ally of allies) {
      if (!ally.active) continue;

      // Deliberately stagger expensive perception. Each soldier thinks every
      // 200–500 ms, but continues executing its chosen state every frame.
      if (time >= ally.nextDecisionAt) {
        const snapshot = this.buildAllySnapshot(ally, player, command);
        const decision = this.decideAlly(snapshot, time);
        ally.setDecision(decision.state, decision.target, decision.protectTarget);
        ally.nextDecisionAt = time + Phaser.Math.Between(GAME.aiDecisionMin, GAME.aiDecisionMax);
      }

      this.executeAllyState(ally, player, command);
      ally.updateOverlays();
    }
  }

  buildAllySnapshot(ally, player, command) {
    const nearbyAllies = this.spatialHash.queryRadius(
      ally.x,
      ally.y,
      190,
      (unit) => unit.faction === "ally" && unit !== ally,
    );
    const nearbyEnemies = this.spatialHash.queryRadius(
      ally.x,
      ally.y,
      190,
      (unit) => unit.faction === "enemy",
    );
    const nearestEnemy = this.spatialHash.nearest(
      ally.x,
      ally.y,
      command === COMMAND.ASSAULT ? 680 : 500,
      (unit) => unit.faction === "enemy",
    );
    const weakAllies = this.spatialHash
      .queryRadius(ally.x, ally.y, 300, (unit) => unit.faction === "ally" && unit !== ally)
      .filter((unit) => unit.hpRatio <= 0.45)
      .sort((a, b) => a.hpRatio - b.hpRatio);
    const weakestAlly = weakAllies[0] ?? null;
    const threatToWeakAlly = weakestAlly
      ? this.spatialHash.nearest(
        weakestAlly.x,
        weakestAlly.y,
        240,
        (unit) => unit.faction === "enemy",
      )
      : null;

    return {
      ally,
      player,
      command,
      hpRatio: ally.hpRatio,
      playerDistance: ally.distanceTo(player),
      nearestEnemy,
      enemyDistance: nearestEnemy ? ally.distanceTo(nearestEnemy) : Infinity,
      nearbyAllyCount: nearbyAllies.length,
      nearbyEnemyCount: nearbyEnemies.length,
      weakestAlly,
      threatToWeakAlly,
    };
  }

  decideAlly(snapshot, time) {
    const {
      ally,
      command,
      hpRatio,
      playerDistance,
      nearestEnemy,
      enemyDistance,
      nearbyAllyCount,
      nearbyEnemyCount,
      weakestAlly,
      threatToWeakAlly,
    } = snapshot;
    const outnumbered = nearbyEnemyCount > nearbyAllyCount + 1;
    const immediateThreat = enemyDistance <= 115;

    // CAUTIOUS: survival overrides an offensive order below 30% HP. It retreats
    // toward the player while threatened, then changes to REGROUP once safe so it
    // does not oscillate between attack and retreat at the health threshold.
    if (ally.personality === "Cautious" && hpRatio <= 0.3) {
      if (nearestEnemy && enemyDistance < 320) {
        return { state: AI_STATE.RETREAT, target: nearestEnemy };
      }
      return { state: AI_STATE.REGROUP, target: null };
    }

    // COWARD: below half HP, local numerical disadvantage causes a reliable
    // retreat. When forces are even it still has a 42% decision-time hesitation,
    // creating visible but non-random-wandering behavior. retreatUntil prevents
    // the soldier from changing its mind again on the very next AI tick.
    if (ally.personality === "Coward" && hpRatio <= 0.5 && nearestEnemy) {
      const fearTriggered = outnumbered || time < ally.retreatUntil || Math.random() < 0.42;
      if (fearTriggered) {
        ally.retreatUntil = Math.max(ally.retreatUntil, time + 900);
        return { state: AI_STATE.RETREAT, target: nearestEnemy };
      }
    }

    // PROTECTOR: a nearby ally under 45% HP becomes a higher-value objective than
    // the nearest enemy. The protector moves to that ally and attacks the enemy
    // threatening it, which makes the behavior spatially readable during battle.
    if (ally.personality === "Protector" && weakestAlly && threatToWeakAlly) {
      return {
        state: AI_STATE.PROTECT,
        target: threatToWeakAlly,
        protectTarget: weakestAlly,
      };
    }

    // REGROUP is a strong formation order: distant soldiers return first. At the
    // formation itself they may answer only an immediate melee threat; otherwise
    // they FOLLOW their personal formation slot around the hero.
    if (command === COMMAND.REGROUP) {
      if (playerDistance > 125) return { state: AI_STATE.REGROUP, target: null };
      if (nearestEnemy && immediateThreat) return { state: AI_STATE.ATTACK, target: nearestEnemy };
      return { state: AI_STATE.FOLLOW, target: null };
    }

    // DEFEND creates a moving perimeter. Soldiers outside it regroup; soldiers
    // inside intercept enemies up to 250 px from the hero. The execution layer
    // applies the requested -20% speed and the battle layer applies +30% defense.
    if (command === COMMAND.DEFEND) {
      if (playerDistance > 205) return { state: AI_STATE.REGROUP, target: null };
      if (nearestEnemy && Phaser.Math.Distance.Between(
        nearestEnemy.x,
        nearestEnemy.y,
        snapshot.player.x,
        snapshot.player.y,
      ) <= 270) {
        return { state: AI_STATE.DEFEND, target: nearestEnemy };
      }
      return { state: AI_STATE.DEFEND, target: null };
    }

    // ASSAULT widens perception and turns any discovered enemy into an ATTACK
    // target. Low-health cautious/coward checks above can still refuse this order,
    // preserving individual personality under the same squad command.
    if (command === COMMAND.ASSAULT && nearestEnemy) {
      return { state: AI_STATE.ATTACK, target: nearestEnemy };
    }

    // AGGRESSIVE soldiers acquire targets farther away and attack even when their
    // local group is outnumbered. This branch intentionally does not inspect HP.
    if (ally.personality === "Aggressive" && nearestEnemy && enemyDistance <= 540) {
      return { state: AI_STATE.ATTACK, target: nearestEnemy };
    }

    // CAUTIOUS soldiers with healthy HP commit only with nearby support, unless an
    // enemy is already in melee range and ignoring it would look unresponsive.
    if (ally.personality === "Cautious" && nearestEnemy) {
      if (!outnumbered || immediateThreat) return { state: AI_STATE.ATTACK, target: nearestEnemy };
      return { state: AI_STATE.REGROUP, target: null };
    }

    // Default soldiers and protectors without a rescue target fight nearby enemies
    // but return to the hero when isolated. Both distance and local force counts
    // therefore affect the final decision rather than random movement.
    if (nearestEnemy && (enemyDistance <= 330 || nearbyAllyCount >= nearbyEnemyCount)) {
      return { state: AI_STATE.ATTACK, target: nearestEnemy };
    }
    if (playerDistance > 270) return { state: AI_STATE.REGROUP, target: null };
    return { state: AI_STATE.FOLLOW, target: null };
  }

  executeAllyState(ally, player, command) {
    let destination = null;
    let arrivalRadius = 18;
    let speedMultiplier = command === COMMAND.DEFEND ? 0.8 : 1;

    switch (ally.aiState) {
      case AI_STATE.ATTACK:
        if (ally.target?.active) {
          destination = ally.target;
          arrivalRadius = ally.attackRange * 0.78;
          if (command === COMMAND.ASSAULT) speedMultiplier = 1.08;
        }
        break;
      case AI_STATE.RETREAT: {
        const threat = ally.target?.active ? ally.target : null;
        const away = new Phaser.Math.Vector2(
          player.x - (threat?.x ?? ally.x),
          player.y - (threat?.y ?? ally.y),
        );
        if (away.lengthSq() < 1) away.set(1, 0);
        away.normalize().scale(90);
        destination = new Phaser.Math.Vector2(player.x + away.x, player.y + away.y);
        speedMultiplier = 1.16;
        arrivalRadius = 30;
        break;
      }
      case AI_STATE.PROTECT:
        if (ally.target?.active && ally.distanceTo(ally.target) > ally.attackRange * 0.8) {
          destination = ally.target;
          arrivalRadius = ally.attackRange * 0.78;
        } else if (ally.protectTarget?.active) {
          destination = ally.protectTarget;
          arrivalRadius = 45;
        }
        break;
      case AI_STATE.REGROUP:
        destination = new Phaser.Math.Vector2(
          player.x + ally.formationOffset.x * 0.48,
          player.y + ally.formationOffset.y * 0.48,
        );
        speedMultiplier = 1.12;
        arrivalRadius = 16;
        break;
      case AI_STATE.DEFEND:
        if (ally.target?.active) {
          destination = ally.target;
          arrivalRadius = ally.attackRange * 0.78;
        } else {
          destination = new Phaser.Math.Vector2(
            player.x + ally.formationOffset.x * 0.78,
            player.y + ally.formationOffset.y * 0.78,
          );
        }
        break;
      case AI_STATE.FOLLOW:
      default:
        destination = new Phaser.Math.Vector2(
          player.x + ally.formationOffset.x,
          player.y + ally.formationOffset.y,
        );
        break;
    }

    this.moveUnit(ally, destination, arrivalRadius, ally.moveSpeed * speedMultiplier, "ally");
  }

  updateEnemies(time, enemies, player) {
    for (const enemy of enemies) {
      if (!enemy.active) continue;

      if (time >= enemy.nextDecisionAt) {
        // The supreme commander changes policy in its final phase and deliberately
        // hunts the hero. Other enemies continue choosing the locally nearest
        // target, so this boss rule remains isolated from normal squad AI.
        let target = null;
        if (enemy.isBoss && enemy.bossPhase >= 3 && enemy.distanceTo(player) <= enemy.detectionRange) {
          target = player;
        } else {
          target = this.spatialHash.nearest(
            enemy.x,
            enemy.y,
            enemy.detectionRange,
            (unit) => unit.faction === "ally" || unit.faction === "player",
          );
        }

        if (target) {
          enemy.target = target;
          enemy.aiState = "ATTACK";
        } else if (enemy.squadCenter.distance(new Phaser.Math.Vector2(enemy.x, enemy.y)) > 120) {
          enemy.target = null;
          enemy.aiState = "RETURN";
        } else {
          enemy.target = null;
          enemy.aiState = "GUARD";
        }
        enemy.nextDecisionAt = time + Phaser.Math.Between(260, 440);
      }

      let destination = null;
      let arrivalRadius = 24;
      if (enemy.aiState === "ATTACK" && enemy.target?.active) {
        destination = enemy.target;
        arrivalRadius = enemy.attackRange * 0.78;
      } else if (enemy.aiState === "RETURN") {
        destination = enemy.squadCenter;
        arrivalRadius = 55;
      }
      this.moveUnit(enemy, destination, arrivalRadius, enemy.moveSpeed, "enemy");
      enemy.updateOverlays();
    }
  }

  moveUnit(unit, destination, arrivalRadius, speed, faction) {
    const velocity = new Phaser.Math.Vector2(0, 0);
    if (destination) {
      const dx = destination.x - unit.x;
      const dy = destination.y - unit.y;
      if (dx * dx + dy * dy > arrivalRadius * arrivalRadius) {
        velocity.set(dx, dy).normalize().scale(speed);
      }
    }

    // Separation also uses the spatial hash. Only units within 36 px are checked,
    // so this stays local even when the battlefield contains many squads.
    const neighbors = this.spatialHash.queryRadius(
      unit.x,
      unit.y,
      36,
      (other) => other !== unit && other.faction === faction,
    );
    const separation = new Phaser.Math.Vector2(0, 0);
    for (const other of neighbors) {
      const dx = unit.x - other.x;
      const dy = unit.y - other.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < 1) {
        separation.x += Phaser.Math.FloatBetween(-1, 1);
        separation.y += Phaser.Math.FloatBetween(-1, 1);
      } else {
        separation.x += dx / distanceSquared;
        separation.y += dy / distanceSquared;
      }
    }
    if (separation.lengthSq() > 0) {
      separation.normalize().scale(72);
      velocity.add(separation).limit(speed * 1.12);
    }

    unit.setVelocity(velocity.x, velocity.y);
    if (Math.abs(velocity.x) > 5) unit.setFlipX(velocity.x < 0);
  }
}
