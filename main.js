import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { navigateTo, mapEnvironment, initBrain, saveBrainState, saveBrainToServer, unloadBrain, stopMapping, isPointReachable, getBrain } from './brain.js';

// Initialization
const createScene = (canvas) => {
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    // Initialize Brain (Asynchronously)
    // Scaling and Bounds
    const SCALE = 0.1;
    const bounds = { 
        minX: -7 * SCALE, 
        maxX: 24 * SCALE, 
        minZ: -7 * SCALE, 
        maxZ: 7 * SCALE 
    };
    
    // Attempt to load pre-trained map
    const loadBrain = async () => {
        try {
            const response = await fetch('./nslam_map_learned.json');
            if (response.ok) {
                const preTrainedData = await response.json();
                await initBrain(bounds, preTrainedData);
                const brain = getBrain();
                showSampledPoints(scene, brain);
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

    // Camera - Adjusted for a better overview of the entire room
    const sceneCenter = new BABYLON.Vector3(8.5 * SCALE, 0, 0);
    const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 1.5, Math.PI / 4.0, 90, sceneCenter, scene);
    camera.attachControl(canvas, true);
    camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 100;

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

    // Environment - Loaded from 3D File
    BABYLON.SceneLoader.ImportMeshAsync("", "./3d_model_files/", "3d room without cieling-from blender.glb", scene)
    .then((result) => {
        // Apply scaling and ensure room is at the origin
        if (result.meshes.length > 0) {
            const root = result.meshes[0];
            root.scaling.scaleInPlace(SCALE);
            root.position = new BABYLON.Vector3(0, 0, 0); // Move room to y=0
        }

        result.meshes.forEach(mesh => {
            // Enable collisions
            mesh.checkCollisions = true;
            
            // Optimization for static geometry
            if (mesh.freezeWorldMatrix) mesh.freezeWorldMatrix();
        });
        
        // Wait a frame for geometry to settle then snap robot
        setTimeout(snapToFloor, 500);
        console.log("3D Environment Loaded & Scaled Successfully at Y=0");
    })
    .catch(err => {
        console.error("Failed to load 3D file:", err);
    });


    // Robot & Control State
    let brainMode = 'manual';
    let currentTarget = null;

    // Robot
    const faceColors = new Array(6).fill(new BABYLON.Color4(1, 0.9, 0, 1)); // Bright Yellow (RGBA)
    faceColors[0] = new BABYLON.Color4(0.0, 0.0, 255, 0.30); // Front Face Blue (RGBA)

    const robotWidth = 0.8;
    const robotHeight = 1.0;
    const robotDepth = 0.6;

    const robot = BABYLON.MeshBuilder.CreateBox("robot", { 
        width: robotWidth, height: robotHeight, depth: robotDepth, 
        faceColors: faceColors 
    }, scene);
    
    // Position robot in a more centered open area (around midpoint of x bounds)
    robot.position = new BABYLON.Vector3(1.0, robotHeight / 2 + 0.1, 0); 
    robot.checkCollisions = true;
    robot.applyGravity = true; // Use built-in gravity
    robot.ellipsoid = new BABYLON.Vector3(robotWidth / 2, robotHeight / 2, robotDepth / 2);
    robot.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);
    robot.currentPath = null;

    // Apply a small downward force once to ensure it hits the floor
    // setTimeout(() => {
    //     robot.moveWithCollisions(new BABYLON.Vector3(0, -0.1, 0));
    // }, 500);

    // Body Material
    const robotMat = new BABYLON.StandardMaterial("robotMat", scene);
    robotMat.useVertexColors = true;
    robotMat.diffuseColor = new BABYLON.Color3(1, 1, 1); // Preserve vertex colors
    robotMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    robot.material = robotMat;

    // Function to snap robot to floor
    const snapToFloor = () => {
        const ray = new BABYLON.Ray(new BABYLON.Vector3(robot.position.x, 10, robot.position.z), new BABYLON.Vector3(0, -1, 0));
        const pick = scene.pickWithRay(ray, (m) => m !== robot && (m.name.includes("floor") || m.checkCollisions));
        if (pick.hit) {
            robot.position.y = pick.pickedPoint.y + robotHeight / 2 + 0.02; // Tiny gap to prevent sticking
            console.log("Robot snapped to floor at y:", robot.position.y);
        } else {
            console.warn("Floor not detected under robot during snap.");
        }
    };
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

    // 3D Map Visualization (Sampled Points)
    let sampledPointsContainer = null;
    const clearSampledPoints = () => {
        if (sampledPointsContainer) {
            sampledPointsContainer.dispose();
            sampledPointsContainer = null;
        }
    };

    const showSampledPoints = (scene, brain) => {
        clearSampledPoints();
        if (!brain) return;

        sampledPointsContainer = new BABYLON.TransformNode("sampledPointsContainer", scene);
        const gridData = brain.getGridData();
        const { grid } = gridData;

        // Optimized material for points
        const pointMat = new BABYLON.StandardMaterial("sampledPointMat", scene);
        pointMat.emissiveColor = new BABYLON.Color3(0, 1, 0.2);
        pointMat.diffuseColor = new BABYLON.Color3(0, 0.8, 0);
        pointMat.alpha = 0.6;

        const buttonMesh = BABYLON.MeshBuilder.CreateCylinder("sampledButton", {
            diameter: 0.3,
            height: 0.05
        }, scene);
        buttonMesh.material = pointMat;
        buttonMesh.parent = sampledPointsContainer;

        const matricesData = new Float32Array(grid.filter(val => val === 1).length * 16);
        let count = 0;

        for (let i = 0; i < grid.length; i++) {
            if (grid[i] === 1) { // Only show traversable points
                const pos = brain.getCoords(i);
                const matrix = BABYLON.Matrix.Translation(pos.x, 0.05, pos.z);
                matrix.copyToArray(matricesData, count * 16);
                count++;
            }
        }

        if (count > 0) {
            buttonMesh.thinInstanceSetBuffer("matrix", matricesData, 16);
        } else {
            buttonMesh.dispose();
        }
    };

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
        // Note: ROOM2_X is replaced with a fixed coordinate (17) suitable for the old layout.
        // You may need to update this to a safe coordinate in your 3D model.
        currentTarget = new BABYLON.Vector3(17 * SCALE, 0.4, 0); 
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

    saveMapBtn.addEventListener("click", async () => {
        const originalText = brainIndicator.innerText;
        brainIndicator.innerText = "Saving to Server...";
        const success = await saveBrainToServer();
        if (success) {
            brainIndicator.innerText = "Model Saved to Folder";
            brainIndicator.className = "value active";
        } else {
            brainIndicator.innerText = "Save Failed";
            brainIndicator.className = "value danger";
        }
        setTimeout(() => {
            brainIndicator.innerText = originalText;
            brainIndicator.className = "value active";
        }, 3000);
    });

    stopBtn.addEventListener("click", async () => {
        stopMapping();
        brainMode = 'manual';
        stopBtn.classList.add("hidden");
        // Give the loop a short moment to resolve if it's currently running
        setTimeout(async () => {
            await saveBrainToServer();
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
            clearSampledPoints();
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
                        const brain = getBrain();
                        showSampledPoints(scene, brain);
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
            const backward = robot.forward.scale(-speed);

            if (inputMap["ArrowUp"]) { robot.moveWithCollisions(forward); moved = true; }
            if (inputMap["ArrowDown"]) { robot.moveWithCollisions(backward); moved = true; }
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
            posDisplay.innerText = `${(robot.position.x / SCALE).toFixed(1)}, ${robot.position.y.toFixed(1)}, ${(robot.position.z / SCALE).toFixed(1)}`;
        }
    });

    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -0.05, 0); // Scale-appropriate gravity
    
    return { engine, scene };
};

const canvas = document.getElementById("renderCanvas");
const { engine, scene } = createScene(canvas);
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
