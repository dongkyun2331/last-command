export class BaseUnit extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, stats, faction) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.faction = faction;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.moveSpeed = stats.speed;
    this.damage = stats.damage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.nextAttackAt = 0;
    this.target = null;
    this.isDying = false;

    this.setDepth(10);
    this.setCollideWorldBounds(true);
    // Keep the collision footprint close to the visible torso. This gives melee
    // units room for attack effects while preventing opposing sprites from being
    // drawn on top of one another in a dense formation.
    this.body.setSize(this.width * 0.84, this.height * 0.8);
    this.body.setOffset(this.width * 0.08, this.height * 0.16);

    this.hpBack = scene.add.rectangle(x, y - 29, 32, 4, 0x101614, 0.9).setDepth(30);
    this.hpFill = scene.add.rectangle(x - 15, y - 29, 30, 2, 0x72e58d, 1)
      .setOrigin(0, 0.5)
      .setDepth(31);
    this.stateDot = scene.add.circle(x, y - 35, 2.5, 0xffffff, 0).setDepth(31);
  }

  get hpRatio() {
    return Math.max(0, this.hp / this.maxHp);
  }

  distanceTo(other) {
    return Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y);
  }

  takeDamage(amount, source) {
    if (!this.active || this.isDying) return;
    this.hp = Math.max(0, this.hp - Math.max(1, Math.round(amount)));
    this.scene.events.emit("unit-damaged", this, amount, source);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(65, () => {
      if (this.active) this.clearTint();
    });

    if (this.hp <= 0) {
      this.isDying = true;
      this.setVelocity(0, 0);
      this.scene.handleUnitDeath(this, source);
    }
  }

  setAIStateVisual(state) {
    const colors = {
      ATTACK: 0xff705c,
      RETREAT: 0xffc45c,
      PROTECT: 0x5ce6ff,
      REGROUP: 0xf8e56d,
      DEFEND: 0x8ab7ff,
      FOLLOW: 0xffffff,
    };
    this.stateDot.setFillStyle(colors[state] ?? 0xffffff, state === "FOLLOW" ? 0.22 : 0.9);
    this.stateDot.setRadius(state === "FOLLOW" ? 2 : 3.2);
  }

  updateOverlays() {
    if (!this.active) return;
    const damaged = this.hp < this.maxHp;
    this.hpBack.setPosition(this.x, this.y - 29).setVisible(damaged || this.faction === "player");
    this.hpFill
      .setPosition(this.x - 15, this.y - 29)
      .setScale(this.hpRatio, 1)
      .setFillStyle(this.hpRatio > 0.55 ? 0x72e58d : this.hpRatio > 0.28 ? 0xf0c44d : 0xff665f)
      .setVisible(damaged || this.faction === "player");
    this.stateDot.setPosition(this.x, this.y - 35);
  }

  destroy(fromScene) {
    this.hpBack?.destroy();
    this.hpFill?.destroy();
    this.stateDot?.destroy();
    super.destroy(fromScene);
  }
}
