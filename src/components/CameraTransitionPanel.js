/**
 * CameraTransitionPanel.js
 * Premium UI panel for controlling camera transitions on the timeline.
 * Features: preset selector, easing picker, custom XYZ controls, lookAt target, duration, and live preview.
 */

import { CAMERA_PRESETS, EASING_OPTIONS, getPresetById, getEasingById } from './CameraPresets.js';
import gsap from 'gsap';

export class CameraTransitionPanel {
  constructor(timelineManager) {
    this.timeline = timelineManager;
    this.engine = timelineManager.engine;

    // Current user selections
    this.selectedPreset = null;
    this.selectedEasing = EASING_OPTIONS[0]; // default: Smooth
    this.customPosition = { x: 0, y: 0, z: 15 };
    this.lookAtTarget = { x: 0, y: 0, z: 0 };
    this.transitionDuration = 3;
    this.isPreviewMode = false;

    this.panelEl = null;
    this.buildPanel();
    this.injectStyles();
  }

  buildPanel() {
    // Create container
    this.panelEl = document.createElement('div');
    this.panelEl.id = 'cam-transition-panel';
    this.panelEl.innerHTML = `
      <div class="cam-panel-header">
        <div class="cam-panel-title">
          <span class="cam-icon">🎥</span>
          <span>Camera Transitions</span>
        </div>
        <button id="cam-panel-toggle" class="cam-collapse-btn" title="Collapse">▾</button>
      </div>

      <div id="cam-panel-body" class="cam-panel-body">
        <!-- Category Tabs -->
        <div class="cam-tabs">
          <button class="cam-tab active" data-cat="all">All</button>
          <button class="cam-tab" data-cat="static">Static</button>
          <button class="cam-tab" data-cat="move">Moves</button>
          <button class="cam-tab" data-cat="custom">Custom</button>
        </div>

        <!-- Preset Grid -->
        <div id="cam-preset-grid" class="cam-preset-grid"></div>

        <!-- Custom Position Controls (hidden by default, shown on "Custom" tab) -->
        <div id="cam-custom-controls" class="cam-custom-controls" style="display: none;">
          <div class="cam-xyz-row">
            <div class="cam-xyz-field">
              <label>X</label>
              <input type="number" id="cam-custom-x" value="0" step="0.5" />
            </div>
            <div class="cam-xyz-field">
              <label>Y</label>
              <input type="number" id="cam-custom-y" value="0" step="0.5" />
            </div>
            <div class="cam-xyz-field">
              <label>Z</label>
              <input type="number" id="cam-custom-z" value="15" step="0.5" />
            </div>
          </div>
          <div class="cam-lookat-section">
            <label class="cam-section-label">Look At Target</label>
            <div class="cam-xyz-row">
              <div class="cam-xyz-field">
                <label>X</label>
                <input type="number" id="cam-lookat-x" value="0" step="0.5" />
              </div>
              <div class="cam-xyz-field">
                <label>Y</label>
                <input type="number" id="cam-lookat-y" value="0" step="0.5" />
              </div>
              <div class="cam-xyz-field">
                <label>Z</label>
                <input type="number" id="cam-lookat-z" value="0" step="0.5" />
              </div>
            </div>
          </div>
          <button id="cam-grab-current" class="cam-action-small">📌 Grab Current Camera Position</button>
        </div>

        <!-- Easing Selector -->
        <div class="cam-easing-section">
          <label class="cam-section-label">Transition Easing</label>
          <div id="cam-easing-grid" class="cam-easing-grid"></div>
        </div>

        <!-- Duration Control -->
        <div class="cam-duration-section">
          <label class="cam-section-label">Duration</label>
          <div class="cam-duration-row">
            <input type="range" id="cam-duration-slider" min="0.5" max="10" step="0.25" value="3" />
            <span id="cam-duration-value" class="cam-duration-val">3.0s</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="cam-actions">
          <button id="cam-preview-btn" class="cam-btn preview">👁 Preview</button>
          <button id="cam-add-btn" class="cam-btn add">＋ Add to Timeline</button>
        </div>

        <!-- Active Camera Clips List -->
        <div class="cam-active-section">
          <label class="cam-section-label">Active Camera Clips</label>
          <div id="cam-clips-list" class="cam-clips-list">
            <div class="cam-empty-state">No camera clips yet</div>
          </div>
        </div>
      </div>
    `;

    // Insert into properties panel (before the AI prompt container)
    const propertiesPanel = document.querySelector('.panel-content');
    if (propertiesPanel) {
      const aiContainer = document.getElementById('ai-prompt-container');
      if (aiContainer) {
        propertiesPanel.insertBefore(this.panelEl, aiContainer);
      } else {
        propertiesPanel.appendChild(this.panelEl);
      }
    }

    this.populatePresets();
    this.populateEasings();
    this.bindEvents();
  }

  populatePresets() {
    const grid = this.panelEl.querySelector('#cam-preset-grid');
    grid.innerHTML = '';

    CAMERA_PRESETS.forEach(preset => {
      const card = document.createElement('button');
      card.className = 'cam-preset-card';
      card.dataset.presetId = preset.id;
      card.dataset.category = preset.category;
      card.title = preset.description;
      card.innerHTML = `
        <span class="cam-preset-icon">${preset.icon}</span>
        <span class="cam-preset-label">${preset.label}</span>
      `;
      grid.appendChild(card);
    });
  }

  populateEasings() {
    const grid = this.panelEl.querySelector('#cam-easing-grid');
    grid.innerHTML = '';

    EASING_OPTIONS.forEach(easing => {
      const chip = document.createElement('button');
      chip.className = 'cam-easing-chip';
      if (easing.id === this.selectedEasing.id) chip.classList.add('active');
      chip.dataset.easeId = easing.id;
      chip.innerHTML = `<span>${easing.icon}</span> ${easing.label}`;
      grid.appendChild(chip);
    });
  }

  bindEvents() {
    // Collapse toggle
    const toggleBtn = this.panelEl.querySelector('#cam-panel-toggle');
    const body = this.panelEl.querySelector('#cam-panel-body');
    toggleBtn.addEventListener('click', () => {
      body.classList.toggle('collapsed');
      toggleBtn.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
    });

    // Category tabs
    const tabs = this.panelEl.querySelectorAll('.cam-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.filterPresets(tab.dataset.cat);
      });
    });

    // Preset card clicks
    this.panelEl.querySelector('#cam-preset-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.cam-preset-card');
      if (!card) return;

      // Deselect all
      this.panelEl.querySelectorAll('.cam-preset-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const preset = getPresetById(card.dataset.presetId);
      if (preset) {
        this.selectedPreset = preset;
        this.customPosition = { ...preset.position };
        this.lookAtTarget = { ...preset.lookAt };
        this.selectedEasing = getEasingById(preset.defaultEase);

        // Update easing visual
        this.panelEl.querySelectorAll('.cam-easing-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.easeId === this.selectedEasing.id);
        });

        // Update custom xyz fields
        this.updateCustomFields();

        // Subtle pulse animation on card
        card.classList.add('pulse');
        setTimeout(() => card.classList.remove('pulse'), 400);
      }
    });

    // Easing chip clicks
    this.panelEl.querySelector('#cam-easing-grid').addEventListener('click', (e) => {
      const chip = e.target.closest('.cam-easing-chip');
      if (!chip) return;
      
      this.panelEl.querySelectorAll('.cam-easing-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.selectedEasing = getEasingById(chip.dataset.easeId);
    });

    // Duration slider
    const durationSlider = this.panelEl.querySelector('#cam-duration-slider');
    const durationLabel = this.panelEl.querySelector('#cam-duration-value');
    durationSlider.addEventListener('input', (e) => {
      this.transitionDuration = parseFloat(e.target.value);
      durationLabel.textContent = `${this.transitionDuration.toFixed(1)}s`;
    });

    // Custom XYZ inputs
    ['cam-custom-x', 'cam-custom-y', 'cam-custom-z'].forEach((id, i) => {
      const input = this.panelEl.querySelector(`#${id}`);
      input.addEventListener('input', () => {
        const key = ['x', 'y', 'z'][i];
        this.customPosition[key] = parseFloat(input.value) || 0;
        this.selectedPreset = null; // user deviated from preset
        this.panelEl.querySelectorAll('.cam-preset-card').forEach(c => c.classList.remove('selected'));
      });
    });

    // LookAt inputs
    ['cam-lookat-x', 'cam-lookat-y', 'cam-lookat-z'].forEach((id, i) => {
      const input = this.panelEl.querySelector(`#${id}`);
      input.addEventListener('input', () => {
        const key = ['x', 'y', 'z'][i];
        this.lookAtTarget[key] = parseFloat(input.value) || 0;
      });
    });

    // Grab current camera position
    this.panelEl.querySelector('#cam-grab-current').addEventListener('click', () => {
      const pos = this.engine.camera.position;
      this.customPosition = { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) };
      // Also grab the OrbitControls target as lookAt
      if (this.engine.controls) {
        const tgt = this.engine.controls.target;
        this.lookAtTarget = { x: +tgt.x.toFixed(2), y: +tgt.y.toFixed(2), z: +tgt.z.toFixed(2) };
      }
      this.updateCustomFields();
    });

    // Preview button
    this.panelEl.querySelector('#cam-preview-btn').addEventListener('click', () => {
      this.previewTransition();
    });

    // Add to Timeline button
    this.panelEl.querySelector('#cam-add-btn').addEventListener('click', () => {
      this.addCameraTransition();
    });
  }

  filterPresets(category) {
    const customControls = this.panelEl.querySelector('#cam-custom-controls');
    const presetGrid = this.panelEl.querySelector('#cam-preset-grid');

    if (category === 'custom') {
      presetGrid.style.display = 'none';
      customControls.style.display = 'block';
      return;
    }

    presetGrid.style.display = '';
    customControls.style.display = 'none';

    const cards = presetGrid.querySelectorAll('.cam-preset-card');
    cards.forEach(card => {
      if (category === 'all' || card.dataset.category === category) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  updateCustomFields() {
    this.panelEl.querySelector('#cam-custom-x').value = this.customPosition.x;
    this.panelEl.querySelector('#cam-custom-y').value = this.customPosition.y;
    this.panelEl.querySelector('#cam-custom-z').value = this.customPosition.z;
    this.panelEl.querySelector('#cam-lookat-x').value = this.lookAtTarget.x;
    this.panelEl.querySelector('#cam-lookat-y').value = this.lookAtTarget.y;
    this.panelEl.querySelector('#cam-lookat-z').value = this.lookAtTarget.z;
  }

  previewTransition() {
    const previewBtn = this.panelEl.querySelector('#cam-preview-btn');
    if (this.isPreviewMode) return;
    this.isPreviewMode = true;
    previewBtn.classList.add('previewing');
    previewBtn.textContent = '⏳ Previewing...';

    // Save current position
    const savedPos = {
      x: this.engine.camera.position.x,
      y: this.engine.camera.position.y,
      z: this.engine.camera.position.z,
    };

    // Temporarily disable OrbitControls so they don't fight the animation
    const controls = this.engine.controls;
    const wasEnabled = controls ? controls.enabled : false;
    if (controls) controls.enabled = false;

    // Animate to target
    gsap.to(this.engine.camera.position, {
      x: this.customPosition.x,
      y: this.customPosition.y,
      z: this.customPosition.z,
      duration: this.transitionDuration,
      ease: this.selectedEasing.id,
      onComplete: () => {
        // Hold for 0.5s, then snap back
        setTimeout(() => {
          gsap.to(this.engine.camera.position, {
            x: savedPos.x,
            y: savedPos.y,
            z: savedPos.z,
            duration: 0.6,
            ease: 'power2.inOut',
            onComplete: () => {
              this.isPreviewMode = false;
              previewBtn.classList.remove('previewing');
              previewBtn.textContent = '👁 Preview';
              // Re-enable OrbitControls
              if (controls) controls.enabled = wasEnabled;
            }
          });
        }, 500);
      }
    });
  }

  addCameraTransition() {
    const label = this.selectedPreset ? this.selectedPreset.label : 'Custom Move';
    const pos = this.customPosition;
    const ease = this.selectedEasing.id;
    const duration = this.transitionDuration;
    const lookAt = { ...this.lookAtTarget };

    // Add the clip to timeline at the current playhead position
    const startTime = this.timeline.currentTime;

    this.timeline.createClip('camera', startTime, duration, label, {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      ease: ease,
      lookAt: lookAt,
      presetId: this.selectedPreset ? this.selectedPreset.id : null,
    });

    this.refreshClipsList();

    // Visual feedback
    const addBtn = this.panelEl.querySelector('#cam-add-btn');
    addBtn.textContent = '✓ Added!';
    addBtn.classList.add('success');
    setTimeout(() => {
      addBtn.textContent = '＋ Add to Timeline';
      addBtn.classList.remove('success');
    }, 1200);
  }

  refreshClipsList() {
    const list = this.panelEl.querySelector('#cam-clips-list');
    const cameraClips = this.timeline.clips.filter(c => c.type === 'camera');

    if (cameraClips.length === 0) {
      list.innerHTML = '<div class="cam-empty-state">No camera clips yet</div>';
      return;
    }

    list.innerHTML = '';
    cameraClips.sort((a, b) => a.startTime - b.startTime).forEach(clip => {
      const item = document.createElement('div');
      item.className = 'cam-clip-item';
      item.innerHTML = `
        <div class="cam-clip-info">
          <span class="cam-clip-name">${clip.label}</span>
          <span class="cam-clip-time">${clip.startTime.toFixed(1)}s → ${(clip.startTime + clip.duration).toFixed(1)}s</span>
        </div>
        <div class="cam-clip-actions">
          <button class="cam-clip-goto" data-clip-id="${clip.id}" title="Jump to clip">⏩</button>
          <button class="cam-clip-delete" data-clip-id="${clip.id}" title="Remove clip">🗑️</button>
        </div>
      `;

      // Jump to clip
      item.querySelector('.cam-clip-goto').addEventListener('click', () => {
        this.timeline.currentTime = clip.startTime;
        this.timeline.updateTimelineState();
      });

      // Delete clip
      item.querySelector('.cam-clip-delete').addEventListener('click', () => {
        this.timeline.removeClip(clip.id);
        this.refreshClipsList();
      });

      list.appendChild(item);
    });
  }

  injectStyles() {
    if (document.getElementById('cam-transition-styles')) return;

    const style = document.createElement('style');
    style.id = 'cam-transition-styles';
    style.textContent = `
      /* Camera Transition Panel */
      #cam-transition-panel {
        margin-bottom: 1.5rem;
        border: 1px solid rgba(0, 206, 201, 0.2);
        border-radius: 10px;
        background: linear-gradient(145deg, rgba(0, 206, 201, 0.04), rgba(0, 0, 0, 0.2));
        overflow: hidden;
      }

      .cam-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: rgba(0, 206, 201, 0.08);
        border-bottom: 1px solid rgba(0, 206, 201, 0.15);
        cursor: default;
      }

      .cam-panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #00cec9;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .cam-icon {
        font-size: 16px;
      }

      .cam-collapse-btn {
        background: none;
        border: 1px solid rgba(0, 206, 201, 0.3);
        color: #00cec9;
        font-size: 14px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .cam-collapse-btn:hover {
        background: rgba(0, 206, 201, 0.15);
      }

      .cam-panel-body {
        padding: 12px;
        transition: all 0.3s ease;
      }
      .cam-panel-body.collapsed {
        display: none;
      }

      /* Category Tabs */
      .cam-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 10px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        padding: 3px;
      }

      .cam-tab {
        flex: 1;
        padding: 6px 0;
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
      }
      .cam-tab:hover {
        color: #00cec9;
        background: rgba(0, 206, 201, 0.06);
      }
      .cam-tab.active {
        background: rgba(0, 206, 201, 0.15);
        color: #00cec9;
        box-shadow: 0 0 8px rgba(0, 206, 201, 0.1);
      }

      /* Preset Grid */
      .cam-preset-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        margin-bottom: 12px;
      }

      .cam-preset-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 4px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
        color: var(--text-muted);
      }
      .cam-preset-card:hover {
        background: rgba(0, 206, 201, 0.08);
        border-color: rgba(0, 206, 201, 0.3);
        color: #fff;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 206, 201, 0.1);
      }
      .cam-preset-card.selected {
        background: rgba(0, 206, 201, 0.15);
        border-color: #00cec9;
        color: #00cec9;
        box-shadow: 0 0 16px rgba(0, 206, 201, 0.2), inset 0 0 24px rgba(0, 206, 201, 0.05);
      }
      .cam-preset-card.pulse {
        animation: camPulse 0.4s ease;
      }
      @keyframes camPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }

      .cam-preset-icon {
        font-size: 20px;
        line-height: 1;
      }

      .cam-preset-label {
        font-size: 10px;
        font-weight: 600;
        text-align: center;
        line-height: 1.2;
      }

      /* Custom Controls */
      .cam-custom-controls {
        margin-bottom: 12px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .cam-xyz-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }

      .cam-xyz-field {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .cam-xyz-field label {
        font-size: 10px;
        font-weight: 700;
        color: #00cec9;
        text-transform: uppercase;
      }

      .cam-xyz-field input {
        width: 100%;
        padding: 6px 8px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(0, 206, 201, 0.2);
        border-radius: 5px;
        color: #fff;
        font-size: 13px;
        font-family: 'Inter', monospace;
        outline: none;
        transition: border-color 0.2s;
      }
      .cam-xyz-field input:focus {
        border-color: #00cec9;
        box-shadow: 0 0 8px rgba(0, 206, 201, 0.15);
      }

      .cam-lookat-section {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed rgba(255, 255, 255, 0.08);
      }

      .cam-section-label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .cam-action-small {
        width: 100%;
        padding: 6px;
        margin-top: 6px;
        background: rgba(0, 206, 201, 0.1);
        border: 1px dashed rgba(0, 206, 201, 0.3);
        color: #00cec9;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .cam-action-small:hover {
        background: rgba(0, 206, 201, 0.2);
        border-style: solid;
      }

      /* Easing Grid */
      .cam-easing-section {
        margin-bottom: 12px;
      }

      .cam-easing-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .cam-easing-chip {
        padding: 5px 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .cam-easing-chip:hover {
        background: rgba(0, 206, 201, 0.08);
        border-color: rgba(0, 206, 201, 0.3);
        color: #ccc;
      }
      .cam-easing-chip.active {
        background: rgba(0, 206, 201, 0.18);
        border-color: #00cec9;
        color: #00cec9;
        box-shadow: 0 0 8px rgba(0, 206, 201, 0.15);
      }

      /* Duration */
      .cam-duration-section {
        margin-bottom: 12px;
      }

      .cam-duration-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .cam-duration-row input[type="range"] {
        flex: 1;
        accent-color: #00cec9;
        height: 4px;
      }

      .cam-duration-val {
        font-size: 13px;
        font-weight: 700;
        color: #00cec9;
        font-family: monospace;
        min-width: 40px;
        text-align: right;
      }

      /* Action Buttons */
      .cam-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
      }

      .cam-btn {
        flex: 1;
        padding: 9px 12px;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
      }

      .cam-btn.preview {
        background: rgba(0, 206, 201, 0.12);
        border: 1px solid rgba(0, 206, 201, 0.4);
        color: #00cec9;
      }
      .cam-btn.preview:hover {
        background: rgba(0, 206, 201, 0.22);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 206, 201, 0.15);
      }
      .cam-btn.preview.previewing {
        background: rgba(0, 206, 201, 0.3);
        pointer-events: none;
        animation: camPreviewPulse 1s infinite;
      }
      @keyframes camPreviewPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      .cam-btn.add {
        background: linear-gradient(135deg, #00b894, #00cec9);
        color: #111;
      }
      .cam-btn.add:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 206, 201, 0.3);
      }
      .cam-btn.add.success {
        background: linear-gradient(135deg, #00b894, #55efc4);
      }

      /* Active Camera Clips List */
      .cam-active-section {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 10px;
      }

      .cam-clips-list {
        max-height: 140px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .cam-empty-state {
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
        padding: 16px 0;
        opacity: 0.6;
      }

      .cam-clip-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        background: rgba(0, 206, 201, 0.05);
        border: 1px solid rgba(0, 206, 201, 0.1);
        border-radius: 6px;
        transition: all 0.2s;
      }
      .cam-clip-item:hover {
        background: rgba(0, 206, 201, 0.1);
        border-color: rgba(0, 206, 201, 0.25);
      }

      .cam-clip-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .cam-clip-name {
        font-size: 12px;
        font-weight: 600;
        color: #fff;
      }

      .cam-clip-time {
        font-size: 10px;
        color: var(--text-muted);
        font-family: monospace;
      }

      .cam-clip-actions {
        display: flex;
        gap: 4px;
      }

      .cam-clip-actions button {
        width: 28px;
        height: 28px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.2);
        border-radius: 5px;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .cam-clip-actions button:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }
      .cam-clip-delete:hover {
        border-color: rgba(255, 100, 100, 0.4) !important;
        background: rgba(255, 50, 50, 0.15) !important;
      }
    `;
    document.head.appendChild(style);
  }
}
