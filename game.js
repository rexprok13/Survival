/**
 * THE DARK LABYRINTH - 3D Horror Survival Game
 * Rock-solid Start Game Trigger & Error Protection
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

// Scene, Camera, Renderer
let scene, camera, renderer;
let flashlightLight, flashlightTarget, flashlightMeshGroup, flashFillLight;
let minimapCanvas, minimapCtx;
let clock;
let bobTimer = 0;

// Game Objects
let mazeWalls = [];
let lockers = [];
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
    lockerRotation: { yaw: 0, pitch: 0 },
    height: 1.6,
    radius: 0.6,
    speed: 4.2,
    sprintSpeed: 7.2,
    stamina: 100,
    maxStamina: 100,
    isSprinting: false,
    isHiddenInLocker: false,
    currentLocker: null,
    flashlightOn: true,
    battery: 100
};

// Input State
const keys = { w: false, a: false, s: false, d: false, shift: false };
let isPointerLocked = false;
let startTime = 0;
let elapsedTime = 0;
let deathTimer = 0;
let cinematicTimer = 0;

// Monster AI Properties
const monsterAI = {
    mesh: null,
    position: new THREE.Vector3(),
    state: 'PATROL',
    speed: 2.8,
    chaseSpeed: 5.5,
    currentTargetSpot: null,
    eyesLight: null,
    detectionRadius: 26,
    catchDistance: 1.6,
    radius: 0.7,
    searchTimer: 0
};

// UI Elements Container
let ui = {};

// Audio System
let audioCtx = null;
let lastHeartbeatTime = 0;

/* ===== INITIALIZATION ===== */
window.addEventListener('DOMContentLoaded', () => {
    initUIElements();
    initThreeJS();
    initMinimap();
    initEventListeners();
});

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
        lockerOverlay: document.getElementById('locker-overlay'),
        statTime: document.getElementById('stat-time')
    };
}

function initThreeJS() {
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
}

function initMinimap() {
    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
        minimapCtx = minimapCanvas.getContext('2d');
    }
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

/* ===== PROCEDURAL TEXTURES ===== */
function createWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#08090d';
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

    for (let i = 0; i < 25000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const v = Math.floor(Math.random() * 30);
        ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.2)`;
        ctx.fillRect(x, y, 2, 2);
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

    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 4;
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
    lockers.forEach(l => scene.remove(l.mesh));
    if (keyObject) scene.remove(keyObject.mesh);
    if (exitDoorObject) scene.remove(exitDoorObject.mesh);
    if (houseGroup) scene.remove(houseGroup);
    if (monsterAI.mesh) scene.remove(monsterAI.mesh);

    mazeWalls = [];
    lockers = [];
    validPathsList = [];
    hasKey = false;

    player.isHiddenInLocker = false;
    player.currentLocker = null;
    if (ui.lockerOverlay) ui.lockerOverlay.classList.add('hidden');

    mazeGrid = generateMazeGrid(MAZE_SIZE);

    const wallTex = createWallTexture();
    const floorTex = createFloorTexture();
    floorTex.repeat.set(MAZE_SIZE * 2, MAZE_SIZE * 2);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0.1 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95, metalness: 0.1 });
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
    const deadEnds = [];

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
                let openNeighbors = 0;
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                for (const [dr, dc] of dirs) {
                    if (mazeGrid[r+dr] && mazeGrid[r+dr][c+dc] === 0) openNeighbors++;
                }
                if (openNeighbors === 1 && (r !== 1 || c !== 1)) {
                    deadEnds.push({ r, c, x, z });
                }
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

    const lockerSpots = [...deadEnds, ...validPathsList.filter((_, idx) => idx % 7 === 0)].slice(0, 16);
    lockerSpots.forEach((spot, idx) => createLocker(spot.x, spot.z, idx));

    const keySpot = validPathsList.slice().reverse().find(spot => {
        const distToStart = Math.hypot(spot.x - startX, spot.z - startZ);
        const nearLocker = lockerSpots.some(loc => Math.hypot(loc.x - spot.x, loc.z - spot.z) < 6.0);
        return distToStart > 45.0 && !nearLocker;
    }) || validPathsList[validPathsList.length - 2];

    createFloatingKey(keySpot.x, keySpot.z);

    const exitSpot = validPathsList[validPathsList.length - 1];
    createExitDoor(exitSpot.x, exitSpot.z);

    buildCozyEndingHouse(exitSpot.x, exitSpot.z + 12);

    const monsterSpot = validPathsList.find(spot => {
        const dist = Math.hypot(spot.x - startX, spot.z - startZ);
        return dist >= 30.0 && dist <= 50.0;
    }) || validPathsList[Math.floor(validPathsList.length * 0.5)];

    spawnMonster(monsterSpot.x, monsterSpot.z, validPathsList);

    player.position.set(startX, player.height, startZ);
    player.rotation.yaw = 0;
    player.rotation.pitch = 0;
    player.rotation.roll = 0;
    player.lockerRotation = { yaw: 0, pitch: 0 };
    player.stamina = player.maxStamina;
    player.battery = 100;
    player.flashlightOn = true;

    flashlightLight.intensity = 4.6;
    if (flashFillLight) flashFillLight.intensity = 1.8;
    if (flashlightMeshGroup) flashlightMeshGroup.visible = true;

    updateHUD();
}

/* ===== REALISTIC 3D HOUSE ===== */
function buildCozyEndingHouse(hx, hz) {
    houseGroup = new THREE.Group();

    const grassGeo = new THREE.PlaneGeometry(60, 60);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x112b18, roughness: 0.95 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(hx, 0, hz + 15);
    houseGroup.add(grass);

    const houseWallMat = new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 0.8 });
    const wallGeo = new THREE.BoxGeometry(10, 4.5, 12);
    const houseWalls = new THREE.Mesh(wallGeo, houseWallMat);
    houseWalls.position.set(hx, 2.25, hz + 15);
    houseGroup.add(houseWalls);

    const roofGeo = new THREE.ConeGeometry(8.5, 3.5, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x221815, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(hx, 6.0, hz + 15);
    houseGroup.add(roof);

    const warmLight = new THREE.PointLight(0xff9933, 4, 15);
    warmLight.position.set(hx, 2.5, hz + 15);
    houseGroup.add(warmLight);

    const sofaGroup = new THREE.Group();
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x8b1e1e, roughness: 0.65 });
    const seatGeo = new THREE.BoxGeometry(3.2, 0.7, 1.4);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.35, 0);

    const backGeo = new THREE.BoxGeometry(3.2, 1.4, 0.4);
    const back = new THREE.Mesh(backGeo, seatMat);
    back.position.set(0, 1.05, -0.5);

    sofaGroup.add(seat, back);
    sofaGroup.position.set(hx, 0, hz + 16.5);
    houseGroup.add(sofaGroup);

    const windowGeo = new THREE.BoxGeometry(2.6, 2.2, 0.15);
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x050a12,
        transparent: true,
        opacity: 0.75,
        roughness: 0.1
    });
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(hx, 2.2, hz + 21);
    houseGroup.add(windowMesh);

    scene.add(houseGroup);
}

/* ===== REALISTIC WOODEN EXIT DOOR ===== */
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

function createLocker(x, z, id) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(1.3, 2.9, 1.1);
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.85, roughness: 0.35 });

    const body = new THREE.Mesh(bodyGeo, lockerMat);
    body.position.y = 1.45;
    body.castShadow = true;
    group.add(body);

    const handleGeo = new THREE.BoxGeometry(0.06, 0.3, 0.08);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0.55, 1.45, 0.6);
    group.add(handle);

    const handleLight = new THREE.PointLight(0x00aaff, 0.8, 3.0);
    handleLight.position.set(0.6, 1.45, 0.7);
    group.add(handleLight);

    group.position.set(x, 0, z);
    scene.add(group);

    lockers.push({
        id,
        mesh: group,
        position: new THREE.Vector3(x, 0, z),
        insidePos: new THREE.Vector3(x, player.height, z)
    });
}

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

    const armGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
    const leftArm = new THREE.Mesh(armGeo, monsterMat);
    leftArm.position.set(-0.65, 1.8, 0.3);
    leftArm.rotation.z = 0.2;

    const rightArm = new THREE.Mesh(armGeo, monsterMat);
    rightArm.position.set(0.65, 1.8, 0.3);
    rightArm.rotation.z = -0.2;

    group.add(leftArm, rightArm);

    const eyeGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0011 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.22, 3.0, 0.45);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.22, 3.0, 0.45);

    const redLight = new THREE.PointLight(0xff0011, 5, 8);
    redLight.position.set(0, 3.0, 0.55);

    group.add(leftEye, rightEye, redLight);
    group.position.set(x, 0, z);

    scene.add(group);

    monsterAI.mesh = group;
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
        startMenu.addEventListener('click', () => {
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

    if (ui.flashlightToggleBtn) {
        ui.flashlightToggleBtn.addEventListener('click', toggleFlashlight);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
}

function requestPointerLock() {
    try { renderer.domElement.requestPointerLock(); } catch (e) {}
}

function onPointerLockChange() {
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

    if (ui.flashlightStatusText) {
        if (player.flashlightOn) {
            ui.flashlightStatusText.textContent = 'ENCENDIDA [F]';
            ui.flashlightStatusText.className = 'hud-value status-found';
        } else {
            ui.flashlightStatusText.textContent = 'APAGADA [F]';
            ui.flashlightStatusText.className = 'hud-value status-missing';
        }
    }

    playAudioClick();
}

function onMouseMove(e) {
    if (currentState === GAME_STATE.DYING || currentState === GAME_STATE.VICTORY_CINEMATIC) return;

    const sensitivity = 0.0022;

    if (player.isHiddenInLocker) {
        player.lockerRotation.yaw -= e.movementX * sensitivity;
        player.lockerRotation.pitch -= e.movementY * sensitivity;
        player.lockerRotation.yaw = Math.max(-0.7, Math.min(0.7, player.lockerRotation.yaw));
        player.lockerRotation.pitch = Math.max(-0.3, Math.min(0.3, player.lockerRotation.pitch));

        const euler = new THREE.Euler(player.lockerRotation.pitch, player.rotation.yaw + player.lockerRotation.yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);
        return;
    }

    if (!isPointerLocked) return;

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

/* ===== GAME ENGINE LOOP ===== */
function startGame() {
    try {
        initAudioContext();
        buildMazeWorld();
        currentState = GAME_STATE.PLAYING;
        hideAllScreens();
        
        if (ui.hud) ui.hud.classList.remove('hidden');
        if (ui.bloodVignette) ui.bloodVignette.classList.add('hidden');
        if (ui.objectiveBanner) ui.objectiveBanner.style.display = 'block';
        
        startTime = Date.now();
        requestPointerLock();
        clock.start();
        animate();
    } catch(err) {
        console.error("Game Start Error:", err);
    }
}

function pauseGame() {
    if (currentState !== GAME_STATE.PLAYING) return;
    currentState = GAME_STATE.PAUSED;
    document.exitPointerLock();
    if (ui.pauseMenu) ui.pauseMenu.classList.remove('hidden');
}

function resumeGame() {
    currentState = GAME_STATE.PLAYING;
    if (ui.pauseMenu) ui.pauseMenu.classList.add('hidden');
    requestPointerLock();
}

function hideAllScreens() {
    if (ui.startMenu) ui.startMenu.classList.add('hidden');
    if (ui.pauseMenu) ui.pauseMenu.classList.add('hidden');
    if (ui.gameOverScreen) ui.gameOverScreen.classList.add('hidden');
    if (ui.victoryScreen) ui.victoryScreen.classList.add('hidden');
}

function startDeathSequence() {
    if (currentState === GAME_STATE.DYING) return;
    currentState = GAME_STATE.DYING;
    deathTimer = 0;
    if (ui.bloodVignette) ui.bloodVignette.classList.remove('hidden');
    playImpactSound();
    playMonsterScreech();
}

function updateDeathSequence(delta) {
    deathTimer += delta;

    player.position.y = Math.max(0.25, player.position.y - delta * 3.5);
    player.rotation.roll = Math.min(Math.PI / 2.2, player.rotation.roll + delta * 3.0);
    player.rotation.pitch = Math.max(-Math.PI / 3, player.rotation.pitch - delta * 1.5);
    camera.position.copy(player.position);
    updateCameraRotation();

    if (monsterAI.mesh) {
        monsterAI.mesh.position.set(player.position.x, 0, player.position.z + 0.5);
        monsterAI.mesh.lookAt(player.position.x, 0.2, player.position.z);
    }

    if (deathTimer > 1.5) {
        triggerGameOver();
    }
}

/* ===== CINEMATIC VICTORY SEQUENCE ===== */
function startVictoryCinematic() {
    currentState = GAME_STATE.VICTORY_CINEMATIC;
    cinematicTimer = 0;
    document.exitPointerLock();
    if (ui.hud) ui.hud.classList.add('hidden');

    if (monsterAI.mesh && exitDoorObject) {
        endingMonsterMesh = monsterAI.mesh;
        endingMonsterMesh.position.set(exitDoorObject.x, 0, exitDoorObject.z + 21.8);
        endingMonsterMesh.lookAt(exitDoorObject.x, 1.6, exitDoorObject.z + 16.5);
    }
}

function updateVictoryCinematic(delta) {
    cinematicTimer += delta;

    const ex = exitDoorObject.x;
    const ez = exitDoorObject.z;

    if (cinematicTimer < 2.5) {
        const doorProgress = cinematicTimer / 2.5;
        if (exitDoorObject && exitDoorObject.doorPivot) {
            exitDoorObject.doorPivot.rotation.y = -Math.PI / 1.8 * doorProgress;
        }
        player.position.set(ex, 1.6, ez + doorProgress * 4.0);
        player.rotation.yaw = 0;
        player.rotation.pitch = 0;
    } else if (cinematicTimer < 6.0) {
        const progress = (cinematicTimer - 2.5) / 3.5;
        player.position.set(ex, 1.6, ez + 4.0 + progress * 12.0);
        player.rotation.yaw = 0;
    } else if (cinematicTimer < 9.0) {
        const progress = (cinematicTimer - 6.0) / 3.0;
        player.position.set(ex, 1.6 - progress * 0.75, ez + 16.5);
        player.rotation.yaw = Math.PI * progress;
        player.rotation.pitch = -0.15;
    } else if (cinematicTimer < 12.0) {
        if (cinematicTimer > 9.2 && cinematicTimer < 9.5) {
            if (ui.lightningFlash) ui.lightningFlash.classList.add('flash');
            playImpactSound();
        } else if (cinematicTimer > 10.5 && cinematicTimer < 10.8) {
            if (ui.lightningFlash) ui.lightningFlash.classList.add('flash');
            playMonsterScreech();
        } else {
            if (ui.lightningFlash) ui.lightningFlash.classList.remove('flash');
        }
    } else {
        triggerVictory();
    }

    camera.position.copy(player.position);
    updateCameraRotation();
}

function triggerGameOver() {
    currentState = GAME_STATE.GAMEOVER;
    document.exitPointerLock();
    if (ui.hud) ui.hud.classList.add('hidden');
    if (ui.gameOverScreen) ui.gameOverScreen.classList.remove('hidden');
}

function triggerVictory() {
    currentState = GAME_STATE.VICTORY;
    document.exitPointerLock();
    if (ui.hud) ui.hud.classList.add('hidden');
    if (ui.victoryScreen) ui.victoryScreen.classList.remove('hidden');

    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
    const secs = String(elapsedTime % 60).padStart(2, '0');
    if (ui.statTime) ui.statTime.textContent = `${mins}:${secs}`;
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

    if (!player.isHiddenInLocker) {
        updatePlayerMovement(delta);
    }
    
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
    if (ui.staminaBar) ui.staminaBar.style.width = `${(player.stamina / player.maxStamina) * 100}%`;

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

/* ===== MONSTER AI WITH DEATH TRIGGER ===== */
function updateMonsterAI(delta) {
    if (!monsterAI.mesh) return;

    const monsterPos = monsterAI.mesh.position;
    const monsterEyePos = monsterPos.clone().add(new THREE.Vector3(0, 2.8, 0));
    const playerEyePos = player.position.clone();
    const distToPlayer = monsterPos.distanceTo(player.position);

    const hasSight = !player.isHiddenInLocker && distToPlayer < monsterAI.detectionRadius && checkLineOfSight(monsterEyePos, playerEyePos);

    if (distToPlayer < 24.0 && !player.isHiddenInLocker && ui.dangerVignette) {
        const ratio = (24.0 - distToPlayer) / 24.0;
        const spreadPx = Math.floor(60 + ratio * 140);
        const alpha = Math.min(0.92, ratio * 1.15);
        ui.dangerVignette.style.boxShadow = `inset 0 0 ${spreadPx}px rgba(255, 0, 30, ${alpha})`;
    } else if (ui.dangerVignette) {
        ui.dangerVignette.style.boxShadow = `inset 0 0 0px rgba(255, 0, 30, 0)`;
    }

    if (hasSight) {
        monsterAI.state = 'CHASE';
    } else if (monsterAI.state === 'CHASE') {
        monsterAI.state = 'SEARCH';
        monsterAI.searchTimer = 0;
    }

    let targetVec = new THREE.Vector3();

    if (monsterAI.state === 'CHASE') {
        targetVec.copy(player.position);
    } else {
        monsterAI.searchTimer += delta;
        if (!monsterAI.currentTargetSpot || monsterAI.searchTimer > 7.0 || monsterPos.distanceTo(new THREE.Vector3(monsterAI.currentTargetSpot.x, 0, monsterAI.currentTargetSpot.z)) < 1.5) {
            monsterAI.searchTimer = 0;
            monsterAI.currentTargetSpot = validPathsList[Math.floor(Math.random() * validPathsList.length)];
        }
        targetVec.set(monsterAI.currentTargetSpot.x, 0, monsterAI.currentTargetSpot.z);
    }

    const speed = (monsterAI.state === 'CHASE') ? monsterAI.chaseSpeed : monsterAI.speed;
    const dir = new THREE.Vector3().subVectors(targetVec, monsterPos).normalize();
    dir.y = 0;

    const nextPos = monsterPos.clone().add(dir.multiplyScalar(speed * delta));

    if (!checkWallCollision(nextPos.x, monsterPos.z, monsterAI.radius)) {
        monsterPos.x = nextPos.x;
    }
    if (!checkWallCollision(monsterPos.x, nextPos.z, monsterAI.radius)) {
        monsterPos.z = nextPos.z;
    }

    monsterAI.mesh.lookAt(targetVec.x, monsterPos.y, targetVec.z);

    if (distToPlayer < monsterAI.catchDistance && !player.isHiddenInLocker && currentState === GAME_STATE.PLAYING) {
        startDeathSequence();
    }
}

/* ===== MINIMAP RADAR ===== */
function renderMinimap() {
    if (!minimapCtx) return;

    const size = 150;
    const center = size / 2;
    const scale = 2.4;
    const maxRadius = center - 10;

    minimapCtx.clearRect(0, 0, size, size);

    minimapCtx.fillStyle = 'rgba(5, 8, 14, 0.9)';
    minimapCtx.beginPath();
    minimapCtx.arc(center, center, center - 2, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    minimapCtx.lineWidth = 1;
    minimapCtx.beginPath();
    minimapCtx.arc(center, center, center * 0.33, 0, Math.PI * 2);
    minimapCtx.arc(center, center, center * 0.66, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.fillStyle = 'rgba(40, 50, 70, 0.7)';
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

    if (keyObject && !keyObject.collected) {
        const kx = (keyObject.x - player.position.x) * scale;
        const kz = (keyObject.z - player.position.z) * scale;
        if (Math.hypot(kx, kz) < maxRadius) {
            minimapCtx.fillStyle = '#ffd700';
            minimapCtx.beginPath();
            minimapCtx.arc(center + kx, center + kz, 5, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    }

    if (exitDoorObject) {
        const ex = (exitDoorObject.x - player.position.x) * scale;
        const ez = (exitDoorObject.z - player.position.z) * scale;
        const distExit = Math.hypot(ex, ez);

        if (distExit <= maxRadius) {
            minimapCtx.fillStyle = '#00e5ff';
            minimapCtx.fillRect(center + ex - 5, center + ez - 5, 10, 10);
        } else {
            const angle = Math.atan2(ez, ex);
            const edgeX = center + Math.cos(angle) * (maxRadius - 2);
            const edgeY = center + Math.sin(angle) * (maxRadius - 2);

            minimapCtx.save();
            minimapCtx.translate(edgeX, edgeY);
            minimapCtx.rotate(angle);

            minimapCtx.fillStyle = '#00e5ff';
            minimapCtx.beginPath();
            minimapCtx.moveTo(7, 0);
            minimapCtx.lineTo(-5, -5);
            minimapCtx.lineTo(-2, 0);
            minimapCtx.lineTo(-5, 5);
            minimapCtx.closePath();
            minimapCtx.fill();

            minimapCtx.restore();
        }
    }

    if (monsterAI.mesh) {
        const mx = (monsterAI.position.x - player.position.x) * scale;
        const mz = (monsterAI.position.z - player.position.z) * scale;
        const distToCenter = Math.hypot(mx, mz);

        if (distToCenter <= maxRadius) {
            const pulse = (Math.sin(Date.now() * 0.012) + 1) * 5;
            minimapCtx.strokeStyle = 'rgba(255, 0, 40, 0.8)';
            minimapCtx.lineWidth = 2;
            minimapCtx.beginPath();
            minimapCtx.arc(center + mx, center + mz, 6 + pulse, 0, Math.PI * 2);
            minimapCtx.stroke();

            minimapCtx.fillStyle = '#ff0033';
            minimapCtx.beginPath();
            minimapCtx.arc(center + mx, center + mz, 6, 0, Math.PI * 2);
            minimapCtx.fill();
        } else {
            const angle = Math.atan2(mz, mx);
            const edgeX = center + Math.cos(angle) * maxRadius;
            const edgeY = center + Math.sin(angle) * maxRadius;

            minimapCtx.save();
            minimapCtx.translate(edgeX, edgeY);
            minimapCtx.rotate(angle);

            minimapCtx.fillStyle = '#ff0033';
            minimapCtx.beginPath();
            minimapCtx.moveTo(8, 0);
            minimapCtx.lineTo(-6, -6);
            minimapCtx.lineTo(-3, 0);
            minimapCtx.lineTo(-6, 6);
            minimapCtx.closePath();
            minimapCtx.fill();

            minimapCtx.restore();
        }
    }

    minimapCtx.fillStyle = '#00ff88';
    minimapCtx.beginPath();
    minimapCtx.arc(center, center, 4, 0, Math.PI * 2);
    minimapCtx.fill();

    const dirX = Math.sin(-player.rotation.yaw) * 12;
    const dirZ = -Math.cos(-player.rotation.yaw) * 12;
    minimapCtx.strokeStyle = '#00ff88';
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(center, center);
    minimapCtx.lineTo(center + dirX, center + dirZ);
    minimapCtx.stroke();
}

/* ===== INTERACTIONS ===== */
function checkInteractions() {
    if (ui.interactionPrompt) ui.interactionPrompt.classList.add('hidden');
    if (ui.crosshair) ui.crosshair.classList.remove('active');

    if (player.isHiddenInLocker || currentState === GAME_STATE.DYING || currentState === GAME_STATE.VICTORY_CINEMATIC) return;

    if (keyObject && !keyObject.collected) {
        const distToKey = player.position.distanceTo(keyObject.mesh.position);
        if (distToKey < 2.8) {
            if (ui.interactionPrompt) ui.interactionPrompt.classList.remove('hidden');
            if (ui.interactionText) ui.interactionText.textContent = 'Recoger Llave Maestra';
            if (ui.crosshair) ui.crosshair.classList.add('active');
            return;
        }
    }

    for (const locker of lockers) {
        const dist = player.position.distanceTo(locker.position);
        if (dist < 2.8) {
            if (ui.interactionPrompt) ui.interactionPrompt.classList.remove('hidden');
            if (ui.interactionText) ui.interactionText.textContent = 'Ocultarse en el armario';
            if (ui.crosshair) ui.crosshair.classList.add('active');
            return;
        }
    }

    if (exitDoorObject) {
        const distToExit = player.position.distanceTo(exitDoorObject.mesh.position);
        if (distToExit < 3.2) {
            if (ui.interactionPrompt) ui.interactionPrompt.classList.remove('hidden');
            if (ui.interactionText) ui.interactionText.textContent = hasKey ? 'Abrir Puerta de Salida de Roble' : 'Puerta Bloqueada (Requiere Llave)';
            if (ui.crosshair) ui.crosshair.classList.add('active');
        }
    }
}

function interact() {
    if (player.isHiddenInLocker) {
        exitLocker();
        return;
    }

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

    for (const locker of lockers) {
        const dist = player.position.distanceTo(locker.position);
        if (dist < 2.8) {
            enterLocker(locker);
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

function enterLocker(locker) {
    player.isHiddenInLocker = true;
    player.currentLocker = locker;
    player.lockerRotation = { yaw: 0, pitch: 0 };
    camera.position.copy(locker.insidePos);
    if (ui.lockerOverlay) ui.lockerOverlay.classList.remove('hidden');
    if (ui.interactionPrompt) ui.interactionPrompt.classList.add('hidden');
    playLockerSqueak();
}

function exitLocker() {
    player.isHiddenInLocker = false;
    player.currentLocker = null;
    camera.position.copy(player.position);
    if (ui.lockerOverlay) ui.lockerOverlay.classList.add('hidden');
    playLockerSqueak();
}

function updateHUD() {
    if (!ui.keyText) return;
    if (hasKey) {
        ui.keyText.textContent = 'CONSEGUIDA';
        ui.keyText.className = 'hud-value status-found';
    } else {
        ui.keyText.textContent = 'NO ENCONTRADA';
        ui.keyText.className = 'hud-value status-missing';
    }
}

/* ===== WEB AUDIO SYNTHESIZER ===== */
function initAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
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
    osc.frequency.setValueAtTime(60, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.16);
}

function playImpactSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
}

function playLockerSqueak() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playAudioClick() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
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
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(550, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.9);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.9);
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
