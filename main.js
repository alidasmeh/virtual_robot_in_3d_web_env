import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

// Define the environment dimensions
const ROOM_WIDTH = 12;
const ROOM_DEPTH = 12;
const WALL_HEIGHT = 4;

const createScene = (canvas) => {
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    // Camera
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 25, new BABYLON.Vector3(8.5, 0, 0), scene);
    camera.attachControl(canvas, true);
    // Remove default arrow-key mapping for camera movement (reserved for robot)
    camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 60;

    // Light
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 5, 0), scene);
    light.intensity = 0.7;

    const pointLight = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(0, 3, 0), scene);
    pointLight.intensity = 0.5;

    // Materials
    const floorMat = new BABYLON.StandardMaterial("floorMat", scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
    floorMat.specularColor = new BABYLON.Color3(0, 0, 0);

    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    wallMat.alpha = 0.9;

    const tableMat = new BABYLON.StandardMaterial("tableMat", scene);
    tableMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.1);

    const seatMat = new BABYLON.StandardMaterial("seatMat", scene);
    seatMat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.7);

    const bedFrameMat = new BABYLON.StandardMaterial("bedFrameMat", scene);
    bedFrameMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1);
    
    const mattressMat = new BABYLON.StandardMaterial("mattressMat", scene);
    mattressMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    
    const pillowMat = new BABYLON.StandardMaterial("pillowMat", scene);
    pillowMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 1);

    // Environment Constants
    const CORRIDOR_WIDTH = 2.4; 
    const CORRIDOR_LENGTH = 5; // A bit of distance
    const ROOM2_X = ROOM_WIDTH + CORRIDOR_LENGTH;

    // Floor 1
    const floor1 = BABYLON.MeshBuilder.CreateGround("floor1", { width: ROOM_WIDTH, height: ROOM_DEPTH }, scene);
    floor1.material = floorMat;
    floor1.checkCollisions = true;

    // Corridor Floor
    const corridorFloor = BABYLON.MeshBuilder.CreateGround("corridorFloor", { width: CORRIDOR_LENGTH, height: CORRIDOR_WIDTH }, scene);
    corridorFloor.position.x = ROOM_WIDTH / 2 + CORRIDOR_LENGTH / 2;
    corridorFloor.material = floorMat;
    corridorFloor.checkCollisions = true;

    // Floor 2
    const floor2 = BABYLON.MeshBuilder.CreateGround("floor2", { width: ROOM_WIDTH, height: ROOM_DEPTH }, scene);
    floor2.position.x = ROOM2_X;
    floor2.material = floorMat;
    floor2.checkCollisions = true;

    // Walls
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
    
    // Room 1 Right Wall (with opening)
    const sideWallWidth = (ROOM_DEPTH - CORRIDOR_WIDTH) / 2;
    createWall("wallRight1_Part1", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + sideWallWidth/2), Math.PI / 2);
    createWall("wallRight1_Part2", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM_WIDTH/2, WALL_HEIGHT/2, ROOM_DEPTH/2 - sideWallWidth/2), Math.PI / 2);
    createWall("wallRight1_Top", CORRIDOR_WIDTH, WALL_HEIGHT - 2.5, new BABYLON.Vector3(ROOM_WIDTH/2, 2.5 + (WALL_HEIGHT - 2.5)/2, 0), Math.PI / 2);

    // Corridor Walls
    createWall("wallCorridorBack", CORRIDOR_LENGTH, WALL_HEIGHT-1, new BABYLON.Vector3(ROOM_WIDTH/2 + CORRIDOR_LENGTH/2, (WALL_HEIGHT-1)/2, CORRIDOR_WIDTH/2));
    createWall("wallCorridorFront", CORRIDOR_LENGTH, WALL_HEIGHT-1, new BABYLON.Vector3(ROOM_WIDTH/2 + CORRIDOR_LENGTH/2, (WALL_HEIGHT-1)/2, -CORRIDOR_WIDTH/2));

    // Room 2 Walls
    createWall("wallBack2", ROOM_WIDTH, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X, WALL_HEIGHT / 2, ROOM_DEPTH / 2));
    createWall("wallFront2", ROOM_WIDTH, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X, WALL_HEIGHT / 2, -ROOM_DEPTH / 2));
    createWall("wallRight2", ROOM_DEPTH, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X + ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0), Math.PI / 2);

    // Room 2 Left Wall (with opening)
    createWall("wallLeft2_Part1", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X - ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + sideWallWidth/2), Math.PI / 2);
    createWall("wallLeft2_Part2", sideWallWidth, WALL_HEIGHT, new BABYLON.Vector3(ROOM2_X - ROOM_WIDTH/2, WALL_HEIGHT/2, ROOM_DEPTH/2 - sideWallWidth/2), Math.PI / 2);
    createWall("wallLeft2_Top", CORRIDOR_WIDTH, WALL_HEIGHT - 2.5, new BABYLON.Vector3(ROOM2_X - ROOM_WIDTH/2, 2.5 + (WALL_HEIGHT - 2.5)/2, 0), Math.PI / 2);

    // (Door removed to make way for corridor)

    // Table
    const tableTop = BABYLON.MeshBuilder.CreateBox("tableTop", { width: 3, height: 0.1, depth: 2 }, scene);
    tableTop.position = new BABYLON.Vector3(0, 0.9, 0);
    tableTop.material = tableMat;
    tableTop.checkCollisions = true;

    const tableLeg1 = BABYLON.MeshBuilder.CreateBox("tableLeg1", { width: 0.1, height: 0.9, depth: 0.1 }, scene);
    tableLeg1.position = new BABYLON.Vector3(1.4, 0.45, 0.9);
    tableLeg1.material = tableMat;
    tableLeg1.checkCollisions = true;

    const tableLeg2 = BABYLON.MeshBuilder.CreateBox("tableLeg2", { width: 0.1, height: 0.9, depth: 0.1 }, scene);
    tableLeg2.position = new BABYLON.Vector3(-1.4, 0.45, 0.9);
    tableLeg2.material = tableMat;
    tableLeg2.checkCollisions = true;

    const tableLeg3 = BABYLON.MeshBuilder.CreateBox("tableLeg3", { width: 0.1, height: 0.9, depth: 0.1 }, scene);
    tableLeg3.position = new BABYLON.Vector3(1.4, 0.45, -0.9);
    tableLeg3.material = tableMat;
    tableLeg3.checkCollisions = true;

    const tableLeg4 = BABYLON.MeshBuilder.CreateBox("tableLeg4", { width: 0.1, height: 0.9, depth: 0.1 }, scene);
    tableLeg4.position = new BABYLON.Vector3(-1.4, 0.45, -0.9);
    tableLeg4.material = tableMat;
    tableLeg4.checkCollisions = true;

    // Seats (2 sits)
    const createSeat = (name, pos) => {
        const seatBase = BABYLON.MeshBuilder.CreateBox(name + "Base", { width: 0.8, height: 0.5, depth: 0.8 }, scene);
        seatBase.position = pos;
        seatBase.material = seatMat;
        seatBase.checkCollisions = true;
        
        const seatBack = BABYLON.MeshBuilder.CreateBox(name + "Back", { width: 0.8, height: 0.8, depth: 0.1 }, scene);
        seatBack.position = new BABYLON.Vector3(pos.x, pos.y + 0.6, pos.z + (pos.z > 0 ? 0.35 : -0.35));
        seatBack.material = seatMat;
        seatBack.checkCollisions = true;
    };

    createSeat("seat1", new BABYLON.Vector3(2.5, 0.25, 0));
    createSeat("seat2", new BABYLON.Vector3(-2.5, 0.25, 0));

    // Room 2 Furniture: Bed in the corner
    const createBed = (name, position) => {
        const frame = BABYLON.MeshBuilder.CreateBox(name + "Frame", { width: 4, height: 0.4, depth: 2.5 }, scene);
        frame.position = new BABYLON.Vector3(position.x, 0.2, position.z);
        frame.material = bedFrameMat;
        frame.checkCollisions = true;

        const mattress = BABYLON.MeshBuilder.CreateBox(name + "Mattress", { width: 3.8, height: 0.4, depth: 2.3 }, scene);
        mattress.position = new BABYLON.Vector3(position.x, 0.6, position.z);
        mattress.material = mattressMat;
        mattress.checkCollisions = true;

        const pillow = BABYLON.MeshBuilder.CreateBox(name + "Pillow", { width: 0.8, height: 0.2, depth: 1.5 }, scene);
        pillow.position = new BABYLON.Vector3(position.x + 1.3, 0.8, position.z);
        pillow.material = pillowMat;
        
        return frame;
    };

    createBed("bed1", new BABYLON.Vector3(ROOM2_X + 3.5, 0, ROOM_DEPTH / 2 - 1.5));

    // Simple Robot
    const robot = BABYLON.MeshBuilder.CreateBox("robot", { size: 0.6 }, scene);
    robot.position = new BABYLON.Vector3(ROOM_WIDTH / 2 - 0.3, 0.3, 0);
    robot.rotation.y = -Math.PI / 2; // Face towards the center of the room
    const robotMat = new BABYLON.StandardMaterial("robotMat", scene);
    robotMat.diffuseColor = new BABYLON.Color3(0, 243 / 255, 1); // Neon blue
    robotMat.emissiveColor = new BABYLON.Color3(0, 0.2, 0.3);
    robot.material = robotMat;
    robot.checkCollisions = true;
    robot.ellipsoid = new BABYLON.Vector3(0.3, 0.3, 0.3);

    // Robot Eyes
    const eye1 = BABYLON.MeshBuilder.CreateSphere("eye1", { diameter: 0.12 }, scene);
    eye1.parent = robot;
    eye1.position = new BABYLON.Vector3(0.15, 0.1, 0.3);
    const eyeMat = new BABYLON.StandardMaterial("eyeMat", scene);
    eyeMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    eye1.material = eyeMat;

    const eye2 = BABYLON.MeshBuilder.CreateSphere("eye2", { diameter: 0.12 }, scene);
    eye2.parent = robot;
    eye2.position = new BABYLON.Vector3(-0.15, 0.1, 0.3);
    eye2.material = eyeMat;

    // Movement logic
    const inputMap = {};
    window.addEventListener("keydown", (evt) => {
        inputMap[evt.key] = true;
    });
    window.addEventListener("keyup", (evt) => {
        inputMap[evt.key] = false;
    });

    const robotSpeed = 0.1;
    const robotRotationSpeed = 0.05;

    const posDisplay = document.getElementById("robot-pos");
    posDisplay.innerText = `${robot.position.x.toFixed(1)}, ${robot.position.y.toFixed(1)}, ${robot.position.z.toFixed(1)}`;

    scene.onBeforeRenderObservable.add(() => {
        let moved = false;
        const forward = robot.forward.scaleInPlace(robotSpeed);
        
        if (inputMap["ArrowUp"]) {
            robot.moveWithCollisions(forward);
            moved = true;
        }
        if (inputMap["ArrowDown"]) {
            robot.moveWithCollisions(forward.scale(-1));
            moved = true;
        }
        if (inputMap["ArrowLeft"]) {
            robot.rotation.y -= robotRotationSpeed;
            moved = true;
        }
        if (inputMap["ArrowRight"]) {
            robot.rotation.y += robotRotationSpeed;
            moved = true;
        }

        if (moved) {
            posDisplay.innerText = `${robot.position.x.toFixed(1)}, ${robot.position.y.toFixed(1)}, ${robot.position.z.toFixed(1)}`;
        }
    });

    // Camera & Viewport Sync
    const camDistInput = document.getElementById("cam-dist");
    const camAlphaInput = document.getElementById("cam-alpha");
    const camBetaInput = document.getElementById("cam-beta");

    // When user types in inputs, update camera
    camDistInput.addEventListener("input", (e) => { camera.radius = parseFloat(e.target.value) || camera.radius; });
    camAlphaInput.addEventListener("input", (e) => { camera.alpha = parseFloat(e.target.value) || camera.alpha; });
    camBetaInput.addEventListener("input", (e) => { camera.beta = parseFloat(e.target.value) || camera.beta; });

    // When user moves camera with mouse, update inputs
    camera.onViewMatrixChangedObservable.add(() => {
      // Avoid updating inputs if the user is currently typing in them
      if (document.activeElement.tagName !== "INPUT") {
        camDistInput.value = camera.radius.toFixed(1);
        camAlphaInput.value = camera.alpha.toFixed(2);
        camBetaInput.value = camera.beta.toFixed(2);
      }
    });

    // Scene Physics/Collisions
    scene.collisionsEnabled = true;

    return { engine, scene };
};

const canvas = document.getElementById("renderCanvas");
const { engine, scene } = createScene(canvas);

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});
