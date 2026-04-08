/**
 * ViewportControls.js
 * Viewport HUD overlay for the 3D scene.
 * 
 * The actual OrbitControls live in Engine3D — this module builds the HUD
 * (set keyframe, reset, focus, mode toggle, position readout, axis gizmo)
 * and bridges user interactions to the engine + timeline.
 *
 * Controls (handled by Engine3D's OrbitControls):
 *   Left Mouse   = Orbit (rotate around target)
 *   Right Mouse  = Pan
 *   Scroll Wheel = Dolly / Zoom
 *   Middle Mouse  = Pan
 */

import gsap from 'gsap';
import * as THREE from 'three';

export class ViewportControls {
  constructor(engine, timelineManager) {
    this.engine = engine;
    this.timeline = timelineManager;
    this.container = engine.container;

    // Reference the controls that Engine3D created
    this.controls = engine.controls;

    // State
    this.mode = 'edit'; // 'edit' | 'play'
    this.onKeyframeAdded = null; // callback for CameraTransitionPanel sync

    // Build viewport HUD overlay
    this.buildHUD();
    this.injectStyles();

    // Start updating the position readout
    this.startReadoutLoop();

    // Listen for play/pause events from timeline
    this.bindTimelineSync();
  }

  buildHUD() {
    // Viewport HUD overlay container
    this.hud = document.createElement('div');
    this.hud.id = 'viewport-hud';
    this.hud.innerHTML = `
      <!-- Mode indicator -->
      <div id="vp-mode-badge" class="vp-mode-badge edit">
        <span class="vp-mode-dot"></span>
        <span class="vp-mode-text">EDIT MODE</span>
      </div>

      <!-- Camera position readout -->
      <div id="vp-position-readout" class="vp-position-readout">
        <div class="vp-pos-row">
          <span class="vp-pos-label">POS</span>
          <span id="vp-pos-x" class="vp-pos-val">0.00</span>
          <span id="vp-pos-y" class="vp-pos-val">0.00</span>
          <span id="vp-pos-z" class="vp-pos-val">15.00</span>
        </div>
        <div class="vp-pos-row">
          <span class="vp-pos-label">TGT</span>
          <span id="vp-tgt-x" class="vp-pos-val">0.00</span>
          <span id="vp-tgt-y" class="vp-pos-val">0.00</span>
          <span id="vp-tgt-z" class="vp-pos-val">0.00</span>
        </div>
      </div>

      <!-- Controls hint -->
      <div id="vp-controls-hint" class="vp-controls-hint">
        <span>🖱 L-Click Orbit</span>
        <span>🫳 R-Click Pan</span>
        <span>🔍 Scroll Zoom</span>
      </div>

      <!-- Toolbar -->
      <div id="vp-toolbar" class="vp-toolbar">
        <button id="vp-btn-keyframe" class="vp-tool-btn keyframe" title="Set camera keyframe at current playhead (K)">
          <span class="vp-btn-icon">◆</span>
          <span class="vp-btn-label">Set Keyframe</span>
        </button>
        <button id="vp-btn-reset" class="vp-tool-btn" title="Reset camera to default (R)">
          <span class="vp-btn-icon">⟲</span>
          <span class="vp-btn-label">Reset</span>
        </button>
        <button id="vp-btn-focus" class="vp-tool-btn" title="Focus on scene center (F)">
          <span class="vp-btn-icon">◎</span>
          <span class="vp-btn-label">Focus</span>
        </button>
        <div class="vp-tool-divider"></div>
        <button id="vp-btn-mode" class="vp-tool-btn mode-toggle" title="Toggle Edit/Play mode">
          <span class="vp-btn-icon" id="vp-mode-icon">✎</span>
          <span class="vp-btn-label" id="vp-mode-label">Edit</span>
        </button>
      </div>

      <!-- Keyframe toast notification -->
      <div id="vp-toast" class="vp-toast hidden">
        <span class="vp-toast-icon">◆</span>
        <span id="vp-toast-msg" class="vp-toast-msg">Keyframe set!</span>
      </div>

      <!-- Axis gizmo (2x resolution for crisp rendering) -->
      <canvas id="vp-axis-gizmo" class="vp-axis-gizmo" width="140" height="140"></canvas>
    `;

    this.container.appendChild(this.hud);
    this.bindHUDEvents();
    this.startAxisGizmo();
  }

  bindHUDEvents() {
    // Set Keyframe
    this.hud.querySelector('#vp-btn-keyframe').addEventListener('click', () => {
      this.setKeyframe();
    });

    // Reset camera
    this.hud.querySelector('#vp-btn-reset').addEventListener('click', () => {
      this.resetCamera();
    });

    // Focus on center
    this.hud.querySelector('#vp-btn-focus').addEventListener('click', () => {
      this.focusCenter();
    });

    // Mode toggle
    this.hud.querySelector('#vp-btn-mode').addEventListener('click', () => {
      this.toggleMode();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      const inputType = e.target.type;

      // Allow shortcuts through when focused on number inputs
      // Block only when typing in text/textarea inputs (except for specific shortcuts)
      const isTextInput = (tag === 'INPUT' && inputType !== 'number') || tag === 'TEXTAREA';
      const isNumberInput = tag === 'INPUT' && inputType === 'number';

      // Always-available shortcuts (work even when focused on number inputs)
      if (e.key === 'k' || e.key === 'K') {
        if (isTextInput) return;
        e.preventDefault();
        // Blur the input first so the value sticks
        if (isNumberInput) e.target.blur();
        this.setKeyframe();
      } else if (e.key === ' ') {
        if (isTextInput) return;
        e.preventDefault();
        this.togglePlayPause();
      } else if (e.key === 'ArrowRight') {
        if (isNumberInput) return; // Let arrows work in number inputs normally
        if (isTextInput) return;
        e.preventDefault();
        this.jumpToNextKeyframe();
      } else if (e.key === 'ArrowLeft') {
        if (isNumberInput) return;
        if (isTextInput) return;
        e.preventDefault();
        this.jumpToPrevKeyframe();
      } else if (e.key === 't' && e.altKey) {
        e.preventDefault();
        this.setMode('edit');
        this.showToast('✎ Switched to Edit mode', 'info');
      } else if (!isTextInput && !isNumberInput) {
        // Other shortcuts only work when not focused on any input
        if (e.key === 'f' || e.key === 'F') {
          this.focusCenter();
        } else if (e.key === 'r' || e.key === 'R') {
          this.resetCamera();
        }
      }
    });
  }

  setKeyframe() {
    if (this.mode !== 'edit') {
      this.showToast('⚠ Switch to Edit mode first', 'warn');
      return;
    }

    const time = this.timeline.currentTime;
    const trackType = this.timeline.selectedTrack;
    let properties = {};
    let objName = '';

    if (trackType === 'camera') {
      const cam = this.engine.camera;
      const target = this.controls.target;
      properties = {
        position: {
          x: +cam.position.x.toFixed(2),
          y: +cam.position.y.toFixed(2),
          z: +cam.position.z.toFixed(2),
        },
        lookAt: {
          x: +target.x.toFixed(2),
          y: +target.y.toFixed(2),
          z: +target.z.toFixed(2),
        },
      };
      objName = 'Camera';
    } else {
      // Text or Model — use selected scene object
      const objId = this.engine.selectedObjectId;
      const obj = objId ? this.engine.getObjectById(objId) : null;

      if (!obj) {
        this.showToast('⚠ Select an object in Scene Objects first', 'warn');
        return;
      }

      properties = {
        objectId: obj.id,
        position: {
          x: +obj.mesh.position.x.toFixed(2),
          y: +obj.mesh.position.y.toFixed(2),
          z: +obj.mesh.position.z.toFixed(2),
        },
        scale: {
          x: +(obj.mesh.scale?.x || 1).toFixed(2),
          y: +(obj.mesh.scale?.y || 1).toFixed(2),
          z: +(obj.mesh.scale?.z || 1).toFixed(2),
        },
      };
      objName = obj.name;
    }

    // Create keyframe diamond on the timeline
    this.timeline.addKeyframe(trackType, time, properties);

    // Visual feedback
    const trackNames = { camera: '📷 Camera', text: 'T Text', model: '▢ Object' };
    this.showToast(`◆ ${trackNames[trackType] || trackType} "${objName}" at ${time.toFixed(1)}s`, 'success');
    this.flashKeyframeBtn();
  }

  resetCamera() {
    gsap.to(this.engine.camera.position, {
      x: 0, y: 0, z: 15,
      duration: 0.5,
      ease: 'power2.out',
    });
    gsap.to(this.controls.target, {
      x: 0, y: 0, z: 0,
      duration: 0.5,
      ease: 'power2.out',
    });
    this.showToast('⟲ Camera reset', 'info');
  }

  focusCenter() {
    gsap.to(this.controls.target, {
      x: 0, y: 0, z: 0,
      duration: 0.4,
      ease: 'power2.out',
    });
    this.showToast('◎ Focused on center', 'info');
  }

  togglePlayPause() {
    const playBtn = document.getElementById('btn-play');
    this.timeline.togglePlay();
    if (this.timeline.isPlaying) {
      this.setMode('play');
      playBtn.innerHTML = '⏸ Pause';
    } else {
      this.setMode('edit');
      playBtn.innerHTML = '▶ Play';
    }
  }

  jumpToNextKeyframe() {
    const kfs = this.timeline.keyframes
      .filter(kf => kf.time > this.timeline.currentTime + 0.05)
      .sort((a, b) => a.time - b.time);
    if (kfs.length > 0) {
      this.timeline.currentTime = kfs[0].time;
      this.timeline.updateTimelineState();
      this.showToast(`▶ KF at ${kfs[0].time.toFixed(1)}s`, 'info');
    }
  }

  jumpToPrevKeyframe() {
    const kfs = this.timeline.keyframes
      .filter(kf => kf.time < this.timeline.currentTime - 0.05)
      .sort((a, b) => b.time - a.time);
    if (kfs.length > 0) {
      this.timeline.currentTime = kfs[0].time;
      this.timeline.updateTimelineState();
      this.showToast(`◀ KF at ${kfs[0].time.toFixed(1)}s`, 'info');
    }
  }

  toggleMode() {
    if (this.mode === 'edit') {
      this.setMode('play');
    } else {
      this.setMode('edit');
    }
  }

  setMode(mode) {
    this.mode = mode;
    const badge = this.hud.querySelector('#vp-mode-badge');
    const modeIcon = this.hud.querySelector('#vp-mode-icon');
    const modeLabel = this.hud.querySelector('#vp-mode-label');
    const hint = this.hud.querySelector('#vp-controls-hint');
    const keyframeBtn = this.hud.querySelector('#vp-btn-keyframe');

    if (mode === 'edit') {
      badge.className = 'vp-mode-badge edit';
      badge.querySelector('.vp-mode-text').textContent = 'EDIT MODE';
      // Button shows what clicking it WILL DO (switch to Play)
      modeIcon.textContent = '▶';
      modeLabel.textContent = 'Play';
      hint.style.display = '';
      keyframeBtn.disabled = false;
      this.controls.enabled = true;
      this.engine.interactionMode = 'edit';
    } else {
      badge.className = 'vp-mode-badge play';
      badge.querySelector('.vp-mode-text').textContent = 'PLAY MODE';
      // Button shows what clicking it WILL DO (switch to Edit)
      modeIcon.textContent = '✎';
      modeLabel.textContent = 'Edit';
      hint.style.display = 'none';
      keyframeBtn.disabled = true;
      this.controls.enabled = false;
      this.engine.interactionMode = 'play';
    }
  }

  bindTimelineSync() {
    // When timeline starts playing, enter play mode; when stopped go back to edit
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        setTimeout(() => {
          if (this.timeline.isPlaying) {
            this.setMode('play');
          } else {
            this.setMode('edit');
          }
        }, 50);
      });
    }
  }

  startReadoutLoop() {
    const px = this.hud.querySelector('#vp-pos-x');
    const py = this.hud.querySelector('#vp-pos-y');
    const pz = this.hud.querySelector('#vp-pos-z');
    const tx = this.hud.querySelector('#vp-tgt-x');
    const ty = this.hud.querySelector('#vp-tgt-y');
    const tz = this.hud.querySelector('#vp-tgt-z');

    const update = () => {
      const cam = this.engine.camera;
      const tgt = this.controls.target;
      px.textContent = cam.position.x.toFixed(2);
      py.textContent = cam.position.y.toFixed(2);
      pz.textContent = cam.position.z.toFixed(2);
      tx.textContent = tgt.x.toFixed(2);
      ty.textContent = tgt.y.toFixed(2);
      tz.textContent = tgt.z.toFixed(2);
      requestAnimationFrame(update);
    };
    update();
  }

  showToast(message, type = 'info') {
    const toast = this.hud.querySelector('#vp-toast');
    const msg = this.hud.querySelector('#vp-toast-msg');
    msg.textContent = message;
    toast.className = `vp-toast ${type}`;

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2000);
  }

  flashKeyframeBtn() {
    const btn = this.hud.querySelector('#vp-btn-keyframe');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 600);
  }

  startAxisGizmo() {
    const canvas = this.hud.querySelector('#vp-axis-gizmo');
    const ctx = canvas.getContext('2d');
    // Canvas is 140x140 pixels but displayed at 70x70 CSS px (2x for crispness)
    const scale = 2;
    const cssSize = 70;
    const center = (cssSize * scale) / 2; // 70 — center in pixel coords
    const len = 30; // shorter so labels fit inside box

    const drawGizmo = () => {
      ctx.clearRect(0, 0, cssSize * scale, cssSize * scale);

      const cam = this.engine.camera;
      const mat = new THREE.Matrix4().makeRotationFromEuler(cam.rotation);
      const inv = mat.clone().invert();

      const axes = [
        { dir: new THREE.Vector3(1, 0, 0), color: '#ff4757', label: 'X' },
        { dir: new THREE.Vector3(0, 1, 0), color: '#2ed573', label: 'Y' },
        { dir: new THREE.Vector3(0, 0, 1), color: '#3742fa', label: 'Z' },
      ];

      const projected = axes.map(a => {
        const v = a.dir.clone().applyMatrix4(inv);
        return { ...a, px: v.x, py: -v.y, depth: v.z };
      });
      projected.sort((a, b) => a.depth - b.depth);

      // Draw center dot
      ctx.beginPath();
      ctx.arc(center, center, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.globalAlpha = 1;
      ctx.fill();

      for (const ax of projected) {
        const endX = center + ax.px * len;
        const endY = center + ax.py * len;
        const alpha = ax.depth > 0 ? 1 : 0.25;

        // Line
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = ax.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Endpoint circle
        ctx.beginPath();
        ctx.arc(endX, endY, 5, 0, Math.PI * 2);
        ctx.fillStyle = ax.color;
        ctx.globalAlpha = alpha;
        ctx.fill();

        // Label
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = alpha * 0.9;
        ctx.font = `bold ${11 * scale}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelOffset = 10;
        ctx.fillText(ax.label, endX + ax.px * labelOffset, endY + ax.py * labelOffset);
      }
      ctx.globalAlpha = 1;

      requestAnimationFrame(drawGizmo);
    };
    drawGizmo();
  }

  injectStyles() {
    if (document.getElementById('viewport-controls-styles')) return;

    const style = document.createElement('style');
    style.id = 'viewport-controls-styles';
    style.textContent = `
      /* Viewport HUD */
      #viewport-hud {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 20;
      }

      /* Only the toolbar needs pointer-events for button clicks */
      .vp-toolbar {
        pointer-events: auto !important;
      }

      /* Mode Badge */
      .vp-mode-badge {
        position: absolute;
        top: 10px;
        right: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: all 0.3s ease;
      }
      .vp-mode-badge.edit {
        background: rgba(0, 206, 201, 0.15);
        border: 1px solid rgba(0, 206, 201, 0.4);
        color: #00cec9;
      }
      .vp-mode-badge.play {
        background: rgba(253, 203, 110, 0.15);
        border: 1px solid rgba(253, 203, 110, 0.4);
        color: #fdcb6e;
      }
      .vp-mode-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        animation: vpDotPulse 1.5s infinite;
      }
      .vp-mode-badge.edit .vp-mode-dot {
        background: #00cec9;
        box-shadow: 0 0 6px #00cec9;
      }
      .vp-mode-badge.play .vp-mode-dot {
        background: #fdcb6e;
        box-shadow: 0 0 6px #fdcb6e;
      }
      @keyframes vpDotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
      }

      /* Position Readout */
      .vp-position-readout {
        position: absolute;
        bottom: 12px;
        left: 12px;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 8px 12px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
      }
      .vp-pos-row {
        display: flex;
        align-items: center;
        gap: 8px;
        line-height: 1.6;
      }
      .vp-pos-label {
        font-size: 9px;
        font-weight: 800;
        color: #00cec9;
        min-width: 24px;
        letter-spacing: 1px;
      }
      .vp-pos-val {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.75);
        min-width: 48px;
        text-align: right;
      }

      /* Controls Hint */
      .vp-controls-hint {
        position: absolute;
        bottom: 12px;
        right: 12px;
        display: flex;
        gap: 12px;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.35);
      }

      /* Toolbar */
      .vp-toolbar {
        position: absolute;
        top: 50%;
        left: 12px;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 6px;
      }

      .vp-tool-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 8px 10px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        min-width: 56px;
      }
      .vp-tool-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.12);
        color: #fff;
        transform: scale(1.05);
      }
      .vp-tool-btn:active {
        transform: scale(0.95);
      }
      .vp-tool-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        transform: none !important;
      }

      .vp-tool-btn.keyframe {
        color: #ff6b6b;
      }
      .vp-tool-btn.keyframe:hover {
        background: rgba(255, 107, 107, 0.12);
        border-color: rgba(255, 107, 107, 0.3);
        color: #ff6b6b;
        box-shadow: 0 0 12px rgba(255, 107, 107, 0.15);
      }
      .vp-tool-btn.keyframe.flash {
        animation: vpKeyflash 0.6s ease;
      }
      @keyframes vpKeyflash {
        0% { background: rgba(255, 107, 107, 0.5); box-shadow: 0 0 20px rgba(255, 107, 107, 0.4); }
        100% { background: transparent; box-shadow: none; }
      }

      .vp-tool-btn.mode-toggle {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .vp-btn-icon {
        font-size: 18px;
        line-height: 1;
      }
      .vp-btn-label {
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .vp-tool-divider {
        width: 100%;
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 2px 0;
      }

      /* Toast */
      .vp-toast {
        position: absolute;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: all 0.3s ease;
        z-index: 100;
      }
      .vp-toast.hidden {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
      }
      .vp-toast.success {
        background: rgba(255, 107, 107, 0.2);
        border: 1px solid rgba(255, 107, 107, 0.4);
        color: #ff6b6b;
      }
      .vp-toast.info {
        background: rgba(0, 206, 201, 0.15);
        border: 1px solid rgba(0, 206, 201, 0.3);
        color: #00cec9;
      }
      .vp-toast.warn {
        background: rgba(253, 203, 110, 0.15);
        border: 1px solid rgba(253, 203, 110, 0.3);
        color: #fdcb6e;
      }

      .vp-toast-icon {
        font-size: 14px;
      }

      /* Axis Gizmo — small corner widget */
      .vp-axis-gizmo {
        position: absolute;
        bottom: 80px;
        right: 12px;
        width: 70px !important;
        height: 70px !important;
        max-width: 70px !important;
        max-height: 70px !important;
        opacity: 0.7;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
    `;
    document.head.appendChild(style);
  }
}
