import gsap from 'gsap';

export class TimelineManager {
  constructor(engine) {
    this.engine = engine;
    this.duration = 10; // Total timeline duration in seconds
    this.timecode = document.getElementById('timecode');
    this.playhead = document.getElementById('playhead');
    this.trackArea = document.getElementById('track-area');
    
    // Scale: 50px per second. Max 10s = 500px wide for simplicity
    this.pixelsPerSecond = 50;
    
    // Core State Arrays
    this.clips = [];
    this.clipIdCounter = 0;

    // GSAP master timeline synced to scrubber
    this.masterTl = gsap.timeline({ paused: true });
    
    this.isPlaying = false;
    this.currentTime = 0;
    
    this.setupUI();
    this.setupEvents();
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
    
    // Scrubber drag logic (basic implementation)
    let isDragging = false;
    this.trackArea.addEventListener('mousedown', (e) => {
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
      this.currentTime = 0; // Loop or stop
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
    // For now we don't have clips, so GSAP master is empty, but we seek it
    this.masterTl.time(this.currentTime);
  }
  
  // --- DOM Interaction ---
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
    let mode = ''; // 'drag', 'resize-left', 'resize-right'
    let startX = 0;
    let initialLeft = 0;
    let initialWidth = 0;

    const onMouseDown = (e, m) => {
      e.stopPropagation(); // Stop timeline scrubber from moving
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
      
      // Sync DOM visual state back to Engine State
      const finalLeft = parseFloat(clipEl.style.left);
      const finalWidth = parseFloat(clipEl.style.width);
      
      const newStartTime = finalLeft / this.pixelsPerSecond;
      const newDuration = finalWidth / this.pixelsPerSecond;
      
      const targetClip = this.clips.find(c => c.id === clipId);
      if (targetClip) {
        targetClip.startTime = newStartTime;
        targetClip.duration = newDuration;
        this.rebuildGSAP(); // Re-bake the 3D timeline!
        this.updateTimelineState(); // Snap 3D Scene to newly baked keyframes
      }
    };

    clipEl.addEventListener('mousedown', (e) => onMouseDown(e, 'drag'));
    leftHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'resize-left'));
    rightHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'resize-right'));
  }

  // --- Engine State API ---
  clearTimeline() {
    this.clips = [];
    this.masterTl.clear();
    this.currentTime = 0;
    this.updateTimelineState();
    document.querySelectorAll('.clip').forEach(el => el.remove());
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

  // Re-bake all GSAP tweens from scratch based on clips array
  rebuildGSAP() {
    this.masterTl.clear();
    
    // Update total duration dynamically (min 10s or max clip end + 1s padding)
    let maxEnd = 10;
    for (let c of this.clips) {
      if (c.startTime + c.duration > maxEnd) maxEnd = c.startTime + c.duration + 1;
    }
    this.duration = Math.ceil(maxEnd);

    // Expand the physical DOM tracks to allow horizontal scrolling
    const targetWidth = Math.max(this.duration * this.pixelsPerSecond, document.getElementById('track-area').clientWidth || 0);
    document.querySelectorAll('.track').forEach(t => {
      t.style.width = `${targetWidth}px`;
    });

    // PHYSICAL ZERO-STATE RESET
    // We physically force the camera and text to their neutral spots so GSAP compiles cleanly
    this.engine.camera.position.set(-15, 5, 20); 
    if (this.engine.textGen && this.engine.textGen.currentTextMesh) {
      this.engine.textGen.currentTextMesh.position.set(0, 10, 0); // Hide high up
      // Add a fallback in GSAP just in case it scrubs left
      this.masterTl.set(this.engine.textGen.currentTextMesh.position, { y: 10 }, 0);
    }

    // Sort clips sequentially just in case
    const sorted = [...this.clips].sort((a,b) => a.startTime - b.startTime);

    let lastCamPos = { x: -15, y: 5, z: 20 };

    for (let clip of sorted) {
      if (clip.type === 'camera') {
        this.masterTl.fromTo(this.engine.camera.position,
          { x: lastCamPos.x, y: lastCamPos.y, z: lastCamPos.z },
          {
            x: clip.params.x,
            y: clip.params.y,
            z: clip.params.z,
            duration: clip.duration,
            ease: "power2.inOut",
            immediateRender: false
          }, 
          clip.startTime
        );
        // Save target for the next camera clip!
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
        // Trigger async load, but we can't block GSAP creation synchronously.
        // Once loaded, the engine caches the object. We GSAP the cached object if it exists.
        this.engine.loadModel(clip.params.id, clip.params.url, {x: 0, y: -2, z: 0}, clip.params.scaleStart).then((model) => {
          if (!model._gsapBoundTracker) {
            model._gsapBoundTracker = true;
            this.rebuildGSAP(); // Force GSAP to map the new object now that it exists in memory!
          }
        });
        
        // If the model exists locally in cache, map GSAP to it!
        const model = this.engine.activeModels[clip.params.id];
        if (model) {
          // Always hide model at T=0
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
    
    // Immediately seek timeline to current playhead so visuals update without needing to trigger a scrub event
    this.masterTl.time(this.currentTime);
  }
}
