import * as tf from "@tensorflow/tfjs";
import * as BABYLON from "babylonjs";

let brain;
let mappingActive = false;

/**
 * GridBrain handles the mapping and pathfinding logic.
 * It uses a grid-based representation for pathfinding and a TF.js model
 * to "learn" and predict environment features.
 */
class GridBrain {
  constructor(bounds, gridSize = 0.5) {
    this.bounds = bounds;
    this.gridSize = gridSize;
    this.width = Math.ceil((bounds.maxX - bounds.minX) / gridSize);
    this.depth = Math.ceil((bounds.maxZ - bounds.minZ) / gridSize);

    // Map data: 0 = unvisited, 1 = traversable, -1 = obstacle
    this.grid = new Int8Array(this.width * this.depth);

    // TF.js Model to "learn" the environment
    this.model = this.createModel();
    this.trainingData = [];
  }

  /**
   * Exports the current brain state (grid + model) to a JSON-serializable object.
   */
  async exportState() {
    const modelSaveResult = await this.model.save(
      tf.io.withSaveHandler(async (artifacts) => artifacts),
    );

    // Convert model weights (ArrayBuffer) to Base64 for JSON storage
    const weightData = btoa(
      String.fromCharCode(...new Uint8Array(modelSaveResult.weightData)),
    );

    return {
      bounds: this.bounds,
      gridSize: this.gridSize,
      grid: Array.from(this.grid), // Convert Int8Array to regular array
      modelTopology: modelSaveResult.modelTopology,
      weightSpecs: modelSaveResult.weightSpecs,
      weightData: weightData,
      trainingData: this.trainingData,
    };
  }

  /**
   * Imports a previously exported state.
   */
  async importState(state) {
    this.bounds = state.bounds;
    this.gridSize = state.gridSize;
    this.width = Math.ceil(
      (this.bounds.maxX - this.bounds.minX) / this.gridSize,
    );
    this.depth = Math.ceil(
      (this.bounds.maxZ - this.bounds.minZ) / this.gridSize,
    );

    this.grid = new Int8Array(state.grid);
    this.trainingData = state.trainingData || [];

    // Load the model weights if they exist, otherwise keep the initialized model
    if (state.modelTopology && state.weightData) {
      try {
        const weightData = new Uint8Array(
          atob(state.weightData)
            .split("")
            .map((c) => c.charCodeAt(0)),
        ).buffer;

        this.model = await tf.loadLayersModel(
          tf.io.fromMemory({
            modelTopology: state.modelTopology,
            weightSpecs: state.weightSpecs,
            weightData: weightData,
          }),
        );

        this.model.compile({
          optimizer: tf.train.adam(0.01),
          loss: "binaryCrossentropy",
        });
        console.log("Neural model imported successfully.");
      } catch (e) {
        console.warn(
          "Found model data but failed to load it. Re-initializing model.",
          e,
        );
        this.model = this.createModel();
      }
    } else {
      console.log("No neural model data found. Initialized with fresh model.");
    }

    console.log("Brain state imported successfully.");
  }

  createModel() {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({ units: 16, activation: "relu", inputShape: [2] }),
    );
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" })); // Predicts "is traversable"

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: "binaryCrossentropy",
    });
    return model;
  }

  getGridIndex(x, z) {
    const ix = Math.floor((x - this.bounds.minX) / this.gridSize);
    const iz = Math.floor((z - this.bounds.minZ) / this.gridSize);
    if (ix < 0 || ix >= this.width || iz < 0 || iz >= this.depth) return -1;
    return ix + iz * this.width;
  }

  getCoords(index) {
    const ix = index % this.width;
    const iz = Math.floor(index / this.width);
    return {
      x: ix * this.gridSize + this.bounds.minX + this.gridSize / 2,
      z: iz * this.gridSize + this.bounds.minZ + this.gridSize / 2,
    };
  }

  /**
   * Updates the map with a new observation.
   */
  async learn(x, z, isTraversable) {
    const idx = this.getGridIndex(x, z);
    if (idx === -1) return;

    this.grid[idx] = isTraversable ? 1 : -1;

    // Push to training data for the neural model
    this.trainingData.push({ input: [x, z], output: [isTraversable ? 1 : 0] });

    // Randomly train on a batch to simulate "learning"
    if (this.trainingData.length % 50 === 0) {
      this.trainModel();
    }
  }

  async trainModel() {
    if (this.trainingData.length < 10) return;
    const inputs = tf.tensor2d(this.trainingData.map((d) => d.input));
    const outputs = tf.tensor2d(this.trainingData.map((d) => d.output));

    await this.model.fit(inputs, outputs, {
      epochs: 5,
      batchSize: 32,
      verbose: 0,
    });

    inputs.dispose();
    outputs.dispose();
    console.log("Brain model updated with new experiences.");
  }

  /**
   * A* Pathfinding implementation
   */
  findPath(startPos, targetPos) {
    const startIdx = this.getGridIndex(startPos.x, startPos.z);
    const endIdx = this.getGridIndex(targetPos.x, targetPos.z);

    if (startIdx === -1 || endIdx === -1) {
      console.warn(
        `Pathfinding failed: Start or End index out of bounds. Start: ${startIdx}, End: ${endIdx}`,
      );
      return null;
    }

    if (this.grid[startIdx] !== 1)
      console.warn(
        `Pathfinding warning: Start cell is not marked as traversable (${this.grid[startIdx]})`,
      );
    if (this.grid[endIdx] !== 1) {
      console.error(
        `Pathfinding error: Target cell is not marked as traversable (${this.grid[endIdx]})`,
      );
      return null;
    }

    const openSet = [startIdx];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startIdx, 0);
    fScore.set(startIdx, this.heuristic(startIdx, endIdx));

    while (openSet.length > 0) {
      // Get node with lowest fScore
      openSet.sort(
        (a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity),
      );
      const current = openSet.shift();

      if (current === endIdx) {
        return this.reconstructPath(cameFrom, current);
      }

      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        // Only allow traversing cells explicitly marked as traversable (1)
        if (this.grid[neighbor] !== 1) continue;

        const tentativeGScore = gScore.get(current) + 1;
        if (tentativeGScore < (gScore.get(neighbor) ?? Infinity)) {
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, tentativeGScore);
          fScore.set(
            neighbor,
            tentativeGScore + this.heuristic(neighbor, endIdx),
          );
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    return null;
  }

  heuristic(a, b) {
    const posA = this.getCoords(a);
    const posB = this.getCoords(b);
    return Math.abs(posA.x - posB.x) + Math.abs(posA.z - posB.z);
  }

  getNeighbors(index) {
    const ix = index % this.width;
    const iz = Math.floor(index / this.width);
    const neighbors = [];

    if (ix > 0) neighbors.push(index - 1);
    if (ix < this.width - 1) neighbors.push(index + 1);
    if (iz > 0) neighbors.push(index - this.width);
    if (iz < this.depth - 1) neighbors.push(index + this.width);

    return neighbors;
  }

  reconstructPath(cameFrom, current) {
    const path = [this.getCoords(current)];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(this.getCoords(current));
    }
    return path;
  }

  /**
   * Finds the closest sampled (traversable) cell to a given position.
   */
  findClosestSampledPosition(targetPos) {
    const targetIdx = this.getGridIndex(targetPos.x, targetPos.z);
    if (targetIdx !== -1 && this.grid[targetIdx] === 1) return targetPos;

    let closestIdx = -1;
    let minDistance = Infinity;

    // Simple exhaust search for demo; for large grids, use a more efficient approach
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === 1) {
        const pos = this.getCoords(i);
        const dist = Math.sqrt(
          Math.pow(pos.x - targetPos.x, 2) + Math.pow(pos.z - targetPos.z, 2),
        );
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }
    }

    return closestIdx !== -1 ? this.getCoords(closestIdx) : null;
  }

  getGridData() {
    return {
      grid: this.grid,
      width: this.width,
      depth: this.depth,
    };
  }
}

export async function initBrain(bounds, preTrainedData = null) {
  brain = new GridBrain(bounds);
  if (preTrainedData) {
    await brain.importState(preTrainedData);
  }
  return brain;
}

export function getBrain() {
  return brain;
}

export async function saveBrainState() {
  if (!brain) return;
  const state = await brain.exportState();
  const dataStr =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    "model_2026-04-06T19-16-54-453Z.json",
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

/**
 * Saves the model state to the server's trained_models folder.
 */
export async function saveBrainToServer(customName = null) {
  if (!brain) return false;

  try {
    const state = await brain.exportState();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = customName || `model_${timestamp}.json`;

    const response = await fetch("/api/save-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, state }),
    });

    if (response.ok) {
      console.log(`Model saved to server as ${fileName}`);
      return true;
    } else {
      const error = await response.json();
      throw new Error(error.message || "Server error");
    }
  } catch (err) {
    console.error("Failed to save map to server:", err);
    return false;
  }
}

export function unloadBrain() {
  if (brain) {
    if (brain.model) {
      brain.model.dispose();
    }
    brain = null;
    console.log("Brain model unloaded.");
  }
}

/**
 * Main navigation loop that handles the path following
 */
export function navigateTo(robot, targetPos, speed = 0.1) {
  if (!brain) return false;

  // Check if we already have a path or if we are continuing towards an original target
  if (!robot.currentPath || robot.currentPath.length === 0) {
    // If target is unvisited or an obstacle, find nearest sampled traversable point
    const targetIdx = brain.getGridIndex(targetPos.x, targetPos.z);
    let actualTarget = targetPos;

    if (targetIdx === -1 || brain.grid[targetIdx] !== 1) {
      console.log(
        "Target is not in learned map or not traversable. Finding closest known position...",
      );
      actualTarget = brain.findClosestSampledPosition(targetPos);

      if (!actualTarget) {
        console.log(
          "No sampled positions found in brain yet. Attempting direct move...",
        );
        actualTarget = targetPos;
        robot.originalTarget = targetPos;
      } else {
        // Store original target to continue after reaching sampled point
        robot.originalTarget = targetPos;
      }
    } else {
      robot.originalTarget = null;
    }

    robot.currentPath = brain.findPath(robot.position, actualTarget);

    // If still no path (maybe start point is islanded), try to find a path from closest sampled start
    if (!robot.currentPath) {
      console.warn(
        "No path found to target from current position. Checking if robot itself is in unknown territory...",
      );
      const startIdx = brain.getGridIndex(robot.position.x, robot.position.z);
      if (startIdx === -1 || brain.grid[startIdx] !== 1) {
        const nearestSampled = brain.findClosestSampledPosition(robot.position);
        if (nearestSampled) {
          robot.currentPath = [nearestSampled]; // Move back to map
        }
      }
    }

    if (!robot.currentPath || robot.currentPath.length === 0) {
      // Already there or no path found
      if (robot.originalTarget) {
        console.log(
          "Already at closest sampled point. Moving towards original target...",
        );
        // We're at the closest sampled point, now move directly to original
        const directionToOriginal = robot.originalTarget.subtract(
          robot.position,
        );
        directionToOriginal.y = 0;
        if (directionToOriginal.length() < 0.3) {
          robot.originalTarget = null;
          return true;
        }
        const moveVector = directionToOriginal.normalize().scale(speed);
        const prevPos = robot.position.clone();
        robot.moveWithCollisions(moveVector);

        const movedDist = BABYLON.Vector3.Distance(prevPos, robot.position);
        const blocked = movedDist < speed * 0.5;

        // Learn as we go
        brain.learn(robot.position.x, robot.position.z, !blocked);
        if (blocked) {
          console.warn("Direct move blocked by object. Navigation aborted.");
          robot.originalTarget = null;
          return true; // Consider reached (or at least finished)
        }

        return false;
      }
      return true;
    }
  }

  const nextWaypoint = robot.currentPath[0];
  const target = new BABYLON.Vector3(
    nextWaypoint.x,
    robot.position.y,
    nextWaypoint.z,
  );
  const direction = target.subtract(robot.position);

  if (direction.length() < 0.3) {
    robot.currentPath.shift(); // Reached waypoint
    // If finished path but have an original target (unsampled), it will loop back and handle it above
    return false;
  }

  const moveVector = direction.normalize().scale(speed * 1.5); // "Quickly" move along known paths
  robot.moveWithCollisions(moveVector);

  // Rotate to face movement
  const targetRotation = Math.atan2(direction.x, direction.z);
  let rotationDiff = targetRotation - robot.rotation.y;
  while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
  while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
  robot.rotation.y += rotationDiff * 0.15;

  return false;
}

/**
 * Exploration behavior to map the environment
 */
export async function mapEnvironment(robot, scene, bounds) {
  if (!brain) await initBrain(bounds);
  mappingActive = true;

  console.log("Brain is scanning environment...");

  // Scan logic: perform a spiral or grid exploration
  // For this demo, we'll simulate a fast scan by checking collisions in the scene
  // but the robot will actually move to key points to "learn".

  // Dynamically calculate steps to keep density consistent but manageable
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;

  // Target one waypoint every ~0.6 units, with a floor of 20x20 density
  const divX = Math.max(20, Math.floor(width / 0.6));
  const divZ = Math.max(20, Math.floor(depth / 0.6));

  const stepX = width / divX;
  const stepZ = depth / divZ;
  console.log(
    `Mapping generated for ${width.toFixed(1)}x${depth.toFixed(1)} area with ${divX}x${divZ} resolution. total waypoints: ${divX * divZ}`,
  );
  const waypoints = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += stepX) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += stepZ) {
      waypoints.push(new BABYLON.Vector3(x, 0.5, z));
    }
  }

  // Shuffle waypoints for non-linear exploration
  waypoints.sort(() => Math.random() - 0.5);

  return new Promise((resolve) => {
    let currentWaypointIdx = 0;

    const scanLoop = () => {
      if (currentWaypointIdx >= waypoints.length || !mappingActive) {
        console.log(
          mappingActive ? "Mapping complete." : "Mapping stopped by user.",
        );
        mappingActive = false;
        resolve(true);
        return;
      }

      const target = waypoints[currentWaypointIdx];
      const direction = target.subtract(robot.position);
      direction.y = 0;

      if (direction.length() < 0.5) {
        currentWaypointIdx++;
        setTimeout(scanLoop, 10);
        return;
      }

      const moveVector = direction.normalize().scale(0.2);

      // Before moving, check if we're hitting something using a Ray (Sensor)
      const ray = new BABYLON.Ray(robot.position, moveVector, 0.6);
      const pick = scene.pickWithRay(
        ray,
        (m) => m !== robot && m.checkCollisions,
      );

      const blocked = pick.hit && pick.distance < 0.5;

      // Learn based on Ray sensor AND actual movement result
      const prevPos = robot.position.clone();
      robot.moveWithCollisions(moveVector);
      const moveDelta = BABYLON.Vector3.Distance(prevPos, robot.position);

      // If Ray sensor hit OR we didn't move much, it's an obstacle
      const actuallyBlocked = blocked || moveDelta < 0.05;
      brain.learn(robot.position.x, robot.position.z, !actuallyBlocked);

      if (actuallyBlocked) {
        // Mark specifically the hit point or slightly ahead as blocked
        const obstaclePoint = pick.hit
          ? pick.pickedPoint
          : robot.position.add(moveVector.normalize().scale(0.5));
        brain.learn(obstaclePoint.x, obstaclePoint.z, false);
        currentWaypointIdx++; // Skip this waypoint if blocked
      }

      requestAnimationFrame(scanLoop);
    };

    scanLoop();
  });
}

export function stopMapping() {
  mappingActive = false;
}

/**
 * Checks if a point is reachable using the learned map.
 * Returns true if a path exists.
 */
export function isPointReachable(startPos, targetPos) {
  if (!brain) return false;

  // Check if within brain's managed bounds (loose requirement)
  const targetIdx = brain.getGridIndex(targetPos.x, targetPos.z);

  // Explicitly unreachable if it's a known obstacle (-1)
  if (targetIdx !== -1 && brain.grid[targetIdx] === -1) {
    return false;
  }

  // Otherwise, allow attempting to reach it.
  // navigateTo will fallback to direct movement for unvisited areas (0)
  // or out-of-bounds clicks (targetIdx === -1).
  return true;
}
