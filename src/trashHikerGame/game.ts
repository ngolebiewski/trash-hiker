import {
  Application,
  Assets,
  Sprite,
  Text,
  TextStyle,
  AnimatedSprite,
  Texture,
} from "pixi.js";

let app: Application | null = null;

interface KeyState {
  [key: string]: boolean;
}

const keys: KeyState = {};

export async function initGame(container: HTMLDivElement) {
  if (app) return; // already running

  app = new Application();
  await app.init({
    // Rendering options
    width: 800, // Canvas width
    height: 600, // Canvas height
    backgroundColor: 0x222222, // Background color
    antialias: false, // Disable antialiasing for pixel art
    resolution: 1, // Use 1 for pixel-perfect rendering -- as opposed to DPR?
    preference: "webgpu", // 'webgl' or 'webgpu' -- GPU sounds cooler
    // Plugin options
    autoStart: true, // Start ticker automatically
    sharedTicker: false, // Use dedicated ticker
    resizeTo: window, // Auto-resize target
  });

  container.appendChild(app.canvas);

  // Set CSS to prevent image smoothing ***SUPER IMPORTANT FOR PIXEL ART!!!***
  app.canvas.style.imageRendering = "pixelated";
  app.canvas.style.imageRendering = "crisp-edges";

  // Load the custom font -- Preloaded in the CSS. Doesn't work if initialized here in Pixi... Weird bug
  await Assets.load({
    alias: "DepartureMono",
    src: "/fonts/DepartureMono-Regular.woff2",
  });

  showTitleScreen();
}

function showTitleScreen() {
  if (!app) return;

  // Clear stage
  app.stage.removeChildren();

  // Load the Aseprite atlas (JSON will reference the PNG)
  Assets.load("/sprites/trash-hiker-2.json").then((atlas) => {
    if (!app) return;

    // The frame name must match the JSON key exactly
    const titleTexture = atlas.textures["trash-hiker-2.aseprite"];

    const title = new Sprite(titleTexture);
    title.anchor.set(0.5);
    title.x = app.screen.width / 2;
    title.y = app.screen.height / 2;

    // Set texture to use nearest neighbor scaling (no blur)
    titleTexture.source.scaleMode = "nearest";

    // Double the size
    title.scale.set(2);

    app.stage.addChild(title);

    // Create start button text
    const style = new TextStyle({
      fontFamily: "DepartureMono",
      fontSize: 48,
      fill: 0xffffff,
    });

    const startButton = new Text({
      text: "START",
      style: style,
    });

    startButton.anchor.set(0.5);
    startButton.x = app.screen.width / 2;
    startButton.y = app.screen.height * 0.9;

    // Make it interactive
    startButton.eventMode = "static";
    startButton.cursor = "pointer";

    // Add hover effect
    startButton.on("pointerover", () => {
      startButton.scale.set(1.1);
    });

    startButton.on("pointerout", () => {
      startButton.scale.set(1);
    });

    // Start game on click
    startButton.on("pointertap", () => {
      startLevel();
    });

    app.stage.addChild(startButton);
  });
}

function startLevel() {
  if (!app) return;

  // Clear stage
  app.stage.removeChildren();

  // Change background to dark green
  app.renderer.background.color = 0x2d5016;

  // Load the hiker sprite
  Assets.load("/sprites/hiker.json").then((atlas) => {
    if (!app) return;

    // Create animations
    const walkFrames: Texture[] = [];
    const idleFrames: Texture[] = [];
    const pickupFrames: Texture[] = [];

    // Walk animation (frames 0-6)
    for (let i = 0; i <= 6; i++) {
      const texture = atlas.textures[`hiker ${i}.aseprite`];
      texture.source.scaleMode = "nearest";
      walkFrames.push(texture);
    }

    // Idle animation (frames 7-8)
    for (let i = 7; i <= 8; i++) {
      const texture = atlas.textures[`hiker ${i}.aseprite`];
      texture.source.scaleMode = "nearest";
      idleFrames.push(texture);
    }

    // Pickup animation (frames 9-13) with pingpong
    for (let i = 9; i <= 13; i++) {
      const texture = atlas.textures[`hiker ${i}.aseprite`];
      texture.source.scaleMode = "nearest";
      pickupFrames.push(texture);
    }
    // Add reverse frames for pingpong effect (12 back to 10, not 9)
    for (let i = 12; i >= 10; i--) {
      const texture = atlas.textures[`hiker ${i}.aseprite`];
      pickupFrames.push(texture);
    }

    console.log("Pickup frames created:", pickupFrames.length);

    // Create the animated sprite starting with idle
    const hiker = new AnimatedSprite(idleFrames);
    hiker.anchor.set(0.5);
    hiker.x = app.screen.width / 2;
    hiker.y = app.screen.height / 2;
    hiker.scale.set(3);
    hiker.animationSpeed = 0.03;
    hiker.play();

    app.stage.addChild(hiker);

    // Player state
    let isPickingUp = false;
    const moveSpeed = 3;

    // Keyboard controls
    window.addEventListener("keydown", (e) => {
      keys[e.key.toLowerCase()] = true;

      // Spacebar for pickup
      if (e.key === " " && !isPickingUp) {
        console.log("Pickup triggered, frames:", pickupFrames.length);
        isPickingUp = true;
        hiker.textures = pickupFrames;
        hiker.loop = false;
        hiker.animationSpeed = 0.2; // Much slower
        hiker.gotoAndPlay(0);
        hiker.onComplete = () => {
          console.log("Pickup complete");
          isPickingUp = false;
          hiker.loop = true;
          hiker.textures = idleFrames;
          hiker.play();
        };
      }
    });

    window.addEventListener("keyup", (e) => {
      keys[e.key.toLowerCase()] = false;
    });

    // Touch/pointer controls for mobile
    let touchStartX = 0;
    let touchStartY = 0;

    app.canvas.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });

    app.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        keys["a"] = deltaX < -20;
        keys["d"] = deltaX > 20;
      } else {
        keys["w"] = deltaY < -20;
        keys["s"] = deltaY > 20;
      }

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });

    app.canvas.addEventListener("touchend", () => {
      keys["w"] = false;
      keys["a"] = false;
      keys["s"] = false;
      keys["d"] = false;
    });

    // Tap for pickup
    let lastTap = 0;
    app.canvas.addEventListener("touchend", (e) => {
      console.log(e);
      const now = Date.now();
      if (now - lastTap < 300 && !isPickingUp) {
        console.log("Touch pickup triggered");
        isPickingUp = true;
        hiker.textures = pickupFrames;
        hiker.loop = false;
        hiker.animationSpeed = 0.05;
        hiker.gotoAndPlay(0);
        hiker.onComplete = () => {
          console.log("Touch pickup complete");
          hiker.animationSpeed = 0.03;
          isPickingUp = false;
          hiker.loop = true;
          hiker.textures = idleFrames;
          hiker.play();
        };
      }
      lastTap = now;
    });

    // Game loop
    app.ticker.add(() => {
      if (!hiker || isPickingUp) return;

      let isMoving = false;

      // WASD/Arrow movement
      if (keys["w"] || keys["arrowup"]) {
        hiker.y -= moveSpeed;
        isMoving = true;
      }
      if (keys["s"] || keys["arrowdown"]) {
        hiker.y += moveSpeed;
        isMoving = true;
      }
      if (keys["a"] || keys["arrowleft"]) {
        hiker.x -= moveSpeed;
        hiker.scale.x = Math.abs(hiker.scale.x);
        isMoving = true;
      }
      if (keys["d"] || keys["arrowright"]) {
        hiker.x += moveSpeed;
        hiker.scale.x = -Math.abs(hiker.scale.x);
        isMoving = true;
      }

      // Switch between walk and idle
      if (isMoving && hiker.textures !== walkFrames) {
        hiker.textures = walkFrames;
        hiker.loop = true;
        hiker.play();
      } else if (!isMoving && hiker.textures !== idleFrames) {
        hiker.animationSpeed = 0.03;
        hiker.textures = idleFrames;
        hiker.loop = true;
        hiker.play();
      }
    });
  });
}

export function destroyGame() {
  if (app) {
    app.destroy(true, true);
    app = null;
  }
}
