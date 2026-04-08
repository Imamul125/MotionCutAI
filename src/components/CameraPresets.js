/**
 * CameraPresets.js
 * Pre-defined cinematic camera transitions for MotionCutAI
 */

// Easing functions available for camera transitions
export const EASING_OPTIONS = [
  { id: 'power2.inOut',   label: 'Smooth',           icon: '〰️' },
  { id: 'power4.inOut',   label: 'Dramatic',         icon: '⚡' },
  { id: 'expo.inOut',     label: 'Cinematic',        icon: '🎬' },
  { id: 'elastic.out',    label: 'Elastic',          icon: '🪀' },
  { id: 'back.inOut',     label: 'Overshoot',        icon: '↩️' },
  { id: 'sine.inOut',     label: 'Gentle',           icon: '🌊' },
  { id: 'none',           label: 'Linear',           icon: '📏' },
  { id: 'steps(12)',      label: 'Stop Motion',      icon: '🎞️' },
];

// Pre-built camera position presets
export const CAMERA_PRESETS = [
  {
    id: 'wide-establishing',
    label: 'Wide Establishing',
    icon: '🌐',
    description: 'Classic wide shot looking at the scene from a distance',
    position: { x: 0, y: 3, z: 25 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'power2.inOut',
    category: 'static',
  },
  {
    id: 'close-up',
    label: 'Close Up',
    icon: '🔍',
    description: 'Tight close-up on center subject',
    position: { x: 0, y: 0, z: 5 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'expo.inOut',
    category: 'static',
  },
  {
    id: 'top-down',
    label: 'Bird\'s Eye',
    icon: '🦅',
    description: 'Overhead aerial view looking straight down',
    position: { x: 0, y: 20, z: 0.01 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'power4.inOut',
    category: 'static',
  },
  {
    id: 'low-hero',
    label: 'Low Hero',
    icon: '🦸',
    description: 'Low angle hero shot looking up at subject',
    position: { x: 3, y: -3, z: 10 },
    lookAt: { x: 0, y: 2, z: 0 },
    defaultEase: 'power2.inOut',
    category: 'static',
  },
  {
    id: 'dutch-angle',
    label: 'Dutch Angle',
    icon: '📐',
    description: 'Tilted dramatic camera angle',
    position: { x: 8, y: 6, z: 8 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'power2.inOut',
    category: 'static',
  },
  {
    id: 'orbit-left',
    label: 'Orbit Left',
    icon: '↪️',
    description: 'Camera sweeps from right to left around the subject',
    position: { x: -12, y: 3, z: 10 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'sine.inOut',
    category: 'move',
  },
  {
    id: 'orbit-right',
    label: 'Orbit Right',
    icon: '↩️',
    description: 'Camera sweeps from left to right around the subject',
    position: { x: 12, y: 3, z: 10 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'sine.inOut',
    category: 'move',
  },
  {
    id: 'dolly-in',
    label: 'Dolly In',
    icon: '🎯',
    description: 'Smooth push-in toward subject',
    position: { x: 0, y: 0, z: 6 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'expo.inOut',
    category: 'move',
  },
  {
    id: 'dolly-out',
    label: 'Dolly Out',
    icon: '🔭',
    description: 'Pull away from subject to reveal the scene',
    position: { x: 0, y: 2, z: 22 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'power2.inOut',
    category: 'move',
  },
  {
    id: 'crane-up',
    label: 'Crane Up',
    icon: '⬆️',
    description: 'Camera rises upward like a crane shot',
    position: { x: 0, y: 14, z: 12 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'power4.inOut',
    category: 'move',
  },
  {
    id: 'crane-down',
    label: 'Crane Down',
    icon: '⬇️',
    description: 'Camera descends from above',
    position: { x: 0, y: -2, z: 12 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'power4.inOut',
    category: 'move',
  },
  {
    id: 'whip-pan',
    label: 'Whip Pan',
    icon: '💨',
    description: 'Ultra-fast horizontal camera sweep',
    position: { x: -18, y: 2, z: 8 },
    lookAt: { x: 0, y: 0, z: 0 },
    defaultEase: 'power4.inOut',
    category: 'move',
  },
];

/**
 * returns preset object by id
 */
export function getPresetById(id) {
  return CAMERA_PRESETS.find(p => p.id === id) || null;
}

/**
 * returns easing object by id
 */
export function getEasingById(id) {
  return EASING_OPTIONS.find(e => e.id === id) || EASING_OPTIONS[0];
}
