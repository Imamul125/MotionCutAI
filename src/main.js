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
      const typeMap = { text: 'text-type', model: 'model-type', light: 'light-type', media: 'media-type' };
      item.className = `scene-obj-item ${typeMap[obj.type] || 'model-type'} ${isSelected ? 'selected' : ''}`;

      const icons = { text: 'T', model: '▢', light: '💡', media: obj.subtype === 'video' ? '🎬' : '🖼' };
      const icon = icons[obj.type] || '▢';
      item.innerHTML = `
        <span class="scene-obj-icon">${icon}</span>
        <span class="scene-obj-name">${obj.name}</span>
        <button class="scene-obj-delete" title="Delete">×</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.scene-obj-delete')) return;
        engine.selectedObjectId = obj.id;
        const trackMap = { text: 'text', model: 'model', light: 'model', media: 'model' };
        timeline.selectTrack(trackMap[obj.type] || 'model');
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

    const colorMap = { text: '#E5B55A', model: '#a29bfe', light: '#55efc4', media: '#fd79a8' };
    txTrackName.textContent = obj.name;
    txTrackName.style.color = colorMap[obj.type] || '#a29bfe';
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

    // Show/hide type-specific controls
    objTextGroup.style.display = obj.type === 'text' ? '' : 'none';
    const objColorGroup = document.getElementById('obj-color-group');
    if (objColorGroup) objColorGroup.style.display = obj.type === 'light' ? 'none' : '';

    // Light-specific props
    const lightProps = document.getElementById('light-props');
    if (lightProps) {
      if (obj.type === 'light') {
        lightProps.style.display = '';
        document.getElementById('light-intensity').value = obj.lightRef?.intensity || 150;
        const lc = obj.lightRef?.color;
        if (lc) document.getElementById('light-color').value = '#' + lc.getHexString();
      } else {
        lightProps.style.display = 'none';
      }
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
        if (tg) {
          // Save current position before updateText destroys the mesh
          const pos = obj.mesh.position.clone();
          const scl = obj.mesh.scale.clone();
          tg.updateText(objTextContent.value || ' ');
          // updateText() creates a new mesh — update our reference
          obj.mesh = tg.currentTextMesh;
          obj.mesh.position.copy(pos);
          obj.mesh.scale.copy(scl);
        }
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

  // --- Import Image ---
  const imageInput = document.getElementById('file-import-image');
  document.getElementById('btn-import-image')?.addEventListener('click', () => {
    imageInput?.click();
  });
  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      engine.addImage(file);
      imageInput.value = '';
    }
  });

  // --- Import Video ---
  const videoInput = document.getElementById('file-import-video');
  document.getElementById('btn-import-video')?.addEventListener('click', () => {
    videoInput?.click();
  });
  videoInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      engine.addVideo(file);
      videoInput.value = '';
    }
  });

  // --- Add Light Buttons ---
  document.getElementById('btn-add-point-light')?.addEventListener('click', () => {
    engine.addLight('point', { x: 3, y: 5, z: 3 });
  });
  document.getElementById('btn-add-spot-light')?.addEventListener('click', () => {
    engine.addLight('spot', { x: 0, y: 6, z: 4 });
  });
  document.getElementById('btn-add-dir-light')?.addEventListener('click', () => {
    engine.addLight('directional', { x: -3, y: 8, z: 5 });
  });

  // --- Light Properties ---
  document.getElementById('light-intensity')?.addEventListener('input', (e) => {
    const obj = engine.getObjectById(engine.selectedObjectId);
    if (obj?.type === 'light' && obj.lightRef) {
      obj.lightRef.intensity = parseFloat(e.target.value);
      if (obj.helper?.update) obj.helper.update();
    }
  });
  document.getElementById('light-color')?.addEventListener('input', (e) => {
    const obj = engine.getObjectById(engine.selectedObjectId);
    if (obj?.type === 'light' && obj.lightRef) {
      obj.lightRef.color.setStyle(e.target.value);
      if (obj.helper?.update) obj.helper.update();
    }
  });

  // --- HDR Environment ---
  document.getElementById('env-preset')?.addEventListener('change', (e) => {
    const url = e.target.value;
    if (!url) {
      engine.clearEnvironment();
    } else {
      engine.loadHDRPreset(url);
    }
  });
  document.getElementById('env-intensity')?.addEventListener('input', (e) => {
    engine.setEnvIntensity(parseFloat(e.target.value));
  });
  document.getElementById('env-show-bg')?.addEventListener('change', (e) => {
    engine.toggleEnvBackground(e.target.checked);
  });
  const hdrFileInput = document.getElementById('file-import-hdr');
  document.getElementById('btn-import-hdr')?.addEventListener('click', () => {
    hdrFileInput?.click();
  });
  hdrFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      engine.loadHDRFile(file);
      hdrFileInput.value = '';
    }
  });

  // --- Gizmo Toggle ---
  document.getElementById('toggle-gizmos')?.addEventListener('change', (e) => {
    engine.toggleGizmos(e.target.checked);
  });

  // Listen for scene changes
  document.addEventListener('sceneObjectsChanged', () => {
    renderSceneList();
    syncTransformInputs();
    syncObjProperties();
  });

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
    autoGenBtn.disabled = true;
    
    setTimeout(() => {
      timeline.clearTimeline();

      // Set initial camera
      engine.camera.position.set(-15, 5, 20);

      // Add generated 3D objects to scene
      const cubeId = engine.addPrimitive('cube', { x: 5, y: 0, z: -3 });
      const sphereId = engine.addPrimitive('sphere', { x: -5, y: 0, z: -3 });
      const lightId = engine.addLight('spot', { x: 0, y: 8, z: 5 });

      // Add timeline clips
      timeline.addCameraMove(0, 5, 5, -2, 10);
      timeline.addTextDrop(1, 1.5, 10, 0);
      timeline.addCameraMove(5, 5, 0, 0, 5);
      timeline.addSFX(1, 1, 'Boom Impact');
      timeline.addSFX(2, 2, 'Digital Glitch');
      timeline.addSFX(5, 3, 'Whoosh Riser');

      // Set keyframes for generated objects
      // Text keyframes
      const textObj = engine.sceneObjects.find(o => o.type === 'text');
      if (textObj) {
        timeline.addKeyframe('text', 0, {
          objectId: textObj.id,
          x: textObj.mesh.position.x,
          y: textObj.mesh.position.y + 5,
          z: textObj.mesh.position.z,
          scale: 0.1,
        });
        timeline.addKeyframe('text', 1.5, {
          objectId: textObj.id,
          x: textObj.mesh.position.x,
          y: textObj.mesh.position.y,
          z: textObj.mesh.position.z,
          scale: 1,
        });
      }

      // Cube keyframes
      const cubeObj = engine.getObjectById(cubeId);
      if (cubeObj) {
        timeline.addKeyframe('model', 0, {
          objectId: cubeId,
          x: 8, y: -5, z: -3, scale: 0.1,
        });
        timeline.addKeyframe('model', 2, {
          objectId: cubeId,
          x: 5, y: 0, z: -3, scale: 1,
        });
      }

      // Sphere keyframes
      const sphereObj = engine.getObjectById(sphereId);
      if (sphereObj) {
        timeline.addKeyframe('model', 0, {
          objectId: sphereId,
          x: -8, y: -5, z: -3, scale: 0.1,
        });
        timeline.addKeyframe('model', 2.5, {
          objectId: sphereId,
          x: -5, y: 0, z: -3, scale: 1,
        });
      }

      autoGenBtn.innerText = "✨ Generate Video";
      autoGenBtn.disabled = false;
      renderSceneList();
      syncTransformInputs();
    }, 800);
  });

  // Initial render
  renderSceneList();
});
