import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export class TextGenerator {
  constructor(scene) {
    this.scene = scene;
    this.loader = new FontLoader();
    this.font = null;
    this.currentTextMesh = null;
    this.loadFont();
  }

  loadFont() {
    // using unpkg to load a standard threejs font without bloating the local repo
    this.loader.load(
      'https://unpkg.com/three@0.163.0/examples/fonts/helvetiker_bold.typeface.json',
      (font) => {
        this.font = font;
        // Broadcast that font is loaded if necessary, or just generate initial
        console.log("3D Font Loaded Successfully");
        const initialText = document.getElementById('scene-text-input')?.value || 'LUMINOUS';
        this.updateText(initialText);
      
        // Notify the GSAP Timeline Engine that the new physical mesh is ready to be bound!
        document.dispatchEvent(new Event('textMeshReady'));
      }
    );
  }

  updateText(textString) {
    if (!this.font) return; // Wait until font is loaded

    // Clean up old mesh to prevent memory leaks
    if (this.currentTextMesh) {
      this.scene.remove(this.currentTextMesh);
      if (this.currentTextMesh.geometry) this.currentTextMesh.geometry.dispose();
      if (this.currentTextMesh.material) this.currentTextMesh.material.dispose();
    }

    // Create new geometry
    const geometry = new TextGeometry(textString, {
      font: this.font,
      size: 2,
      depth: 0.5,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 5
    });

    // Center the geometry
    geometry.computeBoundingBox();
    const xOffset = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
    const yOffset = -0.5 * (geometry.boundingBox.max.y - geometry.boundingBox.min.y);
    geometry.translate(xOffset, yOffset, 0);

    // Premium gold material
    const material = new THREE.MeshStandardMaterial({
      color: 0xE5B55A,
      emissive: 0x221100, // slight glow
      roughness: 0.2,
      metalness: 0.9,
    });

    this.currentTextMesh = new THREE.Mesh(geometry, material);
    
    // Add subtle shadow casting
    this.currentTextMesh.castShadow = true;
    this.currentTextMesh.receiveShadow = true;

    this.scene.add(this.currentTextMesh);
  }

  updateColor(hexColor) {
    if (this.currentTextMesh && this.currentTextMesh.material) {
      this.currentTextMesh.material.color.set(hexColor);
    }
  }
}
