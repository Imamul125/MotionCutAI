# MotionCutAI 🎬✨

**MotionCutAI** is an AI-powered, browser-native 3D motion graphics and timeline editor built for cinematic precision. It merges the capabilities of a Non-Linear Editor (NLE) with a high-performance WebGL 3D engine, enabling dynamic, script-to-video auto-generation.

![MotionCutAI UI](https://via.placeholder.com/800x450.png?text=MotionCutAI+WebGL+Editor)

## 🔥 Core Features

* **AI Script-to-Timeline Engine:** Type an ad script (e.g. *"Camera swoops in on titanium typography"*), and the engine will automatically parse the intent, inject the clips, and build the full GSAP animation sequence instantly.
* **Cinematic 3D Typography:** Native Three.js text geometries with PBR materials, glowing reflections, and high-intensity procedural SpotLighting.
* **Perfect GSAP State Syncing:** Drag timeline clips around and watch the fully-baked WebGL scene mathematically update in pure real-time. Unbreakable `.fromTo` Bezier camera chaining ensures smooth sweeps across infinite NLE cuts.
* **External `.glb` Integration:** Full architectural support for loading and orchestrating custom 3D models directly onto the timeline.

## 🛠 Tech Stack

* **Vite + Electron:** High-performance, lightweight web application foundation.
* **Three.js:** Pure WebGL rendering engine with physically-based lighting and shadow algorithms.
* **GSAP (GreenSock):** The industry standard for butter-smooth, mathematically linked timeline tweening.
* **Vanilla JavaScript:** A custom-built state management engine specifically optimized for 60fps timeline dragging without the overhead of heavy frameworks.

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/Imamul125/MotionCutAI.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Boot the development server:
   ```bash
   npm run dev
   ```
4. Access the editor locally via the provided Vite `localhost` portal or launch it natively via Electron (`npm start`).

## 🧠 Architecture Overview

`timeline.js` handles all state architecture. It takes physical DOM interactions (like extending a clip or moving a scrubber) and translates them into absolute sequence objects:
```javascript
{ type: "camera", startTime: 2.0, duration: 5.0, params: { x:5, y:-2, z:10 } }
```
When `rebuildGSAP()` fires, the WebGL state is safely zeroed-out, and the chronological array dynamically compiles into immutable, perfectly chained timeline tweens. 

---
*Built with passion for pushing the boundaries of WebGL Motion Graphics.*
