/**
 * THE DARK LABYRINTH - 3D Horror Survival Game
 * Visible Chest Impale, Lift Up, Neck Snap & Rapid Drop Execution Cinematic
 */

// Global State & Settings
const GAME_STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    DYING: 'DYING',
    VICTORY_CINEMATIC: 'VICTORY_CINEMATIC',
    GAMEOVER: 'GAMEOVER',
    VICTORY: 'VICTORY'
};

let currentState = GAME_STATE.MENU;
let mazeGrid = [];
const MAZE_SIZE = 25;
const CELL_SIZE = 5;
const WALL_HEIGHT = 4.5;
let isMobile = false;

// Scene, Camera, Renderer
let scene, camera, renderer;
let flashlightLight, flashlightTarget, flashlightMeshGroup, flashFillLight;
let minimapCanvas, minimapCtx;
let clock;
let bobTimer = 0;

// Game Objects
let mazeWalls = [];
let keyObject = null;
let exitDoorObject = null;
let houseGroup = null;
let endingMonsterMesh = null;
let hasKey = false;
let validPathsList = [];

// Player Properties
const player = {
    position: new THREE.Vector3(CELL_SIZE * 1.5, 1.6, CELL_SIZE * 1.5),
    velocity: new THREE.Vector3(),
    rotation: { yaw: 0, pitch: 0, roll: 0 },
    height: 1.6,
    radius: 0.6,
    speed: 4.2,
    sprintSpeed: 7.2,
    stamina: 100,
    maxStamina: 100,
    isSprinting: false,
    flashlightOn: true
};

// Input State
const keys = { w: false, a: false, s: false, d: false, shift: false };
let isPointerLocked = false;
let startTime = 0;
let elapsedTime = 0;
let deathTimer = 0;
let deathPhase = 0;
let cinematicTimer = 0;

// Touch State
let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
let lookTouchId = null;
let lastLookPos = { x: 0, y: 0 };

// Monster AI Properties with Dynamic BFS Pathfinding & Independent Claws
const monsterAI = {
    mesh: null,
    leftClawsGroup: null,
    rightClawsGroup: null,
    leftClaws: [],
    rightClaws: [],
    position: new THREE.Vector3(),
    state: 'PATROL',
    speed: 3.0,
    chaseSpeed: 5.8,
    currentTargetSpot: null,
    eyesLight: null,
    detectionRadius: 32,
    catchDistance: 1.8,
    radius: 0.7,
    searchTimer: 0,
    chaseMemoryTimer: 0,
    lastSeenPlayerPos: new THREE.Vector3()
};

let pathRecalcTimer = 0;
let currentPathWaypoints = [];

// UI Elements Container
let ui = {};

// Audio System
let audioCtx = null;
let lastHeartbeatTime = 0;
let ambientOsc1 = null;
let ambientOsc2 = null;
let ambientGain = null;

/* ===== INITIALIZATION ===== */
window.addEventListener('DOMContentLoaded', () => {
    detectDevice();
    initUIElements();
    initThreeJS();
    initMinimap();
    initEventListeners();
    if (isMobile) initTouchControls();
});

window.startGame = startGame;
window.resumeGame = resumeGame;
window.toggleFlashlight = toggleFlashlight;

function detectDevice() {
    isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.body.classList.add('is-mobile');
    }
}

function initUIElements() {
    ui = {
        startMenu: document.getElementById('start-menu'),
        pauseMenu: document.getElementById('pause-menu'),
        gameOverScreen: document.getElementById('game-over-screen'),
        victoryScreen: document.getElementById('victory-screen'),
        hud: document.getElementById('hud'),
        objectiveBanner: document.getElementById('objective-banner'),
        interactionPrompt: document.getElementById('interaction-prompt'),
        interactionText: document.getElementById('interaction-text'),
        crosshair: document.getElementById('crosshair'),
        keyText: document.getElementById('key-text'),
        flashlightToggleBtn: document.getElementById('flashlight-toggle-btn'),
        flashlightStatusText: document.getElementById('flashlight-status-text'),
        staminaBar: document.getElementById('stamina-bar'),
        heartbeatIndicator: document.getElementById('heartbeat-indicator'),
        dangerText: document.getElementById('danger-text'),
        dangerVignette: document.getElementById('danger-vignette'),
        bloodVignette: document.getElementById('blood-vignette'),
        lightningFlash: document.getElementById('lightning-flash'),
        statTime: document.getElementById('stat-time'),
        touchControls: document.getElementById('touch-controls')
    };
}

function initThreeJS() {
    try {
        const container = document.getElementById('canvas-container');
        if (!container) return;
        
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020305, 0.095);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150);
        camera.position.copy(player.position);
        scene.add(camera);

        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        const ambientLight = new THREE.AmbientLight(0x05070a, 0.18);
        scene.add(ambientLight);

        buildRealisticYellowFlashlight();

        window.addEventListener('resize', onWindowResize);
        renderer.render(scene, camera);
    } catch(e) {
        console.error("ThreeJS Init Error:", e);
    }
}

function initMinimap() {
    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
        minimapCtx = minimapCanvas.getContext('2d');
    }
}

/* ===== MOBILE / TABLET TOUCH CONTROLS ===== */
function initTouchControls() {
    const joystickContainer = document.getElementById('joystick-container');
    const joystickKnob = document.getElementById('joystick-knob');
    if (!joystickContainer || !joystickKnob) return;

    joystickContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;
        const rect = joystickContainer.getBoundingClientRect();
        joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        updateJoystick(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) {
                e.preventDefault();
                updateJoystick(touch.clientX, touch.clientY);
            } else if (touch.identifier === lookTouchId && currentState === GAME_STATE.PLAYING) {
                const deltaX = touch.clientX - lastLookPos.x;
                const deltaY = touch.clientY - lastLookPos.y;
                lastLookPos = { x: touch.clientX, y: touch.clientY };

                const sensitivity = 0.004;
                player.rotation.yaw -= deltaX * sensitivity;
                player.rotation.pitch -= deltaY * sensitivity;
                player.rotation.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, player.rotation.pitch));
                updateCameraRotation();
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) {
                joystickTouchId = null;
                resetJoystick();
            } else if (touch.identifier === lookTouchId) {
                lookTouchId = null;
            }
        }
    });

    window.addEventListener('touchstart', (e) => {
        if (currentState !== GAME_STATE.PLAYING) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.clientX > window.innerWidth / 3 && lookTouchId === null) {
                const targetEl = e.target;
                if (!targetEl.closest('#touch-action-buttons') && !targetEl.closest('#hud-card')) {
                    lookTouchId = touch.identifier;
                    lastLookPos = { x: touch.clientX, y: touch.clientY };
                }
            }
        }
    }, { passive: false });

    const sprintBtn = document.getElementById('touch-sprint-btn');
    if (sprintBtn) {
        sprintBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys.shift = true;
            sprintBtn.classList.add('active');
        }, { passive: false });
        sprintBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys.shift = false;
            sprintBtn.classList.remove('active');
        }, { passive: false });
    }

    const flashlightBtn = document.getElementById('touch-flashlight-btn');
    if (flashlightBtn) {
        flashlightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleFlashlight();
        }, { passive: false });
    }

    const interactBtn = document.getElementById('touch-interact-btn');
    if (interactBtn) {
        interactBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            interact();
        }, { passive: false });
    }
}

function updateJoystick(clientX, clientY) {
    const maxRadius = 45;
    let dx = clientX - joystickCenter.x;
    let dy = clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
    }

    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;

    const normX = dx / maxRadius;
    const normY = dy / maxRadius;
    const threshold = 0.25;

    keys.w = normY < -threshold;
    keys.s = normY > threshold;
    keys.a = normX < -threshold;
    keys.d = normX > threshold;
}

function resetJoystick() {
    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = `translate(0px, 0px)`;
    keys.w = false;
    keys.s = false;
    keys.a = false;
    keys.d = false;
}

/* ===== REALISTIC YELLOW FLASHLIGHT ===== */
function buildRealisticYellowFlashlight() {
    flashlightMeshGroup = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.42, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1a202a,
        metalness: 0.85,
        roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;

    flashlightMeshGroup.add(body);
    flashlightMeshGroup.position.set(0.32, -0.28, -0.5);
    camera.add(flashlightMeshGroup);

    flashFillLight = new THREE.PointLight(0xffd566, 1.8, 2.5);
    flashFillLight.position.set(0.25, -0.15, -0.3);
    camera.add(flashFillLight);

    flashlightLight = new THREE.SpotLight(0xffd566, 4.6, 38, Math.PI / 5.2, 0.95, 1.2);
    flashlightLight.castShadow = true;
    flashlightLight.shadow.mapSize.width = 1024;
    flashlightLight.shadow.mapSize.height = 1024;

    flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, 0, -6);
    camera.add(flashlightTarget);

    flashlightLight.target = flashlightTarget;
    flashlightLight.position.set(0.32, -0.28, -0.5);
    camera.add(flashlightLight);
}

/* ===== RICH HIGH-CONTRAST PROCEDURAL TEXTURES ===== */
function createWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e2430';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#0a0d14';
    ctx.lineWidth = 6;
    const rows = 16;
    const cols = 8;
    const rh = 512 / rows;
    const cw = 512 / cols;

    for (let r = 0; r < rows; r++) {
        const y = r * rh;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        const offset = (r % 2) * (cw / 2);
        for (let c = 0; c < cols + 1; c++) {
            const x = c * cw - offset;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + rh);
            ctx.stroke();
        }
    }

    for (let i = 0; i < 35000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const v = Math.floor(Math.random() * 55);
        ctx.fillStyle = `rgba(${v}, ${v + 5}, ${v + 15}, 0.35)`;
        ctx.fillRect(x, y, 3, 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#141824';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#080a10';
    ctx.lineWidth = 5;
    const tileSize = 64;

    for (let x = 0; x <= 512; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, x);
        ctx.lineTo(512, x);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createWoodFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#5a341a';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#2b1608';
    ctx.lineWidth = 6;
    const plankH = 64;

    for (let y = 0; y <= 512; y += plankH) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        const row = y / plankH;
        const offset = (row % 2) * 128;
        for (let x = offset; x <= 512; x += 256) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + plankH);
            ctx.stroke();
        }
    }

    ctx.strokeStyle = 'rgba(30, 12, 2, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 12) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.bezierCurveTo(150, i + 8, 350, i - 8, 512, i);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createHouseWallpaperTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#3a2d24';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#4e3d31';
    ctx.lineWidth = 4;
    const tileSize = 64;

    for (let x = 0; x < 512; x += tileSize) {
        for (let y = 0; y < 512; y += tileSize) {
            ctx.strokeRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
            ctx.fillStyle = '#5c483a';
            ctx.beginPath();
            ctx.arc(x + tileSize / 2, y + tileSize / 2, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

/* ===== MAZE GENERATION ===== */
function generateMazeGrid(size) {
    const grid = Array.from({ length: size }, () => Array(size).fill(1));

    function walk(r, c) {
        grid[r][c] = 0;
        const dirs = [
            [-2, 0], [2, 0], [0, -2], [0, 2]
        ].sort(() => Math.random() - 0.5);

        for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && grid[nr][nc] === 1) {
                grid[r + dr / 2][c + dc / 2] = 0;
                walk(nr, nc);
            }
        }
    }

    walk(1, 1);
    return grid;
}

/* ===== BUILD MAZE WORLD ===== */
function buildMazeWorld() {
    mazeWalls.forEach(w => scene.remove(w));
    if (keyObject) scene.remove(keyObject.mesh);
    if (exitDoorObject) scene.remove(exitDoorObject.mesh);
    if (houseGroup) scene.remove(houseGroup);
    if (monsterAI.mesh) scene.remove(monsterAI.mesh);

    mazeWalls = [];
    validPathsList = [];
    hasKey = false;
    currentPathWaypoints = [];
    pathRecalcTimer = 0;

    mazeGrid = generateMazeGrid(MAZE_SIZE);

    const wallTex = createWallTexture();
    wallTex.repeat.set(1, 1);
    const floorTex = createFloorTexture();
    floorTex.repeat.set(MAZE_SIZE * 2, MAZE_SIZE * 2);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, metalness: 0.15 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.1 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.98 });

    const totalSize = MAZE_SIZE * CELL_SIZE;
    const floorGeo = new THREE.PlaneGeometry(totalSize, totalSize);

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(totalSize / 2, 0, totalSize / 2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const ceilingMesh = new THREE.Mesh(floorGeo, ceilingMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(totalSize / 2, WALL_HEIGHT, totalSize / 2);
    scene.add(ceilingMesh);

    const wallGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);

    for (let r = 0; r < MAZE_SIZE; r++) {
        for (let c = 0; c < MAZE_SIZE; c++) {
            const x = c * CELL_SIZE + CELL_SIZE / 2;
            const z = r * CELL_SIZE + CELL_SIZE / 2;

            if (mazeGrid[r][c] === 1) {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x, WALL_HEIGHT / 2, z);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                mazeWalls.push(wall);
            } else {
                validPathsList.push({ r, c, x, z });
            }
        }
    }

    const startX = CELL_SIZE * 1.5;
    const startZ = CELL_SIZE * 1.5;

    validPathsList.sort((a, b) => {
        const distA = Math.hypot(a.x - startX, a.z - startZ);
        const distB = Math.hypot(b.x - startX, b.z - startZ);
        return distA - distB;
    });

    const keySpot = validPathsList[Math.floor(validPathsList.length * 0.85)];
    createFloatingKey(keySpot.x, keySpot.z);

    const exitSpot = validPathsList[validPathsList.length - 1];
    
    createExitDoor(exitSpot.x, exitSpot.z);
    buildCozyEndingHouse(exitSpot.x, exitSpot.z + 16.0);

    const monsterSpot = validPathsList.find(spot => {
        const dist = Math.hypot(spot.x - startX, spot.z - startZ);
        return dist >= 30.0 && dist <= 50.0;
    }) || validPathsList[Math.floor(validPathsList.length * 0.5)];

    spawnMonster(monsterSpot.x, monsterSpot.z, validPathsList);

    player.position.set(startX, player.height, startZ);
    player.rotation.yaw = 0;
    player.rotation.pitch = 0;
    player.rotation.roll = 0;
    player.stamina = player.maxStamina;
    player.flashlightOn = true;

    if (flashlightLight) flashlightLight.intensity = 4.6;
    if (flashFillLight) flashFillLight.intensity = 1.8;
    if (flashlightMeshGroup) flashlightMeshGroup.visible = true;

    updateHUD();
}

/* ===== COZY HOUSE WITH WOOD FLOOR, WALLPAPER & GIANT BACK WINDOW ===== */
function buildCozyEndingHouse(hx, hz) {
    houseGroup = new THREE.Group();

    const grassGeo = new THREE.PlaneGeometry(80, 80);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x0e2415, roughness: 0.95 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(hx, 0, hz - 8);
    houseGroup.add(grass);

    const woodTex = createWoodFloorTexture();
    woodTex.repeat.set(3, 4);
    const wallpaperTex = createHouseWallpaperTexture();
    wallpaperTex.repeat.set(2, 2);

    const houseWallMat = new THREE.MeshStandardMaterial({ map: wallpaperTex, roughness: 0.7 });
    const floorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.35, metalness: 0.1 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 });

    const houseFloor = new THREE.Mesh(new THREE.PlaneGeometry(12, 16), floorMat);
    houseFloor.rotation.x = -Math.PI / 2;
    houseFloor.position.set(hx, 0.02, hz + 8);
    houseFloor.receiveShadow = true;
    houseGroup.add(houseFloor);

    const houseCeiling = new THREE.Mesh(new THREE.PlaneGeometry(12, 16), ceilingMat);
    houseCeiling.rotation.x = Math.PI / 2;
    houseCeiling.position.set(hx, WALL_HEIGHT, hz + 8);
    houseGroup.add(houseCeiling);

    const frontWallL = new THREE.Mesh(new THREE.BoxGeometry(4.6, WALL_HEIGHT, 0.3), houseWallMat);
    frontWallL.position.set(hx - 3.7, WALL_HEIGHT / 2, hz);
    const frontWallR = new THREE.Mesh(new THREE.BoxGeometry(4.6, WALL_HEIGHT, 0.3), houseWallMat);
    frontWallR.position.set(hx + 3.7, WALL_HEIGHT / 2, hz);
    const frontWallTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 0.3), houseWallMat);
    frontWallTop.position.set(hx, WALL_HEIGHT - 0.6, hz);
    houseGroup.add(frontWallL, frontWallR, frontWallTop);

    const porchLight = new THREE.PointLight(0xffaa44, 4.5, 15);
    porchLight.position.set(hx, 3.2, hz - 0.5);
    houseGroup.add(porchLight);

    const backWallL = new THREE.Mesh(new THREE.BoxGeometry(3.6, WALL_HEIGHT, 0.3), houseWallMat);
    backWallL.position.set(hx - 4.2, WALL_HEIGHT / 2, hz + 16);
    const backWallR = new THREE.Mesh(new THREE.BoxGeometry(3.6, WALL_HEIGHT, 0.3), houseWallMat);
    backWallR.position.set(hx + 4.2, WALL_HEIGHT / 2, hz + 16);
    const backWallTop = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.0, 0.3), houseWallMat);
    backWallTop.position.set(hx, WALL_HEIGHT - 0.5, hz + 16);
    const backWallBottom = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 0.3), houseWallMat);
    backWallBottom.position.set(hx, 0.4, hz + 16);
    houseGroup.add(backWallL, backWallR, backWallTop, backWallBottom);

    const windowPane = new THREE.Mesh(
        new THREE.PlaneGeometry(4.8, 2.7),
        new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.95 })
    );
    windowPane.position.set(hx, 2.15, hz + 16.01);
    houseGroup.add(windowPane);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, WALL_HEIGHT, 16), houseWallMat);
    leftWall.position.set(hx - 6, WALL_HEIGHT / 2, hz + 8);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, WALL_HEIGHT, 16), houseWallMat);
    rightWall.position.set(hx + 6, WALL_HEIGHT / 2, hz + 8);
    houseGroup.add(leftWall, rightWall);

    const sofaGroup = new THREE.Group();
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 1.2), sofaMat);
    seat.position.set(0, 0.25, 0);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 0.3), sofaMat);
    backrest.position.set(0, 0.8, -0.55);

    sofaGroup.add(seat, backrest);
    sofaGroup.position.set(hx, 0, hz + 6.0);
    houseGroup.add(sofaGroup);

    const warmLamp = new THREE.PointLight(0xffaa44, 4.5, 16);
    warmLamp.position.set(hx - 3.5, 2.5, hz + 6.0);
    houseGroup.add(warmLamp);

    const tableMat = new THREE.MeshStandardMaterial({ color: 0x2b1a0e, roughness: 0.5 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.0), tableMat);
    table.position.set(hx, 0.2, hz + 8.5);
    houseGroup.add(table);

    scene.add(houseGroup);
}

/* ===== REALISTIC WOODEN MAZE EXIT DOOR ===== */
function createExitDoor(x, z) {
    const group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d1a10, roughness: 0.8 });
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, WALL_HEIGHT, 0.35), frameMat);
    leftFrame.position.set(-1.3, WALL_HEIGHT / 2, 0);

    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, WALL_HEIGHT, 0.35), frameMat);
    rightFrame.position.set(1.3, WALL_HEIGHT / 2, 0);

    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 0.35), frameMat);
    topFrame.position.set(0, WALL_HEIGHT - 0.12, 0);

    group.add(leftFrame, rightFrame, topFrame);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-1.2, 0, 0);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.65, metalness: 0.1 });
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, WALL_HEIGHT * 0.9, 0.15), doorMat);
    doorMesh.position.set(1.2, WALL_HEIGHT * 0.45, 0);
    doorPivot.add(doorMesh);

    const brassMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), brassMat);
    knob.position.set(2.1, 1.2, 0.1);
    doorMesh.add(knob);

    group.add(doorPivot);

    const exitLight = new THREE.PointLight(0xffaa33, 2.5, 8);
    exitLight.position.set(0, 2.0, 0.5);
    group.add(exitLight);

    group.position.set(x, 0, z);
    scene.add(group);

    exitDoorObject = { mesh: group, doorPivot, x, z };
}

function createFloatingKey(x, z) {
    const group = new THREE.Group();

    const ringGeo = new THREE.TorusGeometry(0.3, 0.08, 16, 32);
    const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 16);
    const teethGeo = new THREE.BoxGeometry(0.2, 0.25, 0.06);

    const keyMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.95,
        roughness: 0.15,
        emissive: 0xffaa00,
        emissiveIntensity: 0.8
    });

    const ring = new THREE.Mesh(ringGeo, keyMat);
    ring.position.y = 0.45;
    const shaft = new THREE.Mesh(shaftGeo, keyMat);
    shaft.position.y = 0;
    const teeth = new THREE.Mesh(teethGeo, keyMat);
    teeth.position.set(0.12, -0.28, 0);

    group.add(ring, shaft, teeth);

    const beaconGeo = new THREE.CylinderGeometry(0.25, 0.25, WALL_HEIGHT, 16);
    const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = WALL_HEIGHT / 2 - 1.4;
    group.add(beacon);

    const keyLight = new THREE.PointLight(0xffd700, 4.5, 12);
    keyLight.position.set(0, 0.5, 0);
    group.add(keyLight);

    group.position.set(x, 1.4, z);
    scene.add(group);

    keyObject = { mesh: group, x, z, collected: false, initialY: 1.4 };
}

/* ===== MONSTER WITH INDEPENDENT 3D FLOATING CLAWS ===== */
function spawnMonster(x, z, pathNodes) {
    const group = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.6, 0.4, 3.5, 12);
    const monsterMat = new THREE.MeshStandardMaterial({
        color: 0x050508,
        roughness: 0.95,
        metalness: 0.1,
        emissive: 0x150005
    });

    const body = new THREE.Mesh(bodyGeo, monsterMat);
    body.position.y = 1.75;
    group.add(body);

    const clawMat = new THREE.MeshStandardMaterial({
        color: 0x180000,
        roughness: 0.1,
        metalness: 0.95,
        emissive: 0xaa0000
    });

    const leftClawsGroup = new THREE.Group();
    const rightClawsGroup = new THREE.Group();
    const leftClawsList = [];
    const rightClawsList = [];

    for (let i = 0; i < 4; i++) {
        const offset = (i - 1.5) * 0.12;
        const clawGeo = new THREE.ConeGeometry(0.045, 1.2, 8);
        clawGeo.rotateX(Math.PI / 2);

        const leftClaw = new THREE.Mesh(clawGeo, clawMat);
        leftClaw.position.set(offset, 0, 0);
        leftClawsGroup.add(leftClaw);
        leftClawsList.push(leftClaw);

        const rightClaw = new THREE.Mesh(clawGeo, clawMat);
        rightClaw.position.set(offset, 0, 0);
        rightClawsGroup.add(rightClaw);
        rightClawsList.push(rightClaw);
    }

    leftClawsGroup.position.set(-0.85, 1.8, 0.4);
    rightClawsGroup.position.set(0.85, 1.8, 0.4);

    group.add(leftClawsGroup, rightClawsGroup);

    const eyeGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0011 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.22, 3.0, 0.45);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.22, 3.0, 0.45);

    const redLight = new THREE.PointLight(0xff0011, 5.5, 9);
    redLight.position.set(0, 3.0, 0.55);

    group.add(leftEye, rightEye, redLight);
    group.position.set(x, 0, z);

    scene.add(group);

    monsterAI.mesh = group;
    monsterAI.leftClawsGroup = leftClawsGroup;
    monsterAI.rightClawsGroup = rightClawsGroup;
    monsterAI.leftClaws = leftClawsList;
    monsterAI.rightClaws = rightClawsList;
    monsterAI.position.copy(group.position);
    monsterAI.eyesLight = redLight;
    monsterAI.patrolPath = pathNodes;
    monsterAI.state = 'PATROL';
    monsterAI.currentTargetSpot = pathNodes[0] || { x, z };
}

/* ===== INPUTS & EVENT LISTENERS ===== */
function initEventListeners() {
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', (e) => {
            e.stopPropagation();
            startGame();
        });
    }

    const startMenu = document.getElementById('start-menu');
    if (startMenu) {
        startMenu.addEventListener('click', (e) => {
            if (currentState === GAME_STATE.MENU) startGame();
        });
    }

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', resumeGame);

    const btnRestartPause = document.getElementById('btn-restart-pause');
    if (btnRestartPause) btnRestartPause.addEventListener('click', () => { hideAllScreens(); startGame(); });

    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) btnRetry.addEventListener('click', () => { hideAllScreens(); startGame(); });

    const btnPlayAgain = document.getElementById('btn-play-again');
    if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => { hideAllScreens(); startGame(); });

    const flashlightBtn = document.getElementById('flashlight-toggle-btn');
    if (flashlightBtn) {
        flashlightBtn.addEventListener('click', toggleFlashlight);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
}

function requestPointerLock() {
    if (isMobile) return;
    try { renderer.domElement.requestPointerLock(); } catch (e) {}
}

function onPointerLockChange() {
    if (isMobile) return;
    isPointerLocked = (document.pointerLockElement === renderer.domElement);
    if (!isPointerLocked && currentState === GAME_STATE.PLAYING) {
        pauseGame();
    }
}

function onKeyDown(e) {
    if (currentState === GAME_STATE.MENU && (e.code === 'Enter' || e.code === 'Space')) {
        startGame();
        return;
    }

    if (currentState !== GAME_STATE.PLAYING) return;

    switch (e.code) {
        case 'KeyW': keys.w = true; break;
        case 'KeyA': keys.a = true; break;
        case 'KeyS': keys.s = true; break;
        case 'KeyD': keys.d = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': keys.shift = true; break;
        case 'KeyF': toggleFlashlight(); break;
        case 'KeyE': interact(); break;
        case 'Escape': pauseGame(); break;
    }
}

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': keys.w = false; break;
        case 'KeyA': keys.a = false; break;
        case 'KeyS': keys.s = false; break;
        case 'KeyD': keys.d = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': keys.shift = false; break;
    }
}

function toggleFlashlight() {
    player.flashlightOn = !player.flashlightOn;

    if (flashlightLight) flashlightLight.intensity = player.flashlightOn ? 4.6 : 0;
    if (flashFillLight) flashFillLight.intensity = player.flashlightOn ? 1.8 : 0;
    if (flashlightMeshGroup) flashlightMeshGroup.visible = player.flashlightOn;

    const statusText = document.getElementById('flashlight-status-text');
    if (statusText) {
        if (player.flashlightOn) {
            statusText.textContent = 'ENCENDIDA [F]';
            statusText.className = 'hud-value status-found';
        } else {
            statusText.textContent = 'APAGADA [F]';
            statusText.className = 'hud-value status-missing';
        }
    }

    playAudioClick();
}

function onMouseMove(e) {
    if (isMobile || currentState === GAME_STATE.DYING || currentState === GAME_STATE.VICTORY_CINEMATIC || !isPointerLocked) return;

    const sensitivity = 0.0022;

    player.rotation.yaw -= e.movementX * sensitivity;
    player.rotation.pitch -= e.movementY * sensitivity;
    player.rotation.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, player.rotation.pitch));

    updateCameraRotation();
}

function updateCameraRotation() {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = player.rotation.pitch;
    euler.y = player.rotation.yaw;
    euler.z = player.rotation.roll;
    camera.quaternion.setFromEuler(euler);
}

/* ===== BULLETPROOF GAME START ===== */
function startGame() {
    hideAllScreens();
    currentState = GAME_STATE.PLAYING;

    const hudEl = document.getElementById('hud');
    if (hudEl) {
        hudEl.classList.remove('hidden');
        hudEl.style.display = 'flex';
    }

    if (isMobile) {
        const touchControlsEl = document.getElementById('touch-controls');
        if (touchControlsEl) {
            touchControlsEl.classList.remove('hidden');
            touchControlsEl.style.display = 'block';
        }
    }

    const bloodVignetteEl = document.getElementById('blood-vignette');
    if (bloodVignetteEl) {
        bloodVignetteEl.classList.add('hidden');
        bloodVignetteEl.style.display = 'none';
        bloodVignetteEl.style.background = 'radial-gradient(circle, transparent 40%, rgba(180, 0, 20, 0.75) 100%)';
        bloodVignetteEl.style.opacity = '0';
    }

    const objectiveBannerEl = document.getElementById('objective-banner');
    if (objectiveBannerEl) objectiveBannerEl.style.display = 'block';

    try {
        initAudioContext();
        startAmbientSoundtrack();
    } catch(e) { console.warn("Audio init warning:", e); }
    try { buildMazeWorld(); } catch(e) { console.error("Maze build error:", e); }

    startTime = Date.now();
    
    if (!isMobile) {
        try {
            renderer.domElement.requestPointerLock();
        } catch(e) {}
    }

    try {
        if (clock) clock.start();
        animate();
    } catch(e) {
        console.error("Animate error:", e);
    }
}

function pauseGame() {
    if (currentState !== GAME_STATE.PLAYING) return;
    currentState = GAME_STATE.PAUSED;
    if (!isMobile) document.exitPointerLock();
    const pauseMenuEl = document.getElementById('pause-menu');
    if (pauseMenuEl) {
        pauseMenuEl.classList.remove('hidden');
        pauseMenuEl.style.display = 'flex';
    }
}

function resumeGame() {
    currentState = GAME_STATE.PLAYING;
    const pauseMenuEl = document.getElementById('pause-menu');
    if (pauseMenuEl) {
        pauseMenuEl.classList.add('hidden');
        pauseMenuEl.style.display = 'none';
    }
    if (!isMobile) requestPointerLock();
}

function hideAllScreens() {
    const screenIds = ['start-menu', 'pause-menu', 'game-over-screen', 'victory-screen'];
    screenIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });
}

/* ===== VISIBLE CHEST IMPALE, LIFT UP, NECK SNAP & RAPID DROP EXECUTION ===== */
function startDeathSequence() {
    if (currentState === GAME_STATE.DYING) return;
    currentState = GAME_STATE.DYING;
    deathTimer = 0;
    deathPhase = 0;

    playMonsterScreech();

    const bloodEl = document.getElementById('blood-vignette');
    if (bloodEl) {
        bloodEl.classList.remove('hidden');
        bloodEl.style.display = 'block';
        bloodEl.style.background = 'radial-gradient(circle, transparent 40%, rgba(180, 0, 20, 0.75) 100%)';
        bloodEl.style.opacity = '0.9';
    }
}

function updateDeathSequence(delta) {
    deathTimer += delta;

    if (!monsterAI.mesh) return;

    // Monster main body stays strictly GROUNDED on the floor (y = 0)
    monsterAI.mesh.position.y = 0;
    const monsterHeadPos = monsterAI.mesh.position.clone().add(new THREE.Vector3(0, 2.7, 0));

    // Phase 0 (0.0s - 0.25s): RAPID KNOCKDOWN onto floor (face up looking at monster)
    if (deathTimer < 0.25) {
        if (deathPhase === 0) {
            deathPhase = 1;
            playBodyThudSound();
        }
        player.position.y = Math.max(0.4, player.position.y - delta * 9.0);
        const monsterTargetPos = player.position.clone().add(new THREE.Vector3(0, 0, -1.4));
        monsterAI.mesh.position.lerp(monsterTargetPos, delta * 14.0);
        monsterAI.mesh.lookAt(player.position.x, 0.4, player.position.z);
    }
    // Phase 1 (0.25s - 1.0s): IMPALE CLAWS IN CHEST (In full view of camera!)
    else if (deathTimer < 1.0) {
        if (deathPhase === 1) {
            deathPhase = 2;
            playBodyThudSound();
        }
        if (monsterAI.rightClawsGroup) {
            monsterAI.rightClawsGroup.position.set(0, 0.3, 0.75);
            monsterAI.rightClawsGroup.rotation.x = Math.PI / 3.5;
        }
        if (monsterAI.leftClawsGroup) {
            monsterAI.leftClawsGroup.position.set(-0.85, 1.8, 0.4);
        }

        monsterAI.rightClaws.forEach((claw, i) => {
            claw.rotation.x = 0.6 + Math.sin(deathTimer * 12 + i) * 0.25;
            claw.position.z = Math.cos(deathTimer * 10 + i) * 0.12;
        });
    }
    // Phase 2 (1.0s - 2.2s): LIFT PLAYER UP BY CHEST CLAWS (Monster stays grounded)
    else if (deathTimer < 2.2) {
        if (deathPhase === 2) {
            deathPhase = 3;
            playImpactSound();
        }
        const liftProgress = (deathTimer - 1.0) / 1.2;
        player.position.y = 0.4 + liftProgress * 2.0; // Rise to y = 2.4m

        if (monsterAI.rightClawsGroup) {
            monsterAI.rightClawsGroup.position.set(0, 0.3 + liftProgress * 2.0, 0.75);
            monsterAI.rightClawsGroup.rotation.x = Math.PI / 6;
        }

        monsterAI.rightClaws.forEach((claw, i) => {
            claw.rotation.x = 0.4 + Math.sin(deathTimer * 14 + i) * 0.25;
        });
    }
    // Phase 3 (2.2s - 3.4s): SECONDARY LEFT HAND GRABS HEAD & TWISTS NECK BACKWARDS!
    else if (deathTimer < 3.4) {
        if (deathPhase === 3) {
            deathPhase = 4;
            playNeckSnapSound();
            playMonsterScreech();
        }

        player.position.y = 2.4;

        if (monsterAI.leftClawsGroup) {
            monsterAI.leftClawsGroup.position.set(-0.15, 2.55, 0.25);
            monsterAI.leftClawsGroup.rotation.x = -Math.PI / 3;
        }

        const snapProgress = (deathTimer - 2.2) / 1.2;
        player.rotation.pitch = Math.PI / 2.2 * Math.min(1.0, snapProgress * 2.5);
        player.rotation.roll = 0.75 * Math.min(1.0, snapProgress * 2.0);

        monsterAI.leftClaws.forEach((claw, i) => {
            claw.rotation.x = 0.8 + Math.sin(deathTimer * 16 + i) * 0.35;
        });
    }
    // Phase 4 (3.4s - 4.0s): FAST DROP TO FLOOR & GAME OVER!
    else if (deathTimer < 4.0) {
        if (deathPhase === 4) {
            deathPhase = 5;
            playBodyThudSound();
        }

        const dropProgress = (deathTimer - 3.4) / 0.6;
        player.position.y = Math.max(0.4, 2.4 - dropProgress * 3.5); // Rapid drop!

        if (monsterAI.rightClawsGroup) monsterAI.rightClawsGroup.position.set(0.85, 1.8, 0.4);
        if (monsterAI.leftClawsGroup) monsterAI.leftClawsGroup.position.set(-0.85, 1.8, 0.4);

        const bloodEl = document.getElementById('blood-vignette');
        if (bloodEl) bloodEl.style.opacity = `${0.9 + dropProgress * 0.1}`;
    }
    else {
        triggerGameOver();
    }

    camera.position.copy(player.position);
    if (deathTimer < 2.2) {
        camera.lookAt(monsterHeadPos);
    } else {
        updateCameraRotation();
    }
}

/* ===== CINEMATIC: WALK YARD -> ENTER HOUSE -> SIT ON SOFA FACING GIANT WINDOW -> MONSTER WINDOW ===== */
function startVictoryCinematic() {
    currentState = GAME_STATE.VICTORY_CINEMATIC;
    cinematicTimer = 0;
    if (!isMobile) document.exitPointerLock();
    const hudEl = document.getElementById('hud');
    if (hudEl) {
        hudEl.classList.add('hidden');
        hudEl.style.display = 'none';
    }
}

function updateVictoryCinematic(delta) {
    cinematicTimer += delta;

    const ex = exitDoorObject.x;
    const ez = exitDoorObject.z;

    player.rotation.yaw = 0;
    player.rotation.pitch = 0;

    if (cinematicTimer < 3.0) {
        const doorProgress = cinematicTimer / 3.0;
        if (exitDoorObject && exitDoorObject.doorPivot) {
            exitDoorObject.doorPivot.rotation.y = -Math.PI / 1.8 * doorProgress;
        }
        player.position.set(ex, 1.6, ez + doorProgress * 4.0);
    } else if (cinematicTimer < 7.5) {
        const progress = (cinematicTimer - 3.0) / 4.5;
        player.position.set(ex, 1.6, ez + 4.0 + progress * 12.0);
    } else if (cinematicTimer < 10.5) {
        const progress = (cinematicTimer - 7.5) / 3.0;
        player.position.set(ex, 1.6 - progress * 0.65, ez + 16.0 + progress * 6.0);
        player.rotation.pitch = 0.0;
    } else if (cinematicTimer < 13.5) {
        player.rotation.pitch = 0.05;
        if (monsterAI.mesh) {
            monsterAI.mesh.position.set(ex, 0, ez + 32.2);
            monsterAI.mesh.lookAt(player.position.x, 0.95, player.position.z);
        }
    } else if (cinematicTimer < 16.0) {
        const flashEl = document.getElementById('lightning-flash');
        if (cinematicTimer > 13.6 && cinematicTimer < 13.9) {
            if (flashEl) flashEl.classList.add('flash');
            playImpactSound();
        } else if (cinematicTimer > 14.8 && cinematicTimer < 15.1) {
            if (flashEl) flashEl.classList.add('flash');
            playMonsterScreech();
        } else {
            if (flashEl) flashEl.classList.remove('flash');
        }
    } else {
        triggerVictory();
    }

    camera.position.copy(player.position);
    updateCameraRotation();
}

function triggerGameOver() {
    currentState = GAME_STATE.GAMEOVER;
    if (!isMobile) document.exitPointerLock();
    const hudEl = document.getElementById('hud');
    if (hudEl) {
        hudEl.classList.add('hidden');
        hudEl.style.display = 'none';
    }
    const goEl = document.getElementById('game-over-screen');
    if (goEl) {
        goEl.classList.remove('hidden');
        goEl.style.display = 'flex';
    }
}

function triggerVictory() {
    currentState = GAME_STATE.VICTORY;
    if (!isMobile) document.exitPointerLock();
    const hudEl = document.getElementById('hud');
    if (hudEl) {
        hudEl.classList.add('hidden');
        hudEl.style.display = 'none';
    }
    const vicEl = document.getElementById('victory-screen');
    if (vicEl) {
        vicEl.classList.remove('hidden');
        vicEl.style.display = 'flex';
    }

    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
    const secs = String(elapsedTime % 60).padStart(2, '0');
    const statTimeEl = document.getElementById('stat-time');
    if (statTimeEl) statTimeEl.textContent = `${mins}:${secs}`;
    playVictoryChime();
}

function animate() {
    if (currentState === GAME_STATE.PAUSED || currentState === GAME_STATE.GAMEOVER || currentState === GAME_STATE.VICTORY) return;

    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTimeTotal = clock.getElapsedTime();

    if (keyObject && !keyObject.collected) {
        keyObject.mesh.rotation.y += 0.03;
        keyObject.mesh.position.y = keyObject.initialY + Math.sin(elapsedTimeTotal * 3.0) * 0.25;
    }

    // Predatory floating claw movement while active/moving (INDEPENDENT FINGER ARTICULATION)
    const time = elapsedTimeTotal * (monsterAI.state === 'CHASE' ? 9.0 : 5.0);

    if (monsterAI.leftClawsGroup && currentState === GAME_STATE.PLAYING) {
        monsterAI.leftClawsGroup.position.y = 1.8 + Math.sin(time) * 0.08;
        monsterAI.leftClawsGroup.position.z = 0.4 + Math.cos(time * 0.8) * 0.06;
        monsterAI.leftClawsGroup.rotation.z = Math.sin(time * 0.5) * 0.12;

        monsterAI.leftClaws.forEach((claw, i) => {
            const fingerTime = time * (1.1 + i * 0.2) + i * 1.3;
            claw.position.z = Math.sin(fingerTime) * 0.08;
            claw.position.y = Math.cos(fingerTime * 0.8) * 0.05;
            claw.rotation.x = Math.sin(fingerTime * 1.2) * 0.25;
            claw.rotation.y = Math.cos(fingerTime * 0.9) * 0.15;
        });
    }

    if (monsterAI.rightClawsGroup && currentState === GAME_STATE.PLAYING) {
        monsterAI.rightClawsGroup.position.y = 1.8 + Math.cos(time) * 0.08;
        monsterAI.rightClawsGroup.position.z = 0.4 + Math.sin(time * 0.8) * 0.06;
        monsterAI.rightClawsGroup.rotation.z = -Math.sin(time * 0.5) * 0.12;

        monsterAI.rightClaws.forEach((claw, i) => {
            const fingerTime = time * (1.1 + (3 - i) * 0.2) + i * 1.7;
            claw.position.z = Math.cos(fingerTime) * 0.08;
            claw.position.y = Math.sin(fingerTime * 0.8) * 0.05;
            claw.rotation.x = Math.cos(fingerTime * 1.2) * 0.25;
            claw.rotation.y = -Math.sin(fingerTime * 0.9) * 0.15;
        });
    }

    if (currentState === GAME_STATE.DYING) {
        updateDeathSequence(delta);
        renderer.render(scene, camera);
        return;
    }

    if (currentState === GAME_STATE.VICTORY_CINEMATIC) {
        updateVictoryCinematic(delta);
        renderer.render(scene, camera);
        return;
    }

    updatePlayerMovement(delta);
    updateMonsterAI(delta);
    checkInteractions();
    updateHeartbeatAudio();
    renderMinimap();

    renderer.render(scene, camera);
}

/* ===== PLAYER MOVEMENT WITH CAMERA SWAY ===== */
function updatePlayerMovement(delta) {
    const isMoving = (keys.w || keys.a || keys.s || keys.d);
    player.isSprinting = keys.shift && isMoving && player.stamina > 0;
    const speed = player.isSprinting ? player.sprintSpeed : player.speed;

    if (player.isSprinting) {
        player.stamina = Math.max(0, player.stamina - delta * 35);
    } else {
        player.stamina = Math.min(player.maxStamina, player.stamina + delta * 20);
    }
    const staminaBarEl = document.getElementById('stamina-bar');
    if (staminaBarEl) staminaBarEl.style.width = `${(player.stamina / player.maxStamina) * 100}%`;

    const moveVector = new THREE.Vector3();
    if (keys.w) moveVector.z -= 1;
    if (keys.s) moveVector.z += 1;
    if (keys.a) moveVector.x -= 1;
    if (keys.d) moveVector.x += 1;

    moveVector.normalize();
    moveVector.applyEuler(new THREE.Euler(0, player.rotation.yaw, 0, 'YXZ'));
    moveVector.multiplyScalar(speed * delta);

    const targetPos = player.position.clone().add(moveVector);

    if (!checkWallCollision(targetPos.x, player.position.z, player.radius)) {
        player.position.x = targetPos.x;
    }
    if (!checkWallCollision(player.position.x, targetPos.z, player.radius)) {
        player.position.z = targetPos.z;
    }

    if (isMoving) {
        const bobFrequency = player.isSprinting ? 14 : 9;
        const bobAmountY = player.isSprinting ? 0.08 : 0.04;
        const bobAmountX = player.isSprinting ? 0.04 : 0.02;
        const bobRoll = player.isSprinting ? 0.03 : 0.015;

        bobTimer += delta * bobFrequency;

        const bobOffsetY = Math.sin(bobTimer) * bobAmountY;
        const bobOffsetX = Math.cos(bobTimer * 0.5) * bobAmountX;
        player.rotation.roll = Math.sin(bobTimer * 0.5) * bobRoll;

        camera.position.set(player.position.x + bobOffsetX, player.position.y + bobOffsetY, player.position.z);

        if (flashlightMeshGroup) {
            flashlightMeshGroup.position.y = -0.28 + Math.sin(bobTimer) * 0.025;
            flashlightMeshGroup.position.x = 0.32 + Math.cos(bobTimer * 0.5) * 0.02;
        }
    } else {
        bobTimer = 0;
        player.rotation.roll = 0;
        camera.position.copy(player.position);
        if (flashlightMeshGroup) {
            flashlightMeshGroup.position.set(0.32, -0.28, -0.5);
        }
    }

    updateCameraRotation();
}

function checkWallCollision(x, z, radius) {
    const gridC = Math.floor(x / CELL_SIZE);
    const gridR = Math.floor(z / CELL_SIZE);

    if (gridR < 0 || gridR >= MAZE_SIZE || gridC < 0 || gridC >= MAZE_SIZE) return true;

    for (let r = gridR - 1; r <= gridR + 1; r++) {
        for (let c = gridC - 1; c <= gridC + 1; c++) {
            if (mazeGrid[r] && mazeGrid[r][c] === 1) {
                const wallX = c * CELL_SIZE + CELL_SIZE / 2;
                const wallZ = r * CELL_SIZE + CELL_SIZE / 2;

                const dx = Math.abs(x - wallX);
                const dz = Math.abs(z - wallZ);

                if (dx < CELL_SIZE / 2 + radius && dz < CELL_SIZE / 2 + radius) {
                    return true;
                }
            }
        }
    }
    return false;
}

/* ===== LINE-OF-SIGHT RAYCASTING ===== */
function checkLineOfSight(fromPos, toPos) {
    const dir = new THREE.Vector3().subVectors(toPos, fromPos);
    const dist = dir.length();
    dir.normalize();

    const raycaster = new THREE.Raycaster(fromPos, dir, 0.2, dist);
    const intersects = raycaster.intersectObjects(mazeWalls);
    return intersects.length === 0;
}

/* ===== BFS PATHFINDING ALGORITHM ===== */
function findPathBFS(startPos, targetPos) {
    const startC = Math.floor(startPos.x / CELL_SIZE);
    const startR = Math.floor(startPos.z / CELL_SIZE);
    const targetC = Math.floor(targetPos.x / CELL_SIZE);
    const targetR = Math.floor(targetPos.z / CELL_SIZE);

    if (startR < 0 || startR >= MAZE_SIZE || startC < 0 || startC >= MAZE_SIZE) return [];
    if (targetR < 0 || targetR >= MAZE_SIZE || targetC < 0 || targetC >= MAZE_SIZE) return [];

    const queue = [[startR, startC]];
    const visited = Array.from({ length: MAZE_SIZE }, () => Array(MAZE_SIZE).fill(false));
    const parent = Array.from({ length: MAZE_SIZE }, () => Array(MAZE_SIZE).fill(null));

    visited[startR][startC] = true;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let found = false;

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        if (r === targetR && c === targetC) {
            found = true;
            break;
        }

        for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < MAZE_SIZE && nc >= 0 && nc < MAZE_SIZE) {
                if (mazeGrid[nr][nc] === 0 && !visited[nr][nc]) {
                    visited[nr][nc] = true;
                    parent[nr][nc] = [r, c];
                    queue.push([nr, nc]);
                }
            }
        }
    }

    if (!found) return [];

    const path = [];
    let curr = [targetR, targetC];
    while (curr && !(curr[0] === startR && curr[1] === startC)) {
        const x = curr[1] * CELL_SIZE + CELL_SIZE / 2;
        const z = curr[0] * CELL_SIZE + CELL_SIZE / 2;
        path.unshift({ r: curr[0], c: curr[1], x, z });
        curr = parent[curr[0]][curr[1]];
    }

    return path;
}

/* ===== MONSTER AI WITH DYNAMIC BFS PATHFINDING & REAL-TIME 1S RE-PATHING ===== */
function updateMonsterAI(delta) {
    if (!monsterAI.mesh) return;

    const monsterPos = monsterAI.mesh.position;
    const monsterEyePos = monsterPos.clone().add(new THREE.Vector3(0, 2.8, 0));
    const playerEyePos = player.position.clone();
    const distToPlayer = monsterPos.distanceTo(player.position);

    const hasSight = distToPlayer < monsterAI.detectionRadius && checkLineOfSight(monsterEyePos, playerEyePos);

    pathRecalcTimer += delta;

    const dangerEl = document.getElementById('danger-vignette');
    if (distToPlayer < 24.0 && dangerEl) {
        const ratio = (24.0 - distToPlayer) / 24.0;
        const spreadPx = Math.floor(60 + ratio * 140);
        const alpha = Math.min(0.92, ratio * 1.15);
        dangerEl.style.boxShadow = `inset 0 0 ${spreadPx}px rgba(255, 0, 30, ${alpha})`;
    } else if (dangerEl) {
        dangerEl.style.boxShadow = `inset 0 0 0px rgba(255, 0, 30, 0)`;
    }

    if (hasSight) {
        monsterAI.state = 'CHASE';
        monsterAI.chaseMemoryTimer = 14.0;
        monsterAI.lastSeenPlayerPos.copy(player.position);
    } else if (monsterAI.state === 'CHASE') {
        monsterAI.chaseMemoryTimer -= delta;
        if (distToPlayer > 55.0 || monsterAI.chaseMemoryTimer <= 0) {
            monsterAI.state = 'SEARCH';
            monsterAI.searchTimer = 0;
        }
    }

    if (pathRecalcTimer >= 1.0 || currentPathWaypoints.length === 0) {
        pathRecalcTimer = 0;

        let destinationPos = player.position;

        if (monsterAI.state === 'CHASE') {
            destinationPos = hasSight ? player.position : monsterAI.lastSeenPlayerPos;
        } else {
            monsterAI.searchTimer += delta * 2;
            if (!monsterAI.currentTargetSpot || monsterAI.searchTimer > 5.0) {
                monsterAI.searchTimer = 0;
                monsterAI.currentTargetSpot = validPathsList[Math.floor(Math.random() * validPathsList.length)];
            }
            if (monsterAI.currentTargetSpot) {
                destinationPos = new THREE.Vector3(monsterAI.currentTargetSpot.x, 0, monsterAI.currentTargetSpot.z);
            }
        }

        currentPathWaypoints = findPathBFS(monsterPos, destinationPos);
    }

    let targetVec = player.position.clone();
    if (currentPathWaypoints.length > 0) {
        const nextNode = currentPathWaypoints[0];
        targetVec.set(nextNode.x, 0, nextNode.z);

        if (Math.hypot(monsterPos.x - nextNode.x, monsterPos.z - nextNode.z) < 1.2) {
            currentPathWaypoints.shift();
        }
    }

    const speed = (monsterAI.state === 'CHASE') ? monsterAI.chaseSpeed : monsterAI.speed;
    const dir = new THREE.Vector3().subVectors(targetVec, monsterPos);
    dir.y = 0;

    if (dir.length() > 0.001) {
        dir.normalize();
        const nextPos = monsterPos.clone().add(dir.multiplyScalar(speed * delta));

        if (!checkWallCollision(nextPos.x, monsterPos.z, monsterAI.radius)) {
            monsterPos.x = nextPos.x;
        }
        if (!checkWallCollision(monsterPos.x, nextPos.z, monsterAI.radius)) {
            monsterPos.z = nextPos.z;
        }

        monsterAI.mesh.lookAt(targetVec.x, monsterPos.y, targetVec.z);
    }

    if (distToPlayer < monsterAI.catchDistance && currentState === GAME_STATE.PLAYING) {
        startDeathSequence();
    }
}

/* ===== MINIMAP RADAR WITHOUT MONSTER BEACON ===== */
function renderMinimap() {
    if (!minimapCtx) return;

    const size = 150;
    const center = size / 2;
    const scale = 2.4;
    const maxRadius = center - 12;

    minimapCtx.clearRect(0, 0, size, size);

    minimapCtx.fillStyle = 'rgba(5, 8, 14, 0.94)';
    minimapCtx.beginPath();
    minimapCtx.arc(center, center, center - 2, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    minimapCtx.lineWidth = 1.5;
    minimapCtx.beginPath();
    minimapCtx.arc(center, center, center * 0.33, 0, Math.PI * 2);
    minimapCtx.arc(center, center, center * 0.66, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.fillStyle = 'rgba(40, 50, 70, 0.75)';
    const playerC = Math.floor(player.position.x / CELL_SIZE);
    const playerR = Math.floor(player.position.z / CELL_SIZE);

    for (let r = playerR - 5; r <= playerR + 5; r++) {
        for (let c = playerC - 5; c <= playerC + 5; c++) {
            if (mazeGrid[r] && mazeGrid[r][c] === 1) {
                const wallX = c * CELL_SIZE + CELL_SIZE / 2;
                const wallZ = r * CELL_SIZE + CELL_SIZE / 2;

                const dx = (wallX - player.position.x) * scale;
                const dz = (wallZ - player.position.z) * scale;

                minimapCtx.fillRect(center + dx - 4, center + dz - 4, 8, 8);
            }
        }
    }

    // 1. KEY POINTER (Gold)
    if (keyObject && !keyObject.collected) {
        const kx = (keyObject.x - player.position.x) * scale;
        const kz = (keyObject.z - player.position.z) * scale;
        const distK = Math.hypot(kx, kz);

        if (distK <= maxRadius) {
            minimapCtx.fillStyle = '#ffd700';
            minimapCtx.beginPath();
            minimapCtx.arc(center + kx, center + kz, 5, 0, Math.PI * 2);
            minimapCtx.fill();
        } else {
            const angleK = Math.atan2(kz, kx);
            minimapCtx.fillStyle = '#ffd700';
            minimapCtx.beginPath();
            minimapCtx.arc(center + Math.cos(angleK) * maxRadius, center + Math.sin(angleK) * maxRadius, 5, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    }

    // 2. EXIT DOOR POINTER (Cyan)
    if (exitDoorObject) {
        const ex = (exitDoorObject.x - player.position.x) * scale;
        const ez = (exitDoorObject.z - player.position.z) * scale;
        const distE = Math.hypot(ex, ez);

        if (distE <= maxRadius) {
            minimapCtx.fillStyle = '#00e5ff';
            minimapCtx.fillRect(center + ex - 5, center + ez - 5, 10, 10);
        } else {
            const angleE = Math.atan2(ez, ex);
            const edgeX = center + Math.cos(angleE) * maxRadius;
            const edgeY = center + Math.sin(angleE) * maxRadius;
            minimapCtx.fillStyle = '#00e5ff';
            minimapCtx.fillRect(edgeX - 5, edgeY - 5, 10, 10);
        }
    }

    // Player Green Dot
    minimapCtx.fillStyle = '#00ff88';
    minimapCtx.shadowColor = '#00ff88';
    minimapCtx.shadowBlur = 6;
    minimapCtx.beginPath();
    minimapCtx.arc(center, center, 5, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.shadowBlur = 0;

    const dirX = Math.sin(-player.rotation.yaw) * 14;
    const dirZ = -Math.cos(-player.rotation.yaw) * 14;
    minimapCtx.strokeStyle = '#00ff88';
    minimapCtx.lineWidth = 2.5;
    minimapCtx.beginPath();
    minimapCtx.moveTo(center, center);
    minimapCtx.lineTo(center + dirX, center + dirZ);
    minimapCtx.stroke();
}

/* ===== INTERACTIONS ===== */
function checkInteractions() {
    const promptEl = document.getElementById('interaction-prompt');
    const textEl = document.getElementById('interaction-text');
    const crosshairEl = document.getElementById('crosshair');

    if (promptEl) {
        promptEl.classList.add('hidden');
        promptEl.style.display = 'none';
    }
    if (crosshairEl) crosshairEl.classList.remove('active');

    if (currentState === GAME_STATE.DYING || currentState === GAME_STATE.VICTORY_CINEMATIC) return;

    if (keyObject && !keyObject.collected) {
        const distToKey = player.position.distanceTo(keyObject.mesh.position);
        if (distToKey < 2.8) {
            if (promptEl) {
                promptEl.classList.remove('hidden');
                promptEl.style.display = 'flex';
            }
            if (textEl) textEl.textContent = 'Recoger Llave Maestra';
            if (crosshairEl) crosshairEl.classList.add('active');
            return;
        }
    }

    if (exitDoorObject) {
        const distToExit = player.position.distanceTo(exitDoorObject.mesh.position);
        if (distToExit < 3.2) {
            if (promptEl) {
                promptEl.classList.remove('hidden');
                promptEl.style.display = 'flex';
            }
            if (textEl) textEl.textContent = hasKey ? 'Abrir Puerta de Salida de Roble' : 'Puerta Bloqueada (Requiere Llave)';
            if (crosshairEl) crosshairEl.classList.add('active');
        }
    }
}

function interact() {
    if (keyObject && !keyObject.collected) {
        const distToKey = player.position.distanceTo(keyObject.mesh.position);
        if (distToKey < 2.8) {
            keyObject.collected = true;
            scene.remove(keyObject.mesh);
            hasKey = true;
            updateHUD();
            playAudioChime();
            return;
        }
    }

    if (exitDoorObject) {
        const distToExit = player.position.distanceTo(exitDoorObject.mesh.position);
        if (distToExit < 3.2 && hasKey) {
            startVictoryCinematic();
        }
    }
}

function updateHUD() {
    const keyTextEl = document.getElementById('key-text');
    if (!keyTextEl) return;
    if (hasKey) {
        keyTextEl.textContent = 'CONSEGUIDA';
        keyTextEl.className = 'hud-value status-found';
    } else {
        keyTextEl.textContent = 'NO ENCONTRADA';
        keyTextEl.className = 'hud-value status-missing';
    }
}

/* ===== WEB AUDIO SYNTHESIZER ===== */
function initAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
}

function startAmbientSoundtrack() {
    if (!audioCtx || ambientGain) return;
    try {
        ambientGain = audioCtx.createGain();
        ambientGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        ambientGain.connect(audioCtx.destination);
        
        ambientOsc1 = audioCtx.createOscillator();
        ambientOsc1.type = 'sawtooth';
        ambientOsc1.frequency.setValueAtTime(45, audioCtx.currentTime);
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, audioCtx.currentTime);
        
        ambientOsc1.connect(filter);
        filter.connect(ambientGain);
        ambientOsc1.start();
        
        ambientOsc2 = audioCtx.createOscillator();
        ambientOsc2.type = 'sine';
        ambientOsc2.frequency.setValueAtTime(0.1, audioCtx.currentTime);
        
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.setValueAtTime(30, audioCtx.currentTime);
        ambientOsc2.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        ambientOsc2.start();
    } catch(e) {}
}

/* ORGANIC BODY THUD AUDIO SYNTHESIZER */
function playBodyThudSound() {
    if (!audioCtx) return;
    try {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.4);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.07));
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.35);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.95, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start();
    } catch(e) {}
}

function playNeckSnapSound() {
    if (!audioCtx) return;
    try {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.15);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
            data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (audioCtx.sampleRate * 0.015));
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, audioCtx.currentTime);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start();
    } catch(e) {}
}

function playDevourSound() {
    if (!audioCtx) return;
    try {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!audioCtx) return;
                const bufferSize = Math.floor(audioCtx.sampleRate * 0.22);
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let j = 0; j < bufferSize; j++) {
                    data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (audioCtx.sampleRate * 0.035));
                }

                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;

                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(250 + Math.random() * 450, audioCtx.currentTime);
                filter.Q.setValueAtTime(3.5, audioCtx.currentTime);

                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.9, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);

                noise.start();
            }, i * 130);
        }
    } catch(e) {}
}

function updateHeartbeatAudio() {
    if (!audioCtx || !monsterAI.mesh) return;

    const dist = monsterAI.position.distanceTo(player.position);
    const now = Date.now();

    const bpm = Math.max(60, Math.min(190, 190 - dist * 7));
    const interval = (60 / bpm) * 1000;

    if (now - lastHeartbeatTime > interval) {
        lastHeartbeatTime = now;
        playHeartbeatSound();
    }
}

function playHeartbeatSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

function playImpactSound() {
    playBodyThudSound();
}

function playAudioClick() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
}

function playAudioChime() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

function playMonsterScreech() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(480, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.75, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.0);
}

function playVictoryChime() {
    if (!audioCtx) return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + idx * 0.15 + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.15);
        osc.stop(audioCtx.currentTime + idx * 0.15 + 0.5);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
