const SCORE_RULES = Object.freeze({
  clearBonus: 5000,
  allySurvival: 650,
  playerHealth: 1500,
  allyHealth: 180,
  rescue: 450,
  timePerSecond: 25,
});

const GRADE_THRESHOLDS = Object.freeze([
  { minimum: 17000, grade: "S" },
  { minimum: 13500, grade: "A" },
  { minimum: 9500, grade: "B" },
  { minimum: 6000, grade: "C" },
  { minimum: 0, grade: "D" },
]);

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/**
 * Pure round-result calculator. It intentionally has no Phaser dependency so
 * the scoring policy can be unit-tested or replaced without changing combat,
 * scene, or persistence code.
 */
export class ScoreSystem {
  static calculate({
    victory,
    elapsedMs,
    player,
    allies,
    startingAllyCount = 0,
    rescued = 0,
    stage,
  }) {
    const activeAllies = allies.filter((ally) => ally.active && ally.hp > 0);
    const playerHealthRatio = clamp01(player.hp / player.maxHp);
    const allyHealthRatios = activeAllies.map((ally) => clamp01(ally.hp / ally.maxHp));
    const allyHealthTotal = allyHealthRatios.reduce((sum, ratio) => sum + ratio, 0);
    const elapsedSeconds = Math.max(0, Math.ceil(elapsedMs / 1000));
    const parTimeSec = Math.max(1, stage.parTimeSec ?? 240);
    const participants = Math.max(startingAllyCount + rescued, activeAllies.length);

    const breakdown = {
      clear: victory ? SCORE_RULES.clearBonus : 0,
      survival: activeAllies.length * SCORE_RULES.allySurvival,
      health: Math.round(playerHealthRatio * SCORE_RULES.playerHealth)
        + Math.round(allyHealthTotal * SCORE_RULES.allyHealth),
      time: victory
        ? Math.max(0, parTimeSec - elapsedSeconds) * SCORE_RULES.timePerSecond
        : 0,
      rescue: rescued * SCORE_RULES.rescue,
    };
    const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const grade = GRADE_THRESHOLDS.find((threshold) => total >= threshold.minimum).grade;

    return {
      victory,
      total,
      grade,
      breakdown,
      stats: {
        aliveAllies: activeAllies.length,
        participants,
        fallenAllies: Math.max(0, participants - activeAllies.length),
        playerHpPercent: Math.round(playerHealthRatio * 100),
        averageAllyHpPercent: activeAllies.length
          ? Math.round((allyHealthTotal / activeAllies.length) * 100)
          : 0,
        elapsedSeconds,
        parTimeSec,
        rescued,
      },
    };
  }

  static formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  static formatScore(score) {
    return Math.max(0, Math.round(score)).toLocaleString("en-US");
  }
}
