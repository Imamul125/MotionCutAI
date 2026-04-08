import * as THREE from 'three';
import { TextGenerator } from './components/TextGenerator.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

    // --- OrbitControls: orbit, pan, zoom directly in the viewport ---
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    this.controls.panSpeed = 0.8;
    this.controls.zoomSpeed = 1.2;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 100;
    this.controls.target.set(0, 0, 0);
    this.controls.enabled = true;

    // Explicit mouse button mapping: Left=Orbit, Middle=Zoom, Right=Pan
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };

    // Prevent browser context menu so right-click drag always works for panning
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mode flag: 'edit' = OrbitControls active, 'play' = GSAP drives camera
    this.interactionMode = 'edit';
    
    // Initialize our Modular Components
    this.textGen = new TextGenerator(this.scene);
    this.gltfLoader = new GLTFLoader();
    this.activeModels = {}; // store loaded meshes by ID
    
    // --- Scene Objects Management ---
    this.sceneObjects = []; // { id, type:'text'|'model', name, mesh }
    this.sceneObjectIdCounter = 0;
    this.selectedObjectId = null;

    // Register the initial text as a scene object
    // (TextGenerator creates it async, so we listen for it)
    document.addEventListener('textMeshReady', () => {
      if (this.textGen.currentTextMesh && !this.sceneObjects.find(o => o.id === 'text-0')) {
        this.sceneObjects.push({
          id: 'text-0',
          type: 'text',
          name: 'LUMINOUS',
          mesh: this.textGen.currentTextMesh,
        });
        this.selectedObjectId = 'text-0';
        document.dispatchEvent(new Event('sceneObjectsChanged'));
      }
    });

    // Dynamic lookAt target (can be overridden by camera transitions)
    this.cameraLookAt = new THREE.Vector3(0, 0, 0);

    this.clock = new THREE.Clock();
    this.fpsElement = document.getElementById('fps-counter');
    this.frames = 0;
    this.prevTime = performance.now();
    
    // Resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    this.animate = this.animate.bind(this);
    this.animate();
  }

  // --- Scene Object API ---
  addText(text = 'NEW TEXT', position = { x: 0, y: 2, z: 0 }) {
    const id = `text-${++this.sceneObjectIdCounter}`;
    const textGen = new TextGenerator(this.scene);
    // TextGenerator loads font in constructor; once ready, it creates a mesh.
    // We poll and then update the text + position.

    // Wait for font to load, then set text and position
    const checkReady = setInterval(() => {
      if (textGen.currentTextMesh) {
        clearInterval(checkReady);
        textGen.updateText(text); // Set the actual text content
        textGen.currentTextMesh.position.set(position.x, position.y, position.z);
        const obj = { id, type: 'text', name: text, mesh: textGen.currentTextMesh, textGen };
        this.sceneObjects.push(obj);
        this.selectedObjectId = id;
        document.dispatchEvent(new Event('sceneObjectsChanged'));
      }
    }, 100);
    return id;
  }

  addPrimitive(shape = 'cube', position = { x: 0, y: 0, z: 0 }) {
    const id = `model-${++this.sceneObjectIdCounter}`;
    let geo;
    const name = shape.charAt(0).toUpperCase() + shape.slice(1);
    
    switch (shape) {
      case 'sphere':
        geo = new THREE.SphereGeometry(1, 32, 32);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(1, 0.3, 16, 48);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(0.8, 2, 32);
        break;
      case 'cube':
      default:
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        break;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0xFAD67B,
      roughness: 0.15,
      metalness: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const obj = { id, type: 'model', name, mesh };
    this.sceneObjects.push(obj);
    this.selectedObjectId = id;
    document.dispatchEvent(new Event('sceneObjectsChanged'));
    return id;
  }

  removeSceneObject(id) {
    const idx = this.sceneObjects.findIndex(o => o.id === id);
    if (idx === -1) return;
    const obj = this.sceneObjects[idx];
    this.scene.remove(obj.mesh);
    if (obj.mesh.geometry) obj.mesh.geometry.dispose();
    this.sceneObjects.splice(idx, 1);
    if (this.selectedObjectId === id) {
      this.selectedObjectId = this.sceneObjects.length > 0 ? this.sceneObjects[0].id : null;
    }
    document.dispatchEvent(new Event('sceneObjectsChanged'));
  }

  getObjectById(id) {
    return this.sceneObjects.find(o => o.id === id);
  }

  importModelFromFile(file) {
    const id = `model-${++this.sceneObjectIdCounter}`;
    const name = file.name.replace(/\.[^/.]+$/, '');
    const ext = file.name.split('.').pop().toLowerCase();

    const onModelLoaded = (gltf) => {
      const model = gltf.scene;

      // Auto-scale to reasonable size
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const targetSize = 3;
        const scale = targetSize / maxDim;
        model.scale.multiplyScalar(scale);
      }

      // Center the model
      const center = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getCenter(center);
      model.position.sub(center);

      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      this.scene.add(model);
      const obj = { id, type: 'model', name, mesh: model };
      this.sceneObjects.push(obj);
      this.selectedObjectId = id;
      document.dispatchEvent(new Event('sceneObjectsChanged'));
      console.log(`Imported model: ${name}`);
    };

    const onError = (error) => {
      console.error('Import error:', error);
      if (ext === 'gltf') {
        alert(
          `Failed to import "${file.name}".\n\n` +
          `.gltf files often reference external .bin and texture files that can't be loaded from a file picker.\n\n` +
          `Solution: Use .glb format instead (single self-contained file).`
        );
      } else {
        alert(`Failed to import "${file.name}". The file may be corrupted.`);
      }
    };

    if (ext === 'glb') {
      // Binary GLTF — read as ArrayBuffer and parse directly
      const reader = new FileReader();
      reader.onload = (event) => {
        this.gltfLoader.parse(event.target.result, '', onModelLoaded, onError);
      };
      reader.onerror = () => alert('Failed to read file.');
      reader.readAsArrayBuffer(file);
    } else if (ext === 'gltf') {
      // JSON GLTF — use blob URL with load() so relative paths have a chance
      const url = URL.createObjectURL(file);
      this.gltfLoader.load(url, (gltf) => {
        URL.revokeObjectURL(url);
        onModelLoaded(gltf);
      }, undefined, (error) => {
        URL.revokeObjectURL(url);
        onError(error);
      });
    } else {
      alert(`Unsupported format: .${ext}\nPlease use .glb or .gltf files.`);
    }

    return id;
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
    if (this.activeModels[id]) return Promise.resolve(this.activeModels[id]);

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, (gltf) => {
        const model = gltf.scene;
        model.position.set(position.x, position.y, position.z);
        model.scale.set(scale, scale, scale);
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

    // Update OrbitControls every frame (required for damping to work)
    if (this.interactionMode === 'edit' && this.controls.enabled) {
      this.controls.update();
    }

    this.updateFPS();
    this.renderer.render(this.scene, this.camera);
  }
}
