import * as THREE from 'three';
import { TextGenerator } from './components/TextGenerator.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Engine3D {
  constructor(container) {
    this.container = container;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0d12);
    this.scene.fog = new THREE.Fog(0x0d0d12, 10, 50);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    
    // Initialize our Modular Components
    this.textGen = new TextGenerator(this.scene);
    this.gltfLoader = new GLTFLoader();
    this.activeModels = {}; // store loaded meshes by ID
    
    this.clock = new THREE.Clock();
    this.fpsElement = document.getElementById('fps-counter');
    this.frames = 0;
    this.prevTime = performance.now();
    
    // Resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    this.animate = this.animate.bind(this);
    this.animate();
  }

  setupLighting() {
    const ambientInfo = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientInfo);

    // Main controllable spotlight
    this.spotlight = new THREE.SpotLight(0xffffff, 2250);
    this.spotlight.position.set(5, 10, 10);
    this.spotlight.angle = Math.PI / 6;
    this.spotlight.penumbra = 0.5;
    this.spotlight.decay = 2;
    this.spotlight.distance = 50;
    this.scene.add(this.spotlight);

    // Warm gold fill light
    const fillLight = new THREE.DirectionalLight(0xDFAD4D, 1);
    fillLight.position.set(-5, 0, -5);
    this.scene.add(fillLight);
  }

  // --- Dynamic Model API ---
  loadModel(id, url, position = {x:0, y:0, z:0}, scale = 1.0) {
    if (this.activeModels[id]) return Promise.resolve(this.activeModels[id]); // already loaded

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, (gltf) => {
        const model = gltf.scene;
        model.position.set(position.x, position.y, position.z);
        model.scale.set(scale, scale, scale);
        
        // Ensure shadows
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        this.scene.add(model);
        this.activeModels[id] = model;
        console.log(`Model ${id} loaded successfully`);
        resolve(model);
      }, undefined, (error) => {
        console.error('An error happened loading GLTF:', error);
        
        // MOCK FALLBACK: If API fails or URL blocked, generate a crystal placeholder immediately
        // so video timeline logic never breaks during MVP testing!
        console.warn('Falling back to Procedural Mock Model...');
        const geo = new THREE.IcosahedronGeometry(1.5, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0xFAD67B, roughness: 0.1, metalness: 0.9 });
        const mockModel = new THREE.Mesh(geo, mat);
        mockModel.position.set(position.x, position.y, position.z);
        this.scene.add(mockModel);
        this.activeModels[id] = mockModel;
        resolve(mockModel);
      });
    });
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  updateFPS() {
    this.frames++;
    const time = performance.now();
    if (time >= this.prevTime + 1000) {
      if (this.fpsElement) {
        this.fpsElement.innerText = Math.round((this.frames * 1000) / (time - this.prevTime)) + ' FPS';
      }
      this.prevTime = time;
      this.frames = 0;
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Ensure camera always focuses on the origin during GSAP sweeps
    this.camera.lookAt(0, 0, 0);

    this.updateFPS();
    this.renderer.render(this.scene, this.camera);
  }
}
