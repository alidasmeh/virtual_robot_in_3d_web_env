import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { navigateTo, mapEnvironment, initBrain, saveBrainState } from './brain.js';

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
            const response = await fetch('./nslam_map.json');
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
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 25, new BABYLON.Vector3(8.5, 0, 0), scene);
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

    // Robot
    const robot = BABYLON.MeshBuilder.CreateBox("robot", { size: 0.6 }, scene);
    robot.position = new BABYLON.Vector3(0, 0.4, 4);
    robot.checkCollisions = true;
    robot.ellipsoid = new BABYLON.Vector3(0.35, 0.35, 0.35);
    robot.currentPath = null;

    // UI
    const posDisplay = document.getElementById("robot-pos");
    const brainIndicator = document.getElementById("brain-indicator");
    let brainMode = 'manual';
    let currentTarget = null;

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
        
        await mapEnvironment(robot, scene, bounds);
        
        brainMode = 'manual';
        brainIndicator.innerText = "Brain Ready";
        brainIndicator.className = "value active";
    });

    document.getElementById("btn-save-map").addEventListener("click", () => {
        saveBrainState();
    });

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
