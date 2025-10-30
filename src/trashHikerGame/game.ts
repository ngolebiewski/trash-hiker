import {
  Application,
  Assets,
  Sprite,
  Text,
  TextStyle,
  AnimatedSprite,
  Texture,
  Container,
  Rectangle,
} from "pixi.js";

let app: Application | null = null;

interface KeyState {
  [key: string]: boolean;
}

const keys: KeyState = {};

interface TilemapData {
  layers: Array<{
    data: number[];
    name: string;
    width: number;
    height: number;
  }>;
  tilewidth: number;
  tileheight: number;
  width: number;
  height: number;
}

export async function initGame(container: HTMLDivElement) {
  if (app) return; // already running

  app = new Application();
  await app.init({
    width: 800,
    height: 600,
    backgroundColor: 0x222222,
    antialias: false,
    resolution: 1,
    preference: "webgpu",
    autoStart: true,
    sharedTicker: false,
    resizeTo: window,
  });

  container.appendChild(app.canvas);

  app.canvas.style.imageRendering = "pixelated";
  app.canvas.style.imageRendering = "crisp-edges";

  await Assets.load({
    alias: "DepartureMono",
    src: "/fonts/DepartureMono-Regular.woff2",
  });

  showTitleScreen();
}

function showTitleScreen() {
  if (!app) return;

  app.stage.removeChildren();

  Assets.load("/sprites/trash-hiker-2.json").then((atlas) => {
    if (!app) return;

    const titleTexture = atlas.textures["trash-hiker-2.aseprite"];

    const title = new Sprite(titleTexture);
    title.anchor.set(0.5);
    title.x = app.screen.width / 2;
    title.y = app.screen.height / 2;

    titleTexture.source.scaleMode = "nearest";
    title.scale.set(2);

    app.stage.addChild(title);

    const style = new TextStyle({
      fontFamily: "DepartureMono",
      fontSize: 48,
      fill: 0xffffff,
    });
    style.fontStyle = "normal";
    style.fontWeight = "normal";

    const startButton = new Text({
      text: "START",
      style: style,
    });

    startButton.anchor.set(0.5);
    startButton.x = app.screen.width / 2;
    startButton.y = app.screen.height * 0.9;

    startButton.roundPixels = true;

    startButton.eventMode = "static";
    startButton.cursor = "pointer";

    startButton.on("pointerover", () => {
      startButton.scale.set(1.1);
    });

    startButton.on("pointerout", () => {
      startButton.scale.set(1);
    });

    startButton.on("pointertap", () => {
      startLevel();
    });

    app.stage.addChild(startButton);
  });
}

async function startLevel() {
  if (!app) return;

  app.stage.removeChildren();
  app.renderer.background.color = 0x2d5016;

  // Load tilemap and tileset image
  const tilemapData = await fetch("/tilemaps/level1.json").then((r) => r.json()) as TilemapData;
  
  // Load the tileset as a single image
  const tilesetTexture = await Assets.load("/sprites/water_bottle.png");
  tilesetTexture.source.scaleMode = "nearest";

  // Render constants
  const TILE_SIZE = 32;
  const SCALE = 2;
  const TILESET_COLUMNS = 10; // 320px ÷ 32px = 10 tiles wide

  // Create container for the world (this will move with camera)
  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  // Camera settings
  const mapWidth = tilemapData.width * TILE_SIZE * SCALE;
  const mapHeight = tilemapData.height * TILE_SIZE * SCALE;

  // Render tilemap layers
  const trashPositions: Array<{ x: number; y: number; tileId: number; sprite: Sprite }> = [];

  tilemapData.layers.forEach((layer) => {
    const layerContainer = new Container();
    
    for (let i = 0; i < layer.data.length; i++) {
      const tileId = layer.data[i];
      if (tileId === 0) continue; // Skip empty tiles

      const x = (i % layer.width) * TILE_SIZE;
      const y = Math.floor(i / layer.width) * TILE_SIZE;

      // Handle flipped tiles (Tiled uses bit flags)
      const flippedH = !!(tileId & 0x80000000);
      const flippedV = !!(tileId & 0x40000000);
      const actualTileId = tileId & 0x1fffffff;

      // Calculate position in tileset (tile IDs start at 1)
      const tileIndex = actualTileId - 1;
      const tileX = (tileIndex % TILESET_COLUMNS) * TILE_SIZE;
      const tileY = Math.floor(tileIndex / TILESET_COLUMNS) * TILE_SIZE;

      // Create texture from tileset region
      const texture = new Texture({
        source: tilesetTexture.source,
        frame: new Rectangle(tileX, tileY, TILE_SIZE, TILE_SIZE),
      });

      const tile = new Sprite(texture);
      tile.x = x * SCALE;
      tile.y = y * SCALE;
      tile.scale.set(SCALE);
      tile.roundPixels = true; // Force integer pixel positions

      // Apply flips
      if (flippedH) tile.scale.x *= -1;
      if (flippedV) tile.scale.y *= -1;

      layerContainer.addChild(tile);

      // Track trash items
      if (layer.name === "trash") {
        trashPositions.push({ x, y, tileId: actualTileId, sprite: tile });
      }
    }

    worldContainer.addChild(layerContainer);
  });

  // Load hiker
  const hikerAtlas = await Assets.load("/sprites/hiker.json");

  const walkFrames: Texture[] = [];
  const idleFrames: Texture[] = [];
  const pickupFrames: Texture[] = [];

  for (let i = 0; i <= 6; i++) {
    const texture = hikerAtlas.textures[`hiker ${i}.aseprite`];
    texture.source.scaleMode = "nearest";
    walkFrames.push(texture);
  }

  for (let i = 7; i <= 8; i++) {
    const texture = hikerAtlas.textures[`hiker ${i}.aseprite`];
    texture.source.scaleMode = "nearest";
    idleFrames.push(texture);
  }

  for (let i = 9; i <= 13; i++) {
    const texture = hikerAtlas.textures[`hiker ${i}.aseprite`];
    texture.source.scaleMode = "nearest";
    pickupFrames.push(texture);
  }
  for (let i = 12; i >= 10; i--) {
    const texture = hikerAtlas.textures[`hiker ${i}.aseprite`];
    pickupFrames.push(texture);
  }

  const hiker = new AnimatedSprite(idleFrames);
  hiker.anchor.set(0.5);
  hiker.x = app.screen.width / 2;
  hiker.y = app.screen.height / 2;
  hiker.scale.set(3);
  hiker.animationSpeed = 0.017;
  hiker.roundPixels = true; // Force integer pixel positions
  hiker.play();

  worldContainer.addChild(hiker);

  // Hiker's actual position in world coordinates
  let hikerWorldX = 100;
  let hikerWorldY = 100;

  // Game state
  let isPickingUp = false;
  let collectedTrash = 0;
  const moveSpeed = 3;
  const PICKUP_RANGE = 50;

  // Trash counter
  const counterStyle = new TextStyle({
    fontFamily: "DepartureMono",
    fontSize: 24,
    fill: 0xffffff,
  });

  const trashCounter = new Text({
    text: `Trash: ${collectedTrash}/${trashPositions.length}`,
    style: counterStyle,
  });
  trashCounter.x = 10;
  trashCounter.y = 10;
  trashCounter.roundPixels = true;
  app.stage.addChild(trashCounter);

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === " " && !isPickingUp) {
      // Check if near trash
      const nearbyTrash = trashPositions.find((trash) => {
        if (!trash.sprite.visible) return false;
        const dx = trash.x * SCALE + (TILE_SIZE * SCALE) / 2 - hikerWorldX;
        const dy = trash.y * SCALE + (TILE_SIZE * SCALE) / 2 - hikerWorldY;
        return Math.sqrt(dx * dx + dy * dy) < PICKUP_RANGE;
      });

      if (nearbyTrash) {
        isPickingUp = true;
        hiker.textures = pickupFrames;
        hiker.loop = false;
        hiker.animationSpeed = 0.4; // Faster pickup
        hiker.gotoAndPlay(0);
        hiker.onComplete = () => {
          isPickingUp = false;
          hiker.loop = true;
          hiker.animationSpeed = 0.017;
          hiker.textures = idleFrames;
          hiker.play();

          // Collect the trash
          if (nearbyTrash) {
            nearbyTrash.sprite.visible = false;
            collectedTrash++;
            trashCounter.text = `Trash: ${collectedTrash}/${trashPositions.length}`;
          }
        };
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // Touch controls
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

  let lastTap = 0;
  app.canvas.addEventListener("touchend", () => {
    const now = Date.now();
    if (now - lastTap < 300 && !isPickingUp) {
      const nearbyTrash = trashPositions.find((trash) => {
        if (!trash.sprite.visible) return false;
        const dx = trash.x * SCALE + (TILE_SIZE * SCALE) / 2 - hikerWorldX;
        const dy = trash.y * SCALE + (TILE_SIZE * SCALE) / 2 - hikerWorldY;
        return Math.sqrt(dx * dx + dy * dy) < PICKUP_RANGE;
      });

      if (nearbyTrash) {
        isPickingUp = true;
        hiker.textures = pickupFrames;
        hiker.loop = false;
        hiker.animationSpeed = 0.4; // Faster pickup
        hiker.gotoAndPlay(0);
        hiker.onComplete = () => {
          hiker.animationSpeed = 0.017;
          isPickingUp = false;
          hiker.loop = true;
          hiker.textures = idleFrames;
          hiker.play();

          if (nearbyTrash) {
            nearbyTrash.sprite.visible = false;
            collectedTrash++;
            trashCounter.text = `Trash: ${collectedTrash}/${trashPositions.length}`;
          }
        };
      }
    }
    lastTap = now;
  });

  // Game loop
  app.ticker.add(() => {
    if (!hiker || isPickingUp) return;

    let isMoving = false;

    if (keys["w"] || keys["arrowup"]) {
      hikerWorldY -= moveSpeed;
      isMoving = true;
    }
    if (keys["s"] || keys["arrowdown"]) {
      hikerWorldY += moveSpeed;
      isMoving = true;
    }
    if (keys["a"] || keys["arrowleft"]) {
      hikerWorldX -= moveSpeed;
      hiker.scale.x = Math.abs(hiker.scale.x);
      isMoving = true;
    }
    if (keys["d"] || keys["arrowright"]) {
      hikerWorldX += moveSpeed;
      hiker.scale.x = -Math.abs(hiker.scale.x);
      isMoving = true;
    }

    // Keep hiker in bounds
    hikerWorldX = Math.max(0, Math.min(mapWidth, hikerWorldX));
    hikerWorldY = Math.max(0, Math.min(mapHeight, hikerWorldY));

    // Update hiker position
    hiker.x = hikerWorldX;
    hiker.y = hikerWorldY;

    // Camera follows hiker (center on screen)
    if (app) {
      worldContainer.x = Math.round(app.screen.width / 2 - hikerWorldX);
      worldContainer.y = Math.round(app.screen.height / 2 - hikerWorldY);
    }

    // Clamp camera so we don't show outside the map
    if (app) {
      worldContainer.x = Math.min(0, Math.max(app.screen.width - mapWidth, worldContainer.x));
      worldContainer.y = Math.min(0, Math.max(app.screen.height - mapHeight, worldContainer.y));
    }

    if (isMoving && hiker.textures !== walkFrames) {
      hiker.textures = walkFrames;
      hiker.animationSpeed = 0.15;
      hiker.loop = true;
      hiker.play();
    } else if (!isMoving && hiker.textures !== idleFrames) {
      hiker.animationSpeed = 0.017;
      hiker.textures = idleFrames;
      hiker.loop = true;
      hiker.play();
    }
  });
}

export function destroyGame() {
  if (app) {
    app.destroy(true, true);
    app = null;
  }
}