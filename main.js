import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { navigateTo, mapEnvironment, initBrain, saveBrainState, unloadBrain, stopMapping, isPointReachable, getBrain } from './brain.js';

// Define the environment dimensions
const ROOM_WIDTH = 12;
const ROOM_DEPTH = 12;
const WALL_HEIGHT = 4;

const createScene = (canvas) => {
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    // Initialize Brain (Asynchronously)
    const bounds = { minX: -7, maxX: 24, minZ: -7, maxZ: 7 };
    
    // Attempt to load pre-trained map
    const loadBrain = async () => {
        try {
            const response = await fetch('./nslam_map_learned.json');
            if (response.ok) {
                const preTrainedData = await response.json();
                await initBrain(bounds, preTrainedData);
                document.getElementById("brain-indicator").innerText = "Pre-trained Brain Loaded";
                document.getElementById("brain-indicator").className = "value active";
            } else {
                await initBrain(bounds);
            }
        } catch (e) {
            console.log("No pre-trained map found, starting fresh.");
            await initBrain(bounds);
        }
    };
    loadBrain();

    // Camera
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 1.1, Math.PI / 4.0, 50, new BABYLON.Vector3(8.5, 0, 0), scene);
    camera.attachControl(canvas, true);
    camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 60;

    // Light
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 5, 0), scene);
    light.intensity = 0.7;

    // Materials
    const floorMat = new BABYLON.StandardMaterial("floorMat", scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
    
    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    wallMat.alpha = 0.8;

    const mapPointMat = new BABYLON.StandardMaterial("mapPointMat", scene);
    mapPointMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
    mapPointMat.alpha = 0.3;

    // Environment
    const CORRIDOR_WIDTH = 2.4; 
    const CORRIDOR_LENGTH = 5;
    const ROOM2_X = ROOM_WIDTH + CORRIDOR_LENGTH;

    // Floors
    const floor1 = BABYLON.MeshBuilder.CreateGround("floor1", { width: ROOM_WIDTH, height: ROOM_DEPTH }, scene);
    floor1.material = floorMat;
    floor1.checkCollisions = true;

    const corridorFloor = BABYLON.MeshBuilder.CreateGround("corridorFloor", { width: CORRIDOR_LENGTH, height: CORRIDOR_WIDTH }, scene);
    corridorFloor.position.x = ROOM_WIDTH / 2 + CORRIDOR_LENGTH / 2;
    corridorFloor.material = floorMat;
    corridorFloor.checkCollisions = true;

    const floor2 = BABYLON.MeshBuilder.CreateGround("floor2", { width: ROOM_WIDTH, height: ROOM_DEPTH }, scene);
    floor2.position.x = ROOM2_X;
    floor2.material = floorMat;
    floor2.checkCollisions = true;

    // Walls Helper
    const createWall = (name, width, height, position, rotationY = 0) => {
        const wall = BABYLON.MeshBuilder.CreateBox(name, { width, height, depth: 0.2 }, scene);
        wall.position = position;
        wall.rotation.y = rotationY;
        wall.material = wallMat;
        wall.checkCollisions = true;
        return wall;
    };

    // Room 1 Walls
    createWall("wallBack1", ROOM_WIDTH, WALL_HEIGHT, new BABYLON.Vector3(0, WALL_HEIGHT / 2, ROOM_DEPTH / 2));
    createWall("wallFront1", ROOM_WIDTH, WALL_HEIGHT, new BABYLON.Vector3(0, WALL_HEIGHT / 2, -ROOM_DEPTH / 2));
    createWall("wallLeft1", ROOM_DEPTH, WALL_HEIGHT, new BABYLON.Vector3(-ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0), Math.PI / 2);
    
    const sideWallWidth = (ROOM_DEPTH - CORRIDOR_WIDTH) / 2;
    createWall("wallRight1_P1", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + sideWallWidth/2), Math.PI / 2);
    createWall("wallRight1_P2", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM_WIDTH/2, WALL_HEIGHT/2, ROOM_DEPTH/2 - sideWallWidth/2), Math.PI / 2);

    // Corridor
    createWall("wallC1", CORRIDOR_LENGTH, WALL_HEIGHT-1, new BABYLON.Vector3(ROOM_WIDTH/2 + CORRIDOR_LENGTH/2, (WALL_HEIGHT-1)/2, CORRIDOR_WIDTH/2));
    createWall("wallC2", CORRIDOR_LENGTH, WALL_HEIGHT-1, new BABYLON.Vector3(ROOM_WIDTH/2 + CORRIDOR_LENGTH/2, (WALL_HEIGHT-1)/2, -CORRIDOR_WIDTH/2));

    // Room 2 Walls
    createWall("wallBack2", ROOM_WIDTH, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X, WALL_HEIGHT / 2, ROOM_DEPTH / 2));
    createWall("wallFront2", ROOM_WIDTH, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X, WALL_HEIGHT / 2, -ROOM_DEPTH / 2));
    createWall("wallRight2", ROOM_DEPTH, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X + ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0), Math.PI / 2);
    createWall("wallLeft2_P1", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X - ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + sideWallWidth/2), Math.PI / 2);
    createWall("wallLeft2_P2", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X - ROOM_WIDTH/2, WALL_HEIGHT/2, ROOM_DEPTH/2 - sideWallWidth/2), Math.PI / 2);

    // Furniture (Simplified)
    const table = BABYLON.MeshBuilder.CreateBox("table", { width: 3, height: 0.8, depth: 2 }, scene);
    table.position = new BABYLON.Vector3(0, 0.4, 0);
    table.checkCollisions = true;

    const bed = BABYLON.MeshBuilder.CreateBox("bed", { width: 4, height: 0.6, depth: 2.5 }, scene);
    bed.position = new BABYLON.Vector3(ROOM2_X + 3.5, 0.3, 4);
    bed.checkCollisions = true;

    // Robot & Control State
    let brainMode = 'manual';
    let currentTarget = null;

    // Robot
    const faceColors = new Array(6).fill(new BABYLON.Color4(1, 0.9, 0, 1)); // Bright Yellow (RGBA)
    faceColors[0] = new BABYLON.Color4(0.0, 0.0, 255, 0.30); // Front Face Blue (RGBA)

    const robot = BABYLON.MeshBuilder.CreateBox("robot", { 
        width: 0.5, height: 0.7, depth: 0.4, 
        faceColors: faceColors 
    }, scene);
    robot.position = new BABYLON.Vector3(0, 0.35, 4);
    robot.checkCollisions = true;
    robot.ellipsoid = new BABYLON.Vector3(0.3, 0.35, 0.3);
    robot.currentPath = null;

    // Body Material
    const robotMat = new BABYLON.StandardMaterial("robotMat", scene);
    robotMat.useVertexColors = true;
    robotMat.diffuseColor = new BABYLON.Color3(1, 1, 1); // Preserve vertex colors
    robotMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    robot.material = robotMat;

    // Face Screen
    const faceScreen = BABYLON.MeshBuilder.CreatePlane("faceScreen", { width: 0.4, height: 0.3 }, scene);
    faceScreen.parent = robot;
    faceScreen.position.z = 0.201; // Offset to avoid z-fighting
    faceScreen.position.y = 0.15;
    
    // Dynamic Texture for Face
    const faceTexture = new BABYLON.DynamicTexture("faceTexture", { width: 256, height: 256 }, scene);
    const faceContext = faceTexture.getContext();
    const faceMat = new BABYLON.StandardMaterial("faceMat", scene);
    faceMat.diffuseTexture = faceTexture;
    faceMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    faceScreen.material = faceMat;

    const drawFace = (expression = 'happy', blink = false) => {
        faceContext.clearRect(0, 0, 256, 256);
        faceContext.fillStyle = "#294dc7ff"; // Dark screen background
        faceContext.fillRect(0, 0, 256, 256);
        
        faceContext.fillStyle = "#00ffcc"; // Cyberglow cyan
        faceContext.strokeStyle = "#00ffcc";
        faceContext.lineWidth = 12;
        faceContext.lineCap = "round";

        if (blink) {
            // Blinking eyes (horizontal lines)
            faceContext.beginPath();
            faceContext.moveTo(60, 100); faceContext.lineTo(100, 100);
            faceContext.moveTo(156, 100); faceContext.lineTo(196, 100);
            faceContext.stroke();
        } else {
            // Round eyes
            faceContext.beginPath();
            faceContext.arc(80, 100, 20, 0, Math.PI * 2);
            faceContext.arc(176, 100, 20, 0, Math.PI * 2);
            faceContext.fill();
        }

        // Mouth
        faceContext.beginPath();
        if (expression === 'happy') {
            faceContext.arc(128, 150, 45, 0.15 * Math.PI, 0.85 * Math.PI);
        } else if (expression === 'thinking') {
            faceContext.moveTo(90, 180);
            faceContext.lineTo(166, 180);
        } else {
            faceContext.moveTo(100, 180);
            faceContext.lineTo(156, 180);
        }
        faceContext.stroke();
        faceTexture.update();
    };

    // Antenna
    const yellowMat = new BABYLON.StandardMaterial("yellowMat", scene);
    yellowMat.diffuseColor = new BABYLON.Color3(1, 0.9, 0);

    const antennaBase = BABYLON.MeshBuilder.CreateCylinder("antennaBase", { diameter: 0.05, height: 0.2 }, scene);
    antennaBase.parent = robot;
    antennaBase.position.y = 0.45;
    antennaBase.material = yellowMat;

    const antennaTip = BABYLON.MeshBuilder.CreateSphere("antennaTip", { diameter: 0.08 }, scene);
    antennaTip.parent = antennaBase;
    antennaTip.position.y = 0.1;
    const tipMat = new BABYLON.StandardMaterial("tipMat", scene);
    tipMat.emissiveColor = new BABYLON.Color3(0, 1, 0.8);
    antennaTip.material = tipMat;

    // Face Animation State
    let faceTimer = 0;
    scene.onBeforeRenderObservable.add(() => {
        faceTimer++;
        const isBlinking = (faceTimer % 180 > 170); // Blink every 3s
        const currentExp = (brainMode === 'mapping' || brainMode === 'auto-nav') ? 'thinking' : 'happy';
        drawFace(currentExp, isBlinking);
        
        // Pulse antenna tip
        tipMat.emissiveColor.g = 0.5 + Math.sin(faceTimer * 0.1) * 0.5;
        tipMat.emissiveColor.b = 0.5 + Math.sin(faceTimer * 0.1) * 0.5;
    });

    // UI
    const posDisplay = document.getElementById("robot-pos");
    const brainIndicator = document.getElementById("brain-indicator");
    const stopBtn = document.getElementById("btn-stop-learning");
    const saveMapBtn = document.getElementById("btn-save-map");


    // Map Visualization
    const mapPoints = [];
    scene.onBeforeRenderObservable.add(() => {
        // Occasionally drop a visual breadcrumb where we've "learned"
        if (brainMode === 'mapping' && Math.random() < 0.1) {
            const dot = BABYLON.MeshBuilder.CreateSphere("dot", { diameter: 0.1 }, scene);
            dot.position = robot.position.clone();
            dot.material = mapPointMat;
            mapPoints.push(dot);
            if (mapPoints.length > 500) mapPoints.shift().dispose();
        }
    });

    // Brain Map Visualizer Logic
    const visualizerCanvas = document.getElementById("brain-map-canvas");
    const visualizerCtx = visualizerCanvas.getContext("2d");
    const cellsLearnedDisplay = document.getElementById("cells-learned");
    const visualizerDot = document.querySelector("#brain-visualizer .status-dot");

    let lastVisualizerUpdate = 0;
    const updateBrainVisualizer = () => {
        const now = Date.now();
        if (now - lastVisualizerUpdate < 200) return; // Limit to 5 FPS
        lastVisualizerUpdate = now;

        const brain = getBrain();
        if (!brain) return;

        const gridData = brain.getGridData();
        const { grid, width, depth } = gridData;

        // Set internal resolution of canvas to match grid
        if (visualizerCanvas.width !== width) visualizerCanvas.width = width;
        if (visualizerCanvas.height !== depth) visualizerCanvas.height = depth;

        const imageData = visualizerCtx.createImageData(width, depth);
        let learnedCount = 0;

        for (let i = 0; i < grid.length; i++) {
            const val = grid[i];
            const px = i * 4;

            if (val === 1) { // Traversable
                imageData.data[px] = 0;      // R
                imageData.data[px + 1] = 243;  // G
                imageData.data[px + 2] = 255;  // B
                imageData.data[px + 3] = 180;  // A
                learnedCount++;
            } else if (val === -1) { // Obstacle
                imageData.data[px] = 255;    // R
                imageData.data[px + 1] = 77;   // G
                imageData.data[px + 2] = 77;   // B
                imageData.data[px + 3] = 255;  // A
                learnedCount++;
            } else { // Unvisited
                imageData.data[px] = 0;
                imageData.data[px + 1] = 0;
                imageData.data[px + 2] = 0;
                imageData.data[px + 3] = 40;
            }
        }

        visualizerCtx.putImageData(imageData, 0, 0);
        cellsLearnedDisplay.innerText = learnedCount;

        // Flash dot if mapping is active
        if (brainMode === 'mapping') {
            visualizerDot.style.opacity = (Math.sin(now * 0.01) + 1) / 2;
        } else {
            visualizerDot.style.opacity = 1;
        }
    };

    scene.onBeforeRenderObservable.add(updateBrainVisualizer);

    document.getElementById("btn-auto-nav").addEventListener("click", () => {
        brainMode = 'auto-nav';
        currentTarget = new BABYLON.Vector3(ROOM2_X, 0.4, 0); // Target Room 2
        robot.currentPath = null; // Reset path to force recalculation
        brainIndicator.innerText = "Computing Path...";
        brainIndicator.className = "value thinking";
    });

    document.getElementById("btn-build-graph").addEventListener("click", async () => {
        brainMode = 'mapping';
        brainIndicator.innerText = "Mapping Room...";
        brainIndicator.className = "value thinking";
        stopBtn.classList.remove("hidden");
        
        await mapEnvironment(robot, scene, bounds);
        
        // Only reset indicator here if we finished naturally (mappingActive is handled inside brain.js)
        if (brainMode === 'mapping') {
            brainMode = 'manual';
            brainIndicator.innerText = "Brain Ready";
            brainIndicator.className = "value active";
            stopBtn.classList.add("hidden");
            saveMapBtn.classList.remove("hidden"); // Show it here
        }
    });

    saveMapBtn.addEventListener("click", () => {
        saveBrainState();
    });

    stopBtn.addEventListener("click", async () => {
        stopMapping();
        brainMode = 'manual';
        stopBtn.classList.add("hidden");
        // Give the loop a short moment to resolve if it's currently running
        setTimeout(() => {
            saveBrainState();
            brainIndicator.innerText = "Learning Stopped & Saved";
            brainIndicator.className = "value active";
            saveMapBtn.classList.remove("hidden"); // Also show here if manually stopped
        }, 100);
    });

    // Destination Picking Logic
    const setDestBtn = document.getElementById("btn-set-destination");
    const brainHeader = document.querySelector("#brain-controls h3");
    let pickingMode = false;

    if (brainHeader) {
        brainHeader.style.cursor = "pointer";
        brainHeader.addEventListener("click", () => setDestBtn.click());
        brainHeader.title = "Click to set custom destination";
    }

    setDestBtn.addEventListener("click", () => {
        pickingMode = !pickingMode;
        if (pickingMode) {
            setDestBtn.innerText = "Click on Map to Set...";
            setDestBtn.className = "warning";
            brainIndicator.innerText = "Waiting for Destination...";
            canvas.style.cursor = "crosshair";
        } else {
            setDestBtn.innerText = "Set Custom Destination";
            setDestBtn.className = "secondary";
            canvas.style.cursor = "default";
        }
    });

    scene.onPointerDown = (evt, pickResult) => {
        if (pickingMode && pickResult.hit && (pickResult.pickedMesh.name.includes("floor") || pickResult.pickedMesh.name.includes("ground"))) {
            const pickedPoint = pickResult.pickedPoint;
            
            // Check if there is a brain and if the point is reachable
            // navigateTo handles the pathfinding inside itself but we need an explicit check for the alert
            const tempBrain = navigateTo.brain || null; // Accessing the hidden brain or findPath from library
            
            // Actually, we can just attempt to start navigation and check if it fails the pathfinding step early
            // But the user wants an alert if "learned cannot go there".
            // Since navigateTo currently just returns false if no path, I'll need to expose findPath or check inside.
            
            // Let's modify brain.js to export findPath if we need it, or just use brain.grid/findPath if accessible.
            // Wait, brain.js exports initBrain but brain itself is local to brain.js module.
            // Oh, wait, the brain instance is local to brain.js.
            // I should modify brain.js to export a `checkReachability(targetPos)` function.
            
            // Let's first implement the logic calling a new function I'll add to brain.js.
            const result = isPointReachable(robot.position, pickedPoint);
            
            if (result) {
                currentTarget = new BABYLON.Vector3(pickedPoint.x, 0.4, pickedPoint.z);
                brainMode = 'auto-nav';
                robot.currentPath = null; // Clear path to force recalcs
                pickingMode = false;
                setDestBtn.innerText = "Set Custom Destination";
                setDestBtn.className = "secondary";
                canvas.style.cursor = "default";
                brainIndicator.innerText = "Propelling to Point...";
                brainIndicator.className = "value active";
            } else {
                alert("the learned cannot go there");
            }
        }
    };

    const unloadBtn = document.getElementById("btn-unload-brain");
    const modal = document.getElementById("model-selection-modal");
    const closeModalBtn = document.getElementById("close-modal");
    const modelList = document.getElementById("model-list");

    unloadBtn.addEventListener("click", () => {
        if (unloadBtn.innerText === "Unload Brain") {
            unloadBrain();
            brainIndicator.innerText = "Brain Unloaded";
            brainIndicator.className = "value idle";
            unloadBtn.innerText = "Load Brain";
            unloadBtn.className = "secondary";
        } else {
            // Open Modal
            modal.classList.add("open");
            populateModelList();
        }
    });

    closeModalBtn.addEventListener("click", () => {
        modal.classList.remove("open");
    });

    async function populateModelList() {
        modelList.innerHTML = '<p class="empty-msg">Scanning for models...</p>';
        
        try {
            const response = await fetch('/api/models');
            const models = await response.json();
            
            modelList.innerHTML = "";
            
            if (models.length === 0) {
                modelList.innerHTML = '<p class="empty-msg">No models found in folder "trained_models".</p>';
                return;
            }

            models.forEach(modelName => {
                const item = document.createElement("div");
                item.className = "model-item";
                item.innerHTML = `
                    <div class="icon">🧠</div>
                    <div class="name">${modelName}</div>
                `;
                item.onclick = async () => {
                    modal.classList.remove("open");
                    brainIndicator.innerText = `Loading ${modelName}...`;
                    try {
                        const response = await fetch(`./trained_models/${modelName}`);
                        const data = await response.json();
                        await initBrain(bounds, data);
                        brainIndicator.innerText = "Brain Loaded";
                        brainIndicator.className = "value active";
                        unloadBtn.innerText = "Unload Brain";
                        unloadBtn.className = "danger";
                    } catch (e) {
                        console.error("Failed to load model", e);
                        brainIndicator.innerText = "Load Failed";
                        brainIndicator.className = "value idle";
                    }
                };
                modelList.appendChild(item);
            });
        } catch (err) {
            console.error("Failed to fetch model list", err);
            modelList.innerHTML = '<p class="empty-msg">Error listing models.</p>';
        }
    }

    const inputMap = {};
    window.addEventListener("keydown", (e) => inputMap[e.key] = true);
    window.addEventListener("keyup", (e) => inputMap[e.key] = false);

    scene.onBeforeRenderObservable.add(() => {
        let moved = false;
        if (brainMode === 'manual') {
            const speed = 0.1;
            const rotSpeed = 0.05;
            const forward = robot.forward.scale(speed);
            if (inputMap["ArrowUp"]) { robot.moveWithCollisions(forward); moved = true; }
            if (inputMap["ArrowDown"]) { robot.moveWithCollisions(forward.scale(-1)); moved = true; }
            if (inputMap["ArrowLeft"]) { robot.rotation.y -= rotSpeed; moved = true; }
            if (inputMap["ArrowRight"]) { robot.rotation.y += rotSpeed; moved = true; }
        } else if (brainMode === 'auto-nav') {
            if (currentTarget) {
                const reached = navigateTo(robot, currentTarget, 0.12);
                moved = true;
                if (reached) {
                    brainMode = 'manual';
                    brainIndicator.innerText = "Destination Reached";
                    brainIndicator.className = "value active";
                    setTimeout(() => { brainIndicator.innerText = "Idle Brain"; brainIndicator.className = "value idle"; }, 3000);
                } else {
                    brainIndicator.innerText = "Navigating...";
                    brainIndicator.className = "value active";
                }
            }
        }

        if (moved) {
            posDisplay.innerText = `${robot.position.x.toFixed(1)}, ${robot.position.y.toFixed(1)}, ${robot.position.z.toFixed(1)}`;
        }
    });

    scene.collisionsEnabled = true;
    return { engine, scene };
};

const canvas = document.getElementById("renderCanvas");
const { engine, scene } = createScene(canvas);
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
