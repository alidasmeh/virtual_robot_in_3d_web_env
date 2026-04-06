# 🤖 Virtual Robot Mini-Sim

A 3D virtual robot simulator built with **BabylonJS** and **TensorFlow.js**. This project demonstrates a robot navigating a 3D home environment, learning from its surroundings, and planning paths using AI.

## ✨ Features

- **3D Environment**: A complete 3D home scene with physics, lighting, and materials.
- **Robot Simulation**: A fully rigged and animated robot with realistic movement.
- **AI Navigation**: A "Brain" module that uses **A*** pathfinding and **TensorFlow.js** for environment mapping.
- **Autonomous Logic**:
  - **Explore & Map**: The robot explores the environment and builds a mental map.
  - **Navigate to Room**: The robot plans and executes a path to a specific destination.
- **Real-time Feedback**: Live status updates, position tracking, and brain activity indicators.
- **Physics-Based Interaction**: Realistic collisions and movement using Cannon.js.

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (or yarn)

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd virtual_robot_in_3d_web_env
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

## 🎮 Controls

### Manual Navigation

Use the keyboard arrows to control the robot:

- **▲**: Forward
- **▼**: Backward
- **◄**: Left
- **►**: Right

### Camera Controls

- **Mouse Drag**: Rotate the camera
- **Mouse Wheel**: Zoom in/out
- **WASD**: Move camera

### Autonomous Controls

- **Explore & Map**: The robot will start exploring the environment and mapping obstacles.
- **Navigate to Room 2**: The robot will plan a path to the second room and navigate to it.

## 🏗️ Architecture

### Core Modules

- **`main.js`**: Entry point, scene setup, and event handling.
- **`robot.js`**: Robot class, animation, and physics.
- **`brain.js`**: AI logic, pathfinding, and environment mapping.
- **`scene.js`**: 3D environment creation and asset management.

### AI & Machine Learning

The `brain.js` module uses:

- **A* Algorithm**: For pathfinding between waypoints.
- **Neural SLAM (Simplified)**: Inspired by [Cognitive Mapper and Planner](https://arxiv.org/abs/1706.09520) (Gupta et al., 2017), this project uses a hybrid approach. It maintains a spatial memory (Grid Map) that is updated as the agent explores, coupled with a neural world model that learns to predict the traversability of unseen nodes.
- **TensorFlow.js**: Used for the "World Model" neural network, learning to map (x, z) coordinates to reachability scores.
- **Grid-Based Mapping**: The environment is discretized for efficient path planning and memory management.




## 🛠️ Development

### Adding New Assets

To add new 3D models:

1.  Place your `.glb` or `.gltf` files in the `public/assets/` directory.
2.  Update the `loadAssets` function in `scene.js` to register the new model.
3.  Use the `createMesh` helper to instantiate the model in the scene.

### Extending the Brain

To improve the AI:

1.  Modify `brain.js` to add more sophisticated learning algorithms.
2.  Update `scene.js` to provide richer sensor data (e.g., distance to obstacles).
3.  Enhance the pathfinding algorithm with heuristics for better performance.