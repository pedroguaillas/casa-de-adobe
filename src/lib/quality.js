// ─────────────────────────────────────────────────────────────────────────────
// Device detection + quality tiers.
// Resolved once at module load. Client-only (HouseTour is client:only="react").
// ─────────────────────────────────────────────────────────────────────────────

const hasWindow = typeof window !== 'undefined';

export const isTouch =
  hasWindow && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

function detectTier() {
  if (!hasWindow) return 'high';
  const mem = navigator.deviceMemory || 4;          // GB, non-standard but widely shipped
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);

  // Phones / small tablets
  if (coarse && shortSide < 900) return mem <= 4 || cores <= 6 ? 'low' : 'medium';
  // Weak laptops
  if (mem <= 4 && cores <= 4) return 'medium';
  return 'high';
}

export const TIER = detectTier();

const TIERS = {
  low: {
    dpr: [0.7, 1.2], shadows: false, shadowMap: 512, env: 32,
    texSize: 256, aniso: 2, trees: 3, fillLights: 2,
    antialias: false, far: 120, fog: [20, 60], fov: 82,
  },
  medium: {
    dpr: [0.8, 1.5], shadows: true, shadowMap: 1024, env: 64,
    texSize: 512, aniso: 4, trees: 5, fillLights: 4,
    antialias: false, far: 200, fog: [26, 75], fov: 78,
  },
  high: {
    dpr: [1, 2], shadows: true, shadowMap: 2048, env: 128,
    texSize: 512, aniso: 8, trees: 6, fillLights: 6,
    antialias: true, far: 300, fog: [30, 90], fov: 72,
  },
};

export const QUALITY = TIERS[TIER];
