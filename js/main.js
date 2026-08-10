import { MenuScene } from "./scenes/MenuScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { GAME } from "./config.js";

if (typeof Phaser === "undefined") {
  document.querySelector("#load-error").hidden = false;
  throw new Error("Phaser CDN failed to load.");
}

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME.width,
  height: GAME.height,
  backgroundColor: "#10221c",
  pixelArt: false,
  antialias: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
  scene: [MenuScene, GameScene],
};

window.lastCommandGame = new Phaser.Game(config);
