import gsap from 'gsap';

export class TimelineManager {
  constructor(engine) {
    this.engine = engine;
    this.duration = 10; // Total timeline duration in seconds
    this.timecode = document.getElementById('timecode');
    this.playhead = document.getElementById('playhead');
    this.trackArea = document.getElementById('track-area');
    
    // Scale: 50px per second
    this.pixelsPerSecond = 50;
    
    // ===== Legacy Clip System (AI generator) =====
    this.clips = [];
    this.clipIdCounter = 0;

    // ===== New Keyframe System =====
    this.keyframes = [];   // { id, trackType, time, properties, ease }
    this.kfIdCounter = 0;
    this.selectedTrack = 'camera';    // Which track is selected for keyframing
    this.selectedKeyframeId = null;   // Currently selected diamond

    // GSAP master timeline synced to scrubber
    this.masterTl = gsap.timeline({ paused: true });
    
    this.isPlaying = false;
    this.currentTime = 0;
    
    this.setupUI();
    this.setupEvents();
    this.setupTrackSelection();
  }
  
  setupUI() {
    // Basic setup, assuming track area is mostly handled by CSS
  }
  
  setupEvents() {
    const playBtn = document.getElementById('btn-play');
    playBtn.addEventListener('click', () => {
      this.togglePlay();
      playBtn.innerHTML = this.isPlaying ? '⏸ Pause' : '▶ Play';
    });
    
    // Scrubber drag logic
    let isDragging = false;
    this.trackArea.addEventListener('mousedown', (e) => {
      // Don't scrub if clicking on a diamond or clip
      if (e.target.closest('.kf-diamond') || e.target.closest('.clip')) return;
      isDragging = true;
      this.updateScrubberFromMouse(e);
      this.pause();
      playBtn.innerHTML = '▶ Play';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        this.updateScrubberFromMouse(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Delete selected keyframe with Del/Backspace
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedKeyframeId !== null) {
        this.deleteKeyframe(this.selectedKeyframeId);
      }
    });
  }

  // ===== Track Selection =====
  setupTrackSelection() {
    const trackLabels = document.querySelectorAll('.track-label');
    trackLabels.forEach(label => {
      // Determine track type from class
      const trackType = ['camera', 'text', 'model', 'sfx'].find(t => label.classList.contains(t)) || 'camera';

      label.addEventListener('click', () => {
        this.selectTrack(trackType);
      });
    });
    // Initially select camera track
    this.selectTrack('camera');
  }

  selectTrack(trackType) {
    this.selectedTrack = trackType;
    // Update visual
    document.querySelectorAll('.track-label').forEach(el => el.classList.remove('selected'));
    const label = document.querySelector(`.track-label.${trackType}`);
    if (label) label.classList.add('selected');
  }
  
  updateScrubberFromMouse(e) {
    const rect = this.trackArea.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    this.currentTime = x / this.pixelsPerSecond;
    this.updateTimelineState();
  }
  
  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.lastTick = performance.now();
      requestAnimationFrame(this.playTick.bind(this));
    }
  }
  
  pause() {
    this.isPlaying = false;
  }
  
  playTick(now) {
    if (!this.isPlaying) return;
    
    const delta = (now - this.lastTick) / 1000;
    this.lastTick = now;
    
    this.currentTime += delta;
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
      this.pause();
      document.getElementById('btn-play').innerHTML = '▶ Play';
    }
    
    this.updateTimelineState();
    
    if (this.isPlaying) {
      requestAnimationFrame(this.playTick.bind(this));
    }
  }
  
  updateTimelineState() {
    // Format timestamp 00:00:00:00
    const minutes = Math.floor(this.currentTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(this.currentTime % 60).toString().padStart(2, '0');
    const frames = Math.floor((this.currentTime % 1) * 60).toString().padStart(2, '0');
    this.timecode.innerText = `00:${minutes}:${seconds}:${frames}`;
    
    // Move visual playhead
    const targetX = this.currentTime * this.pixelsPerSecond;
    this.playhead.style.transform = `translateX(${targetX}px)`;
    
    // Sync GSAP pipeline
    this.masterTl.time(this.currentTime);
  }

  // ============================================================
  //   KEYFRAME SYSTEM — Diamond markers
  // ============================================================

  /**
   * Add a keyframe at a specific time for a specific track type.
   * @param {string} trackType - 'camera' | 'text' | 'model' | 'sfx'
   * @param {number} time - Time in seconds on the timeline
   * @param {object} properties - { position, rotation, scale, lookAt, color, opacity }
   * @param {string} ease - GSAP easing string (default 'power2.inOut')
   * @returns {object} The created keyframe
   */
  addKeyframe(trackType, time, properties, ease = 'power2.inOut') {
    const kf = {
      id: this.kfIdCounter++,
      trackType,
      time: +time.toFixed(2),
      properties,
      ease,
    };
    this.keyframes.push(kf);
    
    // Sort keyframes by time within each track
    this.keyframes.sort((a, b) => {
      if (a.trackType !== b.trackType) return 0;
      return a.time - b.time;
    });

    this.renderKeyframes();
    this.rebuildGSAP();
    return kf;
  }

  deleteKeyframe(kfId) {
    this.keyframes = this.keyframes.filter(kf => kf.id !== kfId);
    if (this.selectedKeyframeId === kfId) this.selectedKeyframeId = null;
    this.renderKeyframes();
    this.rebuildGSAP();
  }

  selectKeyframe(kfId) {
    this.selectedKeyframeId = kfId;
    // Update visual selection
    document.querySelectorAll('.kf-diamond').forEach(el => {
      el.classList.toggle('selected', +el.dataset.kfId === kfId);
    });
  }

  /**
   * Render all keyframe diamonds and interpolation lines on the timeline tracks.
   */
  renderKeyframes() {
    // Clear existing diamonds and interp lines
    document.querySelectorAll('.kf-diamond, .kf-interp-line').forEach(el => el.remove());

    const trackTypes = ['camera', 'text', 'model', 'sfx'];

    for (const type of trackTypes) {
      const track = document.querySelector(`.track[data-type="${type}"]`);
      if (!track) continue;

      const trackKFs = this.keyframes
        .filter(kf => kf.trackType === type)
        .sort((a, b) => a.time - b.time);

      // Draw interpolation lines between consecutive keyframes
      for (let i = 0; i < trackKFs.length - 1; i++) {
        const kfA = trackKFs[i];
        const kfB = trackKFs[i + 1];
        const lineEl = document.createElement('div');
        lineEl.className = `kf-interp-line ${type}`;
        const leftPx = kfA.time * this.pixelsPerSecond;
        const widthPx = (kfB.time - kfA.time) * this.pixelsPerSecond;
        lineEl.style.left = `${leftPx}px`;
        lineEl.style.width = `${widthPx}px`;
        track.appendChild(lineEl);
      }

      // Draw diamond markers
      for (const kf of trackKFs) {
        const diamond = document.createElement('div');
        diamond.className = `kf-diamond ${type}`;
        diamond.dataset.kfId = kf.id;
        diamond.style.left = `${kf.time * this.pixelsPerSecond}px`;

        // Tooltip showing time
        const tooltip = document.createElement('span');
        tooltip.className = 'kf-tooltip';
        tooltip.textContent = `${kf.time.toFixed(1)}s`;
        diamond.appendChild(tooltip);

        // Click to select
        diamond.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectKeyframe(kf.id);
        });

        // Double-click to jump playhead
        diamond.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.currentTime = kf.time;
          this.updateTimelineState();
        });

        // Drag to change time
        this.makeKeyframeDraggable(diamond, kf);

        // Mark as selected if applicable
        if (kf.id === this.selectedKeyframeId) {
          diamond.classList.add('selected');
        }

        track.appendChild(diamond);
      }
    }
  }

  /**
   * Make a keyframe diamond draggable left/right to change its time.
   */
  makeKeyframeDraggable(diamondEl, kf) {
    let isDragging = false;
    let startX = 0;
    let originalLeft = 0;

    const onMouseDown = (e) => {
      if (e.button !== 0) return; // Left click only
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      originalLeft = kf.time * this.pixelsPerSecond;
      diamondEl.classList.add('dragging');
      this.selectKeyframe(kf.id);

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const newLeft = Math.max(0, originalLeft + deltaX);
      diamondEl.style.left = `${newLeft}px`;

      // Update tooltip live
      const newTime = newLeft / this.pixelsPerSecond;
      const tooltip = diamondEl.querySelector('.kf-tooltip');
      if (tooltip) tooltip.textContent = `${newTime.toFixed(1)}s`;
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      diamondEl.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Commit new time
      const finalLeft = parseFloat(diamondEl.style.left);
      kf.time = +(finalLeft / this.pixelsPerSecond).toFixed(2);

      // Re-sort, re-render, re-bake GSAP
      this.keyframes.sort((a, b) => {
        if (a.trackType !== b.trackType) return 0;
        return a.time - b.time;
      });
      this.renderKeyframes();
      this.rebuildGSAP();
      this.updateTimelineState();
    };

    diamondEl.addEventListener('mousedown', onMouseDown);
  }

  // ============================================================
  //   LEGACY CLIP SYSTEM (for AI "Generate Video" pipeline)
  // ============================================================

  addClipVisually(clip) {
    const track = document.querySelector(`.track[data-type="${clip.type}"]`);
    if (!track) return;
    
    const clipEl = document.createElement('div');
    clipEl.className = `clip ${clip.type}`;
    clipEl.dataset.id = clip.id;
    clipEl.style.left = `${clip.startTime * this.pixelsPerSecond}px`;
    clipEl.style.width = `${clip.duration * this.pixelsPerSecond}px`;
    
    const labelEl = document.createElement('span');
    labelEl.className = 'clip-label';
    labelEl.innerText = clip.label;
    clipEl.appendChild(labelEl);

    // Resize Handles
    const leftHandle = document.createElement('div');
    leftHandle.className = 'resize-handle left';
    const rightHandle = document.createElement('div');
    rightHandle.className = 'resize-handle right';
    clipEl.appendChild(leftHandle);
    clipEl.appendChild(rightHandle);

    this.makeClipInteractive(clipEl, leftHandle, rightHandle, clip.id);
    
    track.appendChild(clipEl);
  }

  makeClipInteractive(clipEl, leftHandle, rightHandle, clipId) {
    let mode = '';
    let startX = 0;
    let initialLeft = 0;
    let initialWidth = 0;

    const onMouseDown = (e, m) => {
      e.stopPropagation();
      mode = m;
      startX = e.clientX;
      initialLeft = parseFloat(clipEl.style.left) || 0;
      initialWidth = parseFloat(clipEl.style.width) || 0;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      if (mode === 'drag') {
        const newLeft = Math.max(0, initialLeft + deltaX);
        clipEl.style.left = `${newLeft}px`;
      } else if (mode === 'resize-right') {
        const newWidth = Math.max(10, initialWidth + deltaX);
        clipEl.style.width = `${newWidth}px`;
      } else if (mode === 'resize-left') {
        const newLeft = Math.min(initialLeft + initialWidth - 10, Math.max(0, initialLeft + deltaX));
        const newWidth = initialWidth - (newLeft - initialLeft);
        clipEl.style.left = `${newLeft}px`;
        clipEl.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = () => {
      mode = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      const finalLeft = parseFloat(clipEl.style.left);
      const finalWidth = parseFloat(clipEl.style.width);
      
      const newStartTime = finalLeft / this.pixelsPerSecond;
      const newDuration = finalWidth / this.pixelsPerSecond;
      
      const targetClip = this.clips.find(c => c.id === clipId);
      if (targetClip) {
        targetClip.startTime = newStartTime;
        targetClip.duration = newDuration;
        this.rebuildGSAP();
        this.updateTimelineState();
      }
    };

    clipEl.addEventListener('mousedown', (e) => onMouseDown(e, 'drag'));
    leftHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'resize-left'));
    rightHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'resize-right'));
  }

  // ============================================================
  //   SHARED API
  // ============================================================

  clearTimeline() {
    this.clips = [];
    this.keyframes = [];
    this.selectedKeyframeId = null;
    this.masterTl.clear();
    this.currentTime = 0;
    this.updateTimelineState();
    document.querySelectorAll('.clip, .kf-diamond, .kf-interp-line').forEach(el => el.remove());
  }

  removeClip(clipId) {
    this.clips = this.clips.filter(c => c.id !== clipId);
    const el = document.querySelector(`.clip[data-id="${clipId}"]`);
    if (el) el.remove();
    this.rebuildGSAP();
  }

  createClip(type, startTime, duration, label, params) {
    const clip = {
      id: this.clipIdCounter++,
      type,
      startTime,
      duration,
      label,
      params
    };
    this.clips.push(clip);
    this.addClipVisually(clip);
    this.rebuildGSAP();
  }

  addCameraMove(startTime, duration, x, y, z) {
    this.createClip('camera', startTime, duration, `Cam to ${x},${y}`, { x, y, z });
  }

  addTextDrop(startTime, duration, yStart, yEnd) {
    this.createClip('text', startTime, duration, `Text Drop`, { yStart, yEnd });
  }

  addModel(id, url, startTime, duration, scaleStart, scaleEnd) {
    this.createClip('model', startTime, duration, `Spawn ${id}`, { id, url, scaleStart, scaleEnd });
  }

  addSFX(startTime, duration, label) {
    this.createClip('sfx', startTime, duration, label, {});
  }

  // ============================================================
  //   GSAP REBUILD — Bakes both clips AND keyframes
  // ============================================================

  rebuildGSAP() {
    this.masterTl.clear();
    
    // Calculate total duration from clips + keyframes
    let maxEnd = 10;
    for (let c of this.clips) {
      if (c.startTime + c.duration > maxEnd) maxEnd = c.startTime + c.duration + 1;
    }
    for (let kf of this.keyframes) {
      if (kf.time + 1 > maxEnd) maxEnd = kf.time + 2;
    }
    this.duration = Math.ceil(maxEnd);

    // Expand track widths
    const targetWidth = Math.max(this.duration * this.pixelsPerSecond, document.getElementById('track-area')?.clientWidth || 0);
    document.querySelectorAll('.track').forEach(t => {
      t.style.width = `${targetWidth}px`;
    });

    // RESET to neutral state — but respect keyframes if they exist
    const cameraKFs = this.keyframes.filter(kf => kf.trackType === 'camera').sort((a, b) => a.time - b.time);
    const textKFs = this.keyframes.filter(kf => kf.trackType === 'text').sort((a, b) => a.time - b.time);

    if (cameraKFs.length > 0) {
      // Use first camera keyframe as initial position
      const first = cameraKFs[0].properties.position || { x: -15, y: 5, z: 20 };
      this.engine.camera.position.set(first.x, first.y, first.z);
      if (cameraKFs[0].properties.lookAt) {
        const lt = cameraKFs[0].properties.lookAt;
        this.engine.controls.target.set(lt.x, lt.y, lt.z);
      }
    } else {
      this.engine.camera.position.set(-15, 5, 20);
    }

    if (this.engine.textGen && this.engine.textGen.currentTextMesh) {
      if (textKFs.length > 0) {
        // Use first text keyframe as initial position
        const first = textKFs[0].properties.position || { x: 0, y: 0, z: 0 };
        this.engine.textGen.currentTextMesh.position.set(first.x, first.y, first.z);
      } else {
        // No text keyframes — use default hidden position (only if legacy clips exist)
        const hasTextClips = this.clips.some(c => c.type === 'text');
        if (hasTextClips) {
          this.engine.textGen.currentTextMesh.position.set(0, 10, 0);
          this.masterTl.set(this.engine.textGen.currentTextMesh.position, { y: 10 }, 0);
        }
      }
    }

    // ---- Bake legacy CLIPS into GSAP ----
    const sortedClips = [...this.clips].sort((a,b) => a.startTime - b.startTime);
    let lastCamPos = { x: -15, y: 5, z: 20 };

    for (let clip of sortedClips) {
      if (clip.type === 'camera') {
        const clipEase = clip.params.ease || 'power2.inOut';
        this.masterTl.fromTo(this.engine.camera.position,
          { x: lastCamPos.x, y: lastCamPos.y, z: lastCamPos.z },
          {
            x: clip.params.x,
            y: clip.params.y,
            z: clip.params.z,
            duration: clip.duration,
            ease: clipEase,
            immediateRender: false,
            onUpdate: () => {
              if (clip.params.lookAt) {
                this.engine.camera.lookAt(
                  clip.params.lookAt.x,
                  clip.params.lookAt.y,
                  clip.params.lookAt.z
                );
              }
            }
          }, 
          clip.startTime
        );
        lastCamPos = { x: clip.params.x, y: clip.params.y, z: clip.params.z };
      } 
      else if (clip.type === 'text') {
        if(!this.engine.textGen || !this.engine.textGen.currentTextMesh) continue;
        this.masterTl.fromTo(this.engine.textGen.currentTextMesh.position, 
          { y: clip.params.yStart },
          {
            y: clip.params.yEnd,
            duration: clip.duration,
            ease: "bounce.out",
            immediateRender: false
          }, 
          clip.startTime
        );
      }
      else if (clip.type === 'model') {
        this.engine.loadModel(clip.params.id, clip.params.url, {x: 0, y: -2, z: 0}, clip.params.scaleStart).then((model) => {
          if (!model._gsapBoundTracker) {
            model._gsapBoundTracker = true;
            this.rebuildGSAP();
          }
        });
        const model = this.engine.activeModels[clip.params.id];
        if (model) {
          this.masterTl.set(model.scale, { x: 0, y: 0, z: 0 }, 0);
          this.masterTl.fromTo(model.scale, 
            { x: clip.params.scaleStart, y: clip.params.scaleStart, z: clip.params.scaleStart },
            {
              x: clip.params.scaleEnd,
              y: clip.params.scaleEnd,
              z: clip.params.scaleEnd,
              duration: clip.duration,
              ease: "expo.out",
              immediateRender: false
            }, 
            clip.startTime
          );
        }
      }
    }

    // ---- Bake KEYFRAMES into GSAP ----
    this.bakeKeyframesForTrack('camera');
    this.bakeKeyframesForTrack('text');
    this.bakeKeyframesForTrack('model');

    // Seek to current time
    this.masterTl.time(this.currentTime);
  }

  /**
   * Bake keyframes for a specific track type into the GSAP master timeline.
   * Creates fromTo tweens between consecutive keyframe pairs.
   */
  bakeKeyframesForTrack(trackType) {
    const trackKFs = this.keyframes
      .filter(kf => kf.trackType === trackType)
      .sort((a, b) => a.time - b.time);

    if (trackKFs.length < 2) return;

    for (let i = 0; i < trackKFs.length - 1; i++) {
      const kfA = trackKFs[i];
      const kfB = trackKFs[i + 1];
      const duration = kfB.time - kfA.time;
      if (duration <= 0) continue;

      if (trackType === 'camera') {
        const posA = kfA.properties.position || { x: 0, y: 0, z: 15 };
        const posB = kfB.properties.position || { x: 0, y: 0, z: 15 };
        
        this.masterTl.fromTo(this.engine.camera.position,
          { x: posA.x, y: posA.y, z: posA.z },
          {
            x: posB.x, y: posB.y, z: posB.z,
            duration: duration,
            ease: kfB.ease || 'power2.inOut',
            immediateRender: false,
            onUpdate: () => {
              const lookAt = kfB.properties.lookAt;
              if (lookAt) {
                this.engine.camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
              }
              if (this.engine.controls && lookAt) {
                this.engine.controls.target.set(lookAt.x, lookAt.y, lookAt.z);
              }
            }
          },
          kfA.time
        );
      }
      else if (trackType === 'text' || trackType === 'model') {
        // Find the mesh via objectId stored in the keyframe
        const objId = kfA.properties.objectId || kfB.properties.objectId;
        let mesh = null;

        if (objId) {
          const obj = this.engine.getObjectById(objId);
          if (obj) mesh = obj.mesh;
        }
        // Fallback for legacy text keyframes
        if (!mesh && trackType === 'text' && this.engine.textGen?.currentTextMesh) {
          mesh = this.engine.textGen.currentTextMesh;
        }

        if (!mesh) continue;

        const posA = kfA.properties.position || { x: 0, y: 0, z: 0 };
        const posB = kfB.properties.position || { x: 0, y: 0, z: 0 };

        this.masterTl.fromTo(mesh.position,
          { x: posA.x, y: posA.y, z: posA.z },
          {
            x: posB.x, y: posB.y, z: posB.z,
            duration: duration,
            ease: kfB.ease || 'power2.inOut',
            immediateRender: false,
          },
          kfA.time
        );

        // Also animate scale if both keyframes have scale data
        const scaleA = kfA.properties.scale;
        const scaleB = kfB.properties.scale;
        if (scaleA && scaleB) {
          this.masterTl.fromTo(mesh.scale,
            { x: scaleA.x, y: scaleA.y, z: scaleA.z },
            {
              x: scaleB.x, y: scaleB.y, z: scaleB.z,
              duration: duration,
              ease: kfB.ease || 'power2.inOut',
              immediateRender: false,
            },
            kfA.time
          );
        }
      }
    }
  }
}
