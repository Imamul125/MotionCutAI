import './style.css';
import { Engine3D } from './engine3d.js';
import { TimelineManager } from './timeline.js';
import { createIcons, Camera, Type, Volume2 } from 'lucide';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  createIcons({
    icons: {
      Camera,
      Type,
      Volume2
    }
  });

  // Initialize 3D Engine
  const container = document.getElementById('viewport-container');
  const engine = new Engine3D(container);
  window.timeline = new TimelineManager(engine); // Make globally accessible for async event binding
  const timeline = window.timeline;

  // Hook up Properties Panel (Live update text)
  const sceneTextInput = document.getElementById('scene-text-input');
  if (sceneTextInput) {
    sceneTextInput.addEventListener('input', (e) => {
      if (engine.textGen) {
        engine.textGen.updateText(e.target.value || ' '); // Add space fallback if empty
      }
    });
  }

  const sceneTextColor = document.getElementById('scene-text-color');
  if (sceneTextColor) {
    sceneTextColor.addEventListener('input', (e) => {
      if (engine.textGen) {
        engine.textGen.updateColor(e.target.value);
      }
    });
  }

  const bloomStrengthInput = document.getElementById('bloom-strength');
  if (bloomStrengthInput && engine.spotlight) {
    bloomStrengthInput.addEventListener('input', (e) => {
      // Spotlight intensity needs to be extremely high for physical decay calculations
      engine.spotlight.intensity = parseFloat(e.target.value) * 1500;
    });
  }

  // --- ASYNC RESOURCE BINDING ---
  // When the font finishes downloading over the network, re-bake the timeline!
  document.addEventListener('textMeshReady', () => {
    console.log("Timeline System: Text Mesh initialized, binding GSAP tweens...");
    if (window.timeline) {
      window.timeline.rebuildGSAP();
    }
  });

  // AI Prompt Generation Logic
  const autoGenBtn = document.getElementById('btn-auto-gen');
  const promptInput = document.getElementById('ai-prompt-input');

  autoGenBtn.addEventListener('click', () => {
    const scriptText = promptInput ? promptInput.value : '';
    console.log("Analyzing Script:", scriptText);

    autoGenBtn.innerText = "✨ Generating Magic...";
    
    // MOCK AI PIPELINE
    setTimeout(() => {
      // Clear old clips and animations
      timeline.clearTimeline();
      
      // MOCK JSON RESPONSE INJECTION
      // Set initial camera to wide left
      engine.camera.position.set(-15, 5, 20);
      
      // Camera pan and push-in (0s to 5s)
      timeline.addCameraMove(0, 5, 5, -2, 10);
      
      // Text drop animation (1s to 2.5s)
      timeline.addTextDrop(1, 1.5, 10, 0);

      // AI Decides to spawn a 3D Model at 2s (e.g. keyboard.glb) scaling up from 0 to 1
      timeline.addModel('ai-keyboard-1', 'assets/keyboard.glb', 2, 2, 0.0, 1.0);

      // Final Dramatic push in
      timeline.addCameraMove(5, 5, 0, 0, 5);
      
      timeline.addSFX(1, 1, 'Boom Impact');
      timeline.addSFX(2, 2, 'Digital Glitch');
      timeline.addSFX(5, 3, 'Whoosh Riser');

      autoGenBtn.innerText = "✨ Generate Video";
    }, 800); // simulate API delay
  });
});
