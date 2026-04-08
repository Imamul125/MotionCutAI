import './style.css';
import { Engine3D } from './engine3d.js';
import { TimelineManager } from './timeline.js';
import { ViewportControls } from './components/ViewportControls.js';
import { createIcons, Camera, Type, Volume2, Box, Sparkles } from 'lucide';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  createIcons({
    icons: { Camera, Type, Volume2, Box, Sparkles }
  });

  // Initialize 3D Engine
  const container = document.getElementById('viewport-container');
  const engine = new Engine3D(container);
  window.timeline = new TimelineManager(engine);
  const timeline = window.timeline;

  // Initialize Viewport Controls (orbit, pan, zoom + keyframe HUD)
  const viewportControls = new ViewportControls(engine, timeline);

  // ============================================================
  //   SCENE HIERARCHY — Object List + Add/Delete
  // ============================================================
  const sceneList = document.getElementById('scene-objects-list');
  const objNameInput = document.getElementById('obj-name-input');
  const objTextContent = document.getElementById('obj-text-content');
  const objTextGroup = document.getElementById('obj-text-group');
  const objColor = document.getElementById('obj-color');
  const txPosX = document.getElementById('transform-pos-x');
  const txPosY = document.getElementById('transform-pos-y');
  const txPosZ = document.getElementById('transform-pos-z');
  const txScale = document.getElementById('transform-scale');
  const txTrackName = document.getElementById('transform-track-name');

  function renderSceneList() {
    sceneList.innerHTML = '';

    // Always show Camera as first item (non-deletable)
    const camItem = document.createElement('div');
    camItem.className = `scene-obj-item ${engine.selectedObjectId === null && timeline.selectedTrack === 'camera' ? 'selected' : ''}`;
    camItem.innerHTML = `<span class="scene-obj-icon">📷</span><span class="scene-obj-name">Camera</span>`;
    camItem.addEventListener('click', () => {
      engine.selectedObjectId = null;
      timeline.selectTrack('camera');
      renderSceneList();
      syncTransformInputs();
    });
    sceneList.appendChild(camItem);

    // Scene objects
    for (const obj of engine.sceneObjects) {
      const item = document.createElement('div');
      const isSelected = engine.selectedObjectId === obj.id;
      const typeClass = obj.type === 'text' ? 'text-type' : 'model-type';
      item.className = `scene-obj-item ${typeClass} ${isSelected ? 'selected' : ''}`;

      const icon = obj.type === 'text' ? 'T' : '▢';
      item.innerHTML = `
        <span class="scene-obj-icon">${icon}</span>
        <span class="scene-obj-name">${obj.name}</span>
        <button class="scene-obj-delete" title="Delete">×</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.scene-obj-delete')) return;
        engine.selectedObjectId = obj.id;
        timeline.selectTrack(obj.type === 'text' ? 'text' : 'model');
        renderSceneList();
        syncTransformInputs();
        syncObjProperties();
      });

      const deleteBtn = item.querySelector('.scene-obj-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        engine.removeSceneObject(obj.id);
      });

      sceneList.appendChild(item);
    }

    if (engine.sceneObjects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'scene-obj-empty';
      empty.textContent = 'No objects yet. Use + buttons above.';
      sceneList.appendChild(empty);
    }
  }

  function syncTransformInputs() {
    const objId = engine.selectedObjectId;
    if (!objId) {
      // Camera selected
      txTrackName.textContent = 'Camera';
      txTrackName.style.color = '#00cec9';
      txPosX.value = engine.camera.position.x.toFixed(1);
      txPosY.value = engine.camera.position.y.toFixed(1);
      txPosZ.value = engine.camera.position.z.toFixed(1);
      txScale.value = '1.0';
      return;
    }

    const obj = engine.getObjectById(objId);
    if (!obj) return;

    const color = obj.type === 'text' ? '#E5B55A' : '#a29bfe';
    txTrackName.textContent = obj.name;
    txTrackName.style.color = color;
    txPosX.value = obj.mesh.position.x.toFixed(1);
    txPosY.value = obj.mesh.position.y.toFixed(1);
    txPosZ.value = obj.mesh.position.z.toFixed(1);
    txScale.value = (obj.mesh.scale?.x || 1).toFixed(1);
  }

  function syncObjProperties() {
    const objId = engine.selectedObjectId;
    const propsPanel = document.getElementById('selected-obj-props');
    if (!objId) {
      propsPanel.style.display = 'none';
      return;
    }
    propsPanel.style.display = '';

    const obj = engine.getObjectById(objId);
    if (!obj) return;

    objNameInput.value = obj.name;

    if (obj.type === 'text') {
      objTextGroup.style.display = '';
      objTextContent.value = obj.name;
    } else {
      objTextGroup.style.display = 'none';
    }
  }

  // Apply transform values to selected object in real-time
  function applyTransform() {
    const x = parseFloat(txPosX.value) || 0;
    const y = parseFloat(txPosY.value) || 0;
    const z = parseFloat(txPosZ.value) || 0;
    const s = parseFloat(txScale.value) || 1;

    const objId = engine.selectedObjectId;
    if (!objId) return; // Camera position is via orbit, not inputs

    const obj = engine.getObjectById(objId);
    if (!obj) return;

    obj.mesh.position.set(x, y, z);
    obj.mesh.scale.set(s, s, s);
  }

  // Bind input events
  [txPosX, txPosY, txPosZ, txScale].forEach(input => {
    if (input) input.addEventListener('input', applyTransform);
  });

  // --- Draggable XYZ Labels (Blender-style) ---
  document.querySelectorAll('.xyz-label[data-target]').forEach(label => {
    const targetId = label.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;

    let isDragging = false;
    let startX = 0;
    let startVal = 0;
    const sensitivity = targetId.includes('scale') ? 0.01 : 0.1;

    label.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startVal = parseFloat(input.value) || 0;
      document.body.style.cursor = 'ew-resize';

      const onMove = (e2) => {
        if (!isDragging) return;
        const delta = (e2.clientX - startX) * sensitivity;
        input.value = (startVal + delta).toFixed(1);
        input.dispatchEvent(new Event('input'));
      };
      const onUp = () => {
        isDragging = false;
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });



  // Object name change
  if (objNameInput) {
    objNameInput.addEventListener('input', () => {
      const obj = engine.getObjectById(engine.selectedObjectId);
      if (obj) {
        obj.name = objNameInput.value;
        renderSceneList();
      }
    });
  }

  // Text content change
  if (objTextContent) {
    objTextContent.addEventListener('input', () => {
      const obj = engine.getObjectById(engine.selectedObjectId);
      if (obj && obj.type === 'text') {
        const tg = obj.textGen || engine.textGen;
        if (tg) tg.updateText(objTextContent.value || ' ');
        obj.name = objTextContent.value;
        renderSceneList();
      }
    });
  }

  // Color change
  if (objColor) {
    objColor.addEventListener('input', () => {
      const obj = engine.getObjectById(engine.selectedObjectId);
      if (obj) {
        if (obj.type === 'text') {
          const tg = obj.textGen || engine.textGen;
          if (tg) tg.updateColor(objColor.value);
        } else if (obj.mesh.material) {
          obj.mesh.material.color.setStyle(objColor.value);
        }
      }
    });
  }

  // --- Add Object Buttons ---
  document.getElementById('btn-add-text')?.addEventListener('click', () => {
    engine.addText('TEXT', { x: 0, y: 2, z: 0 });
  });
  document.getElementById('btn-add-cube')?.addEventListener('click', () => {
    engine.addPrimitive('cube', { x: 2, y: 0, z: 0 });
  });
  document.getElementById('btn-add-sphere')?.addEventListener('click', () => {
    engine.addPrimitive('sphere', { x: -2, y: 0, z: 0 });
  });
  const fileInput = document.getElementById('file-import-model');
  document.getElementById('btn-import-model')?.addEventListener('click', () => {
    fileInput?.click();
  });
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      engine.importModelFromFile(file);
      fileInput.value = ''; // reset so same file can be re-imported
    }
  });

  // Listen for scene changes
  document.addEventListener('sceneObjectsChanged', () => {
    renderSceneList();
    syncTransformInputs();
    syncObjProperties();
  });

  // --- Spotlight ---
  const bloomStrengthInput = document.getElementById('bloom-strength');
  if (bloomStrengthInput && engine.spotlight) {
    bloomStrengthInput.addEventListener('input', (e) => {
      engine.spotlight.intensity = parseFloat(e.target.value) * 1500;
    });
  }

  // --- ASYNC RESOURCE BINDING ---
  document.addEventListener('textMeshReady', () => {
    console.log("Timeline System: Text Mesh initialized");
    if (window.timeline) {
      window.timeline.rebuildGSAP();
    }
    renderSceneList();
    syncTransformInputs();
    syncObjProperties();
  });

  // AI Prompt Generation Logic
  const autoGenBtn = document.getElementById('btn-auto-gen');
  const promptInput = document.getElementById('ai-prompt-input');

  autoGenBtn.addEventListener('click', () => {
    const scriptText = promptInput ? promptInput.value : '';
    console.log("Analyzing Script:", scriptText);
    autoGenBtn.innerText = "✨ Generating Magic...";
    
    setTimeout(() => {
      timeline.clearTimeline();
      engine.camera.position.set(-15, 5, 20);
      timeline.addCameraMove(0, 5, 5, -2, 10);
      timeline.addTextDrop(1, 1.5, 10, 0);
      timeline.addCameraMove(5, 5, 0, 0, 5);
      timeline.addSFX(1, 1, 'Boom Impact');
      timeline.addSFX(2, 2, 'Digital Glitch');
      timeline.addSFX(5, 3, 'Whoosh Riser');
      autoGenBtn.innerText = "✨ Generate Video";
    }, 800);
  });

  // Initial render
  renderSceneList();
});
