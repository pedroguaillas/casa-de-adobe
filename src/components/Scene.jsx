import { Environment } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Casa de Adobe — procedural placeholder built from the architectural plans
// (resources/CASA DE ADOVE *.pdf) and the 3D renders (resources/*.jpeg).
//
// REPLACE the <ProceduralHouse /> with RealHouse once casa.glb is ready:
//
//   function RealHouse() {
//     const { scene } = useGLTF('/models/casa.glb');
//     return (
//       <RigidBody type="fixed" colliders="trimesh">
//         <primitive object={scene} />
//       </RigidBody>
//     );
//   }
// ─────────────────────────────────────────────────────────────────────────────

// House dimensions from plans (meters)
const W = 9.95;          // width  (X)
const D = 7.5;           // depth  (Z) — front facade faces +Z
const T = 0.2;           // wall thickness
const hw = W / 2;
const hd = D / 2;

// Vertical levels
const F1 = 0.2;          // ground-floor walking surface (slab 0 → 0.2)
const C1 = 2.8;          // ground-floor ceiling = bottom of level-2 slab
const F2 = 3.0;          // second-floor walking surface (slab 2.8 → 3.0)
const C2 = 5.4;          // second-floor ceiling / top of upper walls

// Stairwell — straight run along X, matches the renders (stairs at plan center)
const STAIR_X0 = -2.3;   // first riser
const STAIR_STEPS = 16;
const STAIR_RUN  = 0.28;
const STAIR_RISE = (F2 - F1) / STAIR_STEPS; // 0.175
const STAIR_W    = 1.2;
const STAIR_ZC   = -0.5; // stairs span z ∈ [-1.1, 0.1]
// Slab opening above the stairs — sized so the 2.1m player capsule clears the
// slab edge while climbing (capsule top ≤ 2.8 only up to step 2)
const HOLE = { x0: -2.0, x1: 2.4, z0: -1.2, z1: 0.2 };

// ─── Materials (shared instances) ────────────────────────────────────────────
const MAT = {
  adobe:     new THREE.MeshStandardMaterial({ color: '#C8A96E', roughness: 0.92 }),
  adobeSide: new THREE.MeshStandardMaterial({ color: '#BDA080', roughness: 0.92 }),
  concrete:  new THREE.MeshStandardMaterial({ color: '#CFC6B8', roughness: 0.8 }),
  woodFloor: new THREE.MeshStandardMaterial({ color: '#B98A5A', roughness: 0.7 }),
  ceiling:   new THREE.MeshStandardMaterial({ color: '#EDE0CC', roughness: 0.85 }),
  grass:     new THREE.MeshStandardMaterial({ color: '#5A7A3A', roughness: 1.0 }),
  wood:      new THREE.MeshStandardMaterial({ color: '#6B4226', roughness: 0.7 }),
  woodLight: new THREE.MeshStandardMaterial({ color: '#A97B4F', roughness: 0.7 }),
  tile:      new THREE.MeshStandardMaterial({ color: '#C77B5B', roughness: 0.8 }),
  stone:     new THREE.MeshStandardMaterial({ color: '#8E8175', roughness: 0.95 }),
  frame:     new THREE.MeshStandardMaterial({ color: '#1C1C1C', roughness: 0.5 }),
  glass:     new THREE.MeshPhysicalMaterial({
    color: '#9BBCCB', transparent: true, opacity: 0.28,
    roughness: 0.08, metalness: 0, depthWrite: false,
  }),
  kitchenRed: new THREE.MeshStandardMaterial({ color: '#A5352C', roughness: 0.6 }),
  white:     new THREE.MeshStandardMaterial({ color: '#F2EFE9', roughness: 0.6 }),
  fabric:    new THREE.MeshStandardMaterial({ color: '#D9D2C3', roughness: 0.95 }),
  purple:    new THREE.MeshStandardMaterial({ color: '#8B5FBF', roughness: 0.9 }),
  poolGreen: new THREE.MeshStandardMaterial({ color: '#2FA33B', roughness: 0.85 }),
  black:     new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4 }),
  leaf:      new THREE.MeshStandardMaterial({ color: '#4E7A32', roughness: 1.0 }),
  trunk:     new THREE.MeshStandardMaterial({ color: '#7A5A3A', roughness: 1.0 }),
};

// ─── Primitive helpers ───────────────────────────────────────────────────────

// Box from min/max bounds — walls with openings become simple segment lists
function BB({ min, max, mat, castShadow = false, receiveShadow = true }) {
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const pos  = [(max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2];
  return (
    <mesh position={pos} castShadow={castShadow} receiveShadow={receiveShadow} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Box({ pos, size, mat, rot, castShadow = false, receiveShadow = true }) {
  return (
    <mesh position={pos} rotation={rot} castShadow={castShadow} receiveShadow={receiveShadow} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  );
}

// Window inside an X-running wall (wall plane at fixed z): sill + lintel + glass
function WinX({ x0, x1, y0, y1, z0, z1, yb, yt, mat }) {
  const zc = (z0 + z1) / 2;
  return (
    <>
      <BB min={[x0, yb, z0]} max={[x1, y0, z1]} mat={mat} castShadow />
      <BB min={[x0, y1, z0]} max={[x1, yt, z1]} mat={mat} castShadow />
      {/* frame + glass */}
      <BB min={[x0, y0, zc - 0.04]} max={[x1, y1, zc + 0.04]} mat={MAT.frame} />
      <BB min={[x0 + 0.06, y0 + 0.06, zc - 0.015]} max={[x1 - 0.06, y1 - 0.06, zc + 0.015]} mat={MAT.glass} receiveShadow={false} />
    </>
  );
}

// Window inside a Z-running wall (wall plane at fixed x)
function WinZ({ z0, z1, y0, y1, x0, x1, yb, yt, mat }) {
  const xc = (x0 + x1) / 2;
  return (
    <>
      <BB min={[x0, yb, z0]} max={[x1, y0, z1]} mat={mat} castShadow />
      <BB min={[x0, y1, z0]} max={[x1, yt, z1]} mat={mat} castShadow />
      <BB min={[xc - 0.04, y0, z0]} max={[xc + 0.04, y1, z1]} mat={MAT.frame} />
      <BB min={[xc - 0.015, y0 + 0.06, z0 + 0.06]} max={[xc + 0.015, y1 - 0.06, z1 - 0.06]} mat={MAT.glass} receiveShadow={false} />
    </>
  );
}

// ─── Stairs ──────────────────────────────────────────────────────────────────

function Stairs() {
  return (
    <>
      {Array.from({ length: STAIR_STEPS }, (_, i) => (
        <Box
          key={i}
          pos={[STAIR_X0 + (i + 0.5) * STAIR_RUN, F1 + i * STAIR_RISE + STAIR_RISE / 2, STAIR_ZC]}
          size={[STAIR_RUN, STAIR_RISE, STAIR_W]}
          mat={MAT.woodLight}
          castShadow
        />
      ))}
      {/* closed stringer under the steps (matches the wooden stair volume in renders) */}
      <Box pos={[STAIR_X0 + (STAIR_STEPS * STAIR_RUN) / 2, F1 + (F2 - F1) / 2 - 0.35, STAIR_ZC]}
           rot={[0, 0, Math.atan2(F2 - F1, STAIR_STEPS * STAIR_RUN)]}
           size={[Math.hypot(STAIR_STEPS * STAIR_RUN, F2 - F1), 0.12, STAIR_W]}
           mat={MAT.wood} castShadow />
      {/* invisible ramp collider along the step noses — the character controller
          climbs this as a 32° slope; rapier autostep alone stalls on the risers.
          NOTE: must be an explicit collider — invisible meshes generate none. */}
      <CuboidCollider
        args={[2.64, 0.03, STAIR_W / 2]}
        position={[-0.34, 1.57, STAIR_ZC]}
        rotation={[0, 0, Math.atan2(F2 - F1, STAIR_STEPS * STAIR_RUN)]}
      />
    </>
  );
}

// Wooden guardrail: horizontal run along X or Z with posts + two rails
function Rail({ from, to, yBase }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const alongX = Math.abs(dx) > Math.abs(dz);
  const n = Math.max(2, Math.round(len / 1.1) + 1);
  const posts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return [from[0] + dx * t, from[1] + dz * t];
  });
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  return (
    <>
      {posts.map(([px, pz], i) => (
        <Box key={i} pos={[px, yBase + 0.5, pz]} size={[0.07, 1.0, 0.07]} mat={MAT.wood} castShadow />
      ))}
      <Box pos={[cx, yBase + 0.97, cz]} size={alongX ? [len, 0.07, 0.09] : [0.09, 0.07, len]} mat={MAT.wood} />
      <Box pos={[cx, yBase + 0.55, cz]} size={alongX ? [len, 0.05, 0.05] : [0.05, 0.05, len]} mat={MAT.wood} />
    </>
  );
}

// ─── Ground floor ────────────────────────────────────────────────────────────

function GroundFloor() {
  return (
    <>
      {/* Slab (walking surface at y = F1) */}
      <BB min={[-hw, 0, -hd]} max={[hw, F1, hd]} mat={MAT.concrete} />

      {/* ── FRONT wall (z = hd) — entry + windows, chimney zone solid ── */}
      <BB min={[-hw, F1, hd - T]}  max={[-4.5, C1, hd]} mat={MAT.adobe} castShadow />
      <WinX x0={-4.5} x1={-3.6} y0={1.4} y1={2.2} yb={F1} yt={C1} z0={hd - T} z1={hd} mat={MAT.adobe} />
      <BB min={[-3.6, F1, hd - T]} max={[-2.9, C1, hd]} mat={MAT.adobe} castShadow />
      <WinX x0={-2.9} x1={-1.5} y0={0.8} y1={2.3} yb={F1} yt={C1} z0={hd - T} z1={hd} mat={MAT.adobe} />
      <BB min={[-1.5, F1, hd - T]} max={[-0.9, C1, hd]} mat={MAT.adobe} castShadow />
      {/* entry opening x ∈ [-0.9, 0.9]: lintel + black steel frame posts */}
      <BB min={[-0.9, 2.3, hd - T]} max={[0.9, C1, hd]} mat={MAT.adobe} castShadow />
      <BB min={[-0.9, F1, hd - T]}  max={[-0.82, 2.3, hd]} mat={MAT.frame} />
      <BB min={[0.82, F1, hd - T]}  max={[0.9, 2.3, hd]}  mat={MAT.frame} />
      <BB min={[0.9, F1, hd - T]}   max={[2.3, C1, hd]}   mat={MAT.adobe} castShadow />
      <BB min={[2.3, F1, hd - T]}   max={[2.6, C1, hd]}   mat={MAT.adobe} castShadow />
      <WinX x0={2.6} x1={4.3} y0={0.8} y1={2.3} yb={F1} yt={C1} z0={hd - T} z1={hd} mat={MAT.adobe} />
      <BB min={[4.3, F1, hd - T]}   max={[hw, C1, hd]}    mat={MAT.adobe} castShadow />

      {/* ── BACK wall (z = -hd) ── */}
      <BB min={[-hw, F1, -hd]} max={[-3.4, C1, -hd + T]} mat={MAT.adobe} castShadow />
      <WinX x0={-3.4} x1={-1.2} y0={0.9} y1={2.3} yb={F1} yt={C1} z0={-hd} z1={-hd + T} mat={MAT.adobe} />
      <BB min={[-1.2, F1, -hd]} max={[1.2, C1, -hd + T]} mat={MAT.adobe} castShadow />
      <WinX x0={1.2} x1={3.6} y0={1.1} y1={2.3} yb={F1} yt={C1} z0={-hd} z1={-hd + T} mat={MAT.adobe} />
      <BB min={[3.6, F1, -hd]} max={[hw, C1, -hd + T]} mat={MAT.adobe} castShadow />

      {/* ── LEFT wall (x = -hw) ── */}
      <BB min={[-hw, F1, -hd]} max={[-hw + T, C1, -2.8]} mat={MAT.adobeSide} castShadow />
      <WinZ z0={-2.8} z1={-0.6} y0={0.8} y1={2.3} yb={F1} yt={C1} x0={-hw} x1={-hw + T} mat={MAT.adobeSide} />
      <BB min={[-hw, F1, -0.6]} max={[-hw + T, C1, hd]} mat={MAT.adobeSide} castShadow />

      {/* ── RIGHT wall (x = hw) — celosía (perforated brick lattice) + window ── */}
      <BB min={[hw - T, F1, -hd]} max={[hw, C1, -1.8]} mat={MAT.adobeSide} castShadow />
      {/* celosía zone z ∈ [-1.8, 0.2], y ∈ [0.9, 2.15] */}
      <BB min={[hw - T, F1, -1.8]}  max={[hw, 0.9, 0.2]} mat={MAT.adobeSide} castShadow />
      <BB min={[hw - T, 2.15, -1.8]} max={[hw, C1, 0.2]} mat={MAT.adobeSide} castShadow />
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 8 }, (_, c) =>
          (r + c) % 2 === 0 ? (
            <Box key={`cel${r}-${c}`}
                 pos={[hw - T / 2, 0.9 + r * 0.25 + 0.125, -1.8 + c * 0.25 + 0.125]}
                 size={[T, 0.25, 0.25]} mat={MAT.adobeSide} castShadow />
          ) : null
        )
      )}
      <BB min={[hw - T, F1, 0.2]} max={[hw, C1, 1.4]} mat={MAT.adobeSide} castShadow />
      <WinZ z0={1.4} z1={3.0} y0={0.8} y1={2.3} yb={F1} yt={C1} x0={hw - T} x1={hw} mat={MAT.adobeSide} />
      <BB min={[hw - T, F1, 3.0]} max={[hw, C1, hd]} mat={MAT.adobeSide} castShadow />

      {/* ── Interior: bathroom (stone, front-left corner) ── */}
      <BB min={[-hw + T, F1, 1.78]} max={[-3.2, C1, 1.9]} mat={MAT.stone} castShadow />
      <BB min={[-3.32, F1, 1.9]} max={[-3.2, C1, 2.3]} mat={MAT.stone} castShadow />
      <BB min={[-3.32, 2.3, 2.3]} max={[-3.2, C1, 3.1]} mat={MAT.stone} />
      <BB min={[-3.32, F1, 3.1]} max={[-3.2, C1, hd - T]} mat={MAT.stone} castShadow />
      {/* fixtures */}
      <Box pos={[-4.4, 0.45, 3.3]} size={[0.45, 0.5, 0.65]} mat={MAT.white} />
      <Box pos={[-4.5, 0.85, 2.3]} size={[0.5, 0.12, 0.5]} mat={MAT.white} />
      <Box pos={[-4.5, 0.5, 2.3]} size={[0.18, 0.6, 0.18]} mat={MAT.stone} />

      {/* ── Interior: partition estudio / stair zone ── */}
      <BB min={[-1.6, F1, -hd + T]} max={[-1.4, C1, -1.2]} mat={MAT.adobe} castShadow />

      {/* ── Stairs ── */}
      <Stairs />

      {/* ── Kitchen (back-right, red cabinets per renders) ── */}
      <Box pos={[2.65, 0.65, -3.25]} size={[4.1, 0.9, 0.6]} mat={MAT.kitchenRed} castShadow />
      <Box pos={[2.65, 1.13, -3.25]} size={[4.2, 0.06, 0.7]} mat={MAT.woodLight} />
      <Box pos={[4.4, 1.1, -3.2]}  size={[0.7, 1.8, 0.65]} mat={MAT.white} castShadow />
      {/* island */}
      <Box pos={[2.4, 0.65, -2.1]} size={[1.6, 0.9, 0.7]} mat={MAT.kitchenRed} castShadow />
      <Box pos={[2.4, 1.13, -2.1]} size={[1.7, 0.06, 0.8]} mat={MAT.woodLight} />

      {/* ── Game room / estudio (left): pool table + piano ── */}
      <Box pos={[-3.4, 0.62, -1.8]} size={[2.2, 0.28, 1.2]} mat={MAT.wood} castShadow />
      <Box pos={[-3.4, 0.79, -1.8]} size={[2.1, 0.06, 1.1]} mat={MAT.poolGreen} />
      {[[-4.3, -2.25], [-2.5, -2.25], [-4.3, -1.35], [-2.5, -1.35]].map(([x, z], i) => (
        <Box key={`pl${i}`} pos={[x, 0.28, z]} size={[0.14, 0.56, 0.14]} mat={MAT.wood} />
      ))}
      <Box pos={[-3.6, 0.75, -3.35]} size={[1.5, 1.1, 0.6]} mat={MAT.black} castShadow />
      <Box pos={[-3.6, 0.3, -2.75]} size={[0.7, 0.5, 0.35]} mat={MAT.black} />

      {/* ── Sala (front-right): sofa + coffee table ── */}
      <Box pos={[3.0, 0.45, 3.0]} size={[1.9, 0.5, 0.8]} mat={MAT.fabric} castShadow />
      <Box pos={[3.0, 0.85, 3.3]} size={[1.9, 0.55, 0.25]} mat={MAT.fabric} />
      <Box pos={[2.0, 0.65, 3.0]} size={[0.25, 0.55, 0.8]} mat={MAT.fabric} />
      <Box pos={[4.0, 0.65, 3.0]} size={[0.25, 0.55, 0.8]} mat={MAT.fabric} />
      <Box pos={[3.0, 0.42, 1.9]} size={[0.95, 0.34, 0.5]} mat={MAT.woodLight} castShadow />

      {/* ── Comedor (mid-right): table + 4 chairs ── */}
      <Box pos={[3.5, 0.93, 0.6]} size={[1.4, 0.08, 0.9]} mat={MAT.woodLight} castShadow />
      <Box pos={[3.5, 0.55, 0.6]} size={[0.18, 0.7, 0.18]} mat={MAT.wood} />
      {[[2.95, 1.25], [4.05, 1.25], [2.95, -0.05], [4.05, -0.05]].map(([x, z], i) => (
        <Box key={`ch${i}`} pos={[x, 0.45, z]} size={[0.42, 0.85, 0.42]} mat={MAT.woodLight} />
      ))}
    </>
  );
}

// ─── Second floor ────────────────────────────────────────────────────────────

function SecondFloor() {
  return (
    <>
      {/* Slab pieces around the stairwell opening */}
      <BB min={[-hw, C1, -hd]}      max={[HOLE.x0, F2, hd]}      mat={MAT.woodFloor} />
      <BB min={[HOLE.x1, C1, -hd]}  max={[hw, F2, hd]}           mat={MAT.woodFloor} />
      <BB min={[HOLE.x0, C1, -hd]}  max={[HOLE.x1, F2, HOLE.z0]} mat={MAT.woodFloor} />
      <BB min={[HOLE.x0, C1, HOLE.z1]} max={[HOLE.x1, F2, hd]}   mat={MAT.woodFloor} />

      {/* Guardrail around the stairwell (3 sides; arrival side open) */}
      <Rail from={[HOLE.x0, HOLE.z1]} to={[HOLE.x1, HOLE.z1]} yBase={F2} />
      <Rail from={[HOLE.x0, HOLE.z0]} to={[HOLE.x0, HOLE.z1]} yBase={F2} />
      <Rail from={[HOLE.x0, HOLE.z0]} to={[HOLE.x1, HOLE.z0]} yBase={F2} />

      {/* Ceiling */}
      <BB min={[-hw + T, C2, -hd + T]} max={[hw - T, C2 + 0.1, hd - T]} mat={MAT.ceiling} />

      {/* ── FRONT wall (z = hd): balcony door + bedroom windows ── */}
      <BB min={[-hw, F2, hd - T]} max={[-4.3, C2, hd]} mat={MAT.adobe} castShadow />
      <WinX x0={-4.3} x1={-1.3} y0={3.4} y1={5.1} yb={F2} yt={C2} z0={hd - T} z1={hd} mat={MAT.adobe} />
      <BB min={[-1.3, F2, hd - T]} max={[-0.8, C2, hd]} mat={MAT.adobe} castShadow />
      {/* balcony door opening x ∈ [-0.8, 0.8] */}
      <BB min={[-0.8, 5.1, hd - T]} max={[0.8, C2, hd]} mat={MAT.adobe} />
      <BB min={[-0.8, F2, hd - T]} max={[-0.72, 5.1, hd]} mat={MAT.frame} />
      <BB min={[0.72, F2, hd - T]} max={[0.8, 5.1, hd]} mat={MAT.frame} />
      <BB min={[0.8, F2, hd - T]} max={[2.7, C2, hd]} mat={MAT.adobe} castShadow />
      <WinX x0={2.7} x1={4.4} y0={3.4} y1={5.1} yb={F2} yt={C2} z0={hd - T} z1={hd} mat={MAT.adobe} />
      <BB min={[4.4, F2, hd - T]} max={[hw, C2, hd]} mat={MAT.adobe} castShadow />

      {/* ── BACK wall ── */}
      <BB min={[-hw, F2, -hd]} max={[-4.2, C2, -hd + T]} mat={MAT.adobe} castShadow />
      <WinX x0={-4.2} x1={-2.0} y0={3.4} y1={5.1} yb={F2} yt={C2} z0={-hd} z1={-hd + T} mat={MAT.adobe} />
      <BB min={[-2.0, F2, -hd]} max={[-0.9, C2, -hd + T]} mat={MAT.adobe} castShadow />
      <WinX x0={-0.9} x1={0.1} y0={3.9} y1={4.9} yb={F2} yt={C2} z0={-hd} z1={-hd + T} mat={MAT.adobe} />
      <BB min={[0.1, F2, -hd]} max={[2.4, C2, -hd + T]} mat={MAT.adobe} castShadow />
      <WinX x0={2.4} x1={4.2} y0={3.4} y1={5.1} yb={F2} yt={C2} z0={-hd} z1={-hd + T} mat={MAT.adobe} />
      <BB min={[4.2, F2, -hd]} max={[hw, C2, -hd + T]} mat={MAT.adobe} castShadow />

      {/* ── LEFT wall ── */}
      <BB min={[-hw, F2, -hd]} max={[-hw + T, C2, -3.0]} mat={MAT.adobeSide} castShadow />
      <WinZ z0={-3.0} z1={-1.9} y0={3.4} y1={5.1} yb={F2} yt={C2} x0={-hw} x1={-hw + T} mat={MAT.adobeSide} />
      <BB min={[-hw, F2, -1.9]} max={[-hw + T, C2, 1.3]} mat={MAT.adobeSide} castShadow />
      <WinZ z0={1.3} z1={2.9} y0={3.4} y1={5.1} yb={F2} yt={C2} x0={-hw} x1={-hw + T} mat={MAT.adobeSide} />
      <BB min={[-hw, F2, 2.9]} max={[-hw + T, C2, hd]} mat={MAT.adobeSide} castShadow />

      {/* ── RIGHT wall ── */}
      <BB min={[hw - T, F2, -hd]} max={[hw, C2, -1.5]} mat={MAT.adobeSide} castShadow />
      <WinZ z0={-1.5} z1={0.1} y0={3.4} y1={5.1} yb={F2} yt={C2} x0={hw - T} x1={hw} mat={MAT.adobeSide} />
      <BB min={[hw - T, F2, 0.1]} max={[hw, C2, 1.8]} mat={MAT.adobeSide} castShadow />
      <WinZ z0={1.8} z1={3.2} y0={3.4} y1={5.1} yb={F2} yt={C2} x0={hw - T} x1={hw} mat={MAT.adobeSide} />
      <BB min={[hw - T, F2, 3.2]} max={[hw, C2, hd]} mat={MAT.adobeSide} castShadow />

      {/* ── Partitions: back rooms (z = -1.9): dorm 1 | baño | vestidor ── */}
      {/* dorm 1 door x ∈ [-2.8, -2.0] */}
      <BB min={[-hw + T, F2, -2.0]} max={[-2.8, C2, -1.88]} mat={MAT.adobe} castShadow />
      <BB min={[-2.8, 5.1, -2.0]} max={[-2.0, C2, -1.88]} mat={MAT.adobe} />
      <BB min={[-2.0, F2, -2.0]} max={[-0.6, C2, -1.88]} mat={MAT.adobe} castShadow />
      {/* baño door x ∈ [-0.6, 0.1] */}
      <BB min={[-0.6, 5.1, -2.0]} max={[0.1, C2, -1.88]} mat={MAT.adobe} />
      <BB min={[0.1, F2, -2.0]} max={[3.0, C2, -1.88]} mat={MAT.adobe} castShadow />
      {/* vestidor door x ∈ [3.0, 3.8] */}
      <BB min={[3.0, 5.1, -2.0]} max={[3.8, C2, -1.88]} mat={MAT.adobe} />
      <BB min={[3.8, F2, -2.0]} max={[hw - T, C2, -1.88]} mat={MAT.adobe} castShadow />
      {/* dividers between back rooms */}
      <BB min={[-1.46, F2, -hd + T]} max={[-1.34, C2, -2.0]} mat={MAT.adobe} castShadow />
      <BB min={[0.94, F2, -hd + T]} max={[1.06, C2, -2.0]} mat={MAT.adobe} castShadow />

      {/* ── Partitions: front rooms (z = 1.4): dorm 2 | balcony pass | master ── */}
      <BB min={[-hw + T, F2, 1.4]} max={[-2.2, C2, 1.52]} mat={MAT.adobe} castShadow />
      {/* dorm 2 door x ∈ [-2.2, -1.4] */}
      <BB min={[-2.2, 5.1, 1.4]} max={[-1.4, C2, 1.52]} mat={MAT.adobe} />
      <BB min={[-1.4, F2, 1.4]} max={[-0.8, C2, 1.52]} mat={MAT.adobe} castShadow />
      <BB min={[0.8, F2, 1.4]} max={[2.6, C2, 1.52]} mat={MAT.adobe} castShadow />
      {/* master door x ∈ [2.6, 3.4] */}
      <BB min={[2.6, 5.1, 1.4]} max={[3.4, C2, 1.52]} mat={MAT.adobe} />
      <BB min={[3.4, F2, 1.4]} max={[hw - T, C2, 1.52]} mat={MAT.adobe} castShadow />
      {/* side walls of the balcony passage */}
      <BB min={[-0.86, F2, 1.52]} max={[-0.74, C2, hd - T]} mat={MAT.adobe} castShadow />
      <BB min={[0.74, F2, 1.52]} max={[0.86, C2, hd - T]} mat={MAT.adobe} castShadow />

      {/* ── Furniture ── */}
      {/* master bed (front-right) */}
      <Box pos={[3.0, F2 + 0.2, 2.7]} size={[1.8, 0.35, 1.6]} mat={MAT.woodLight} castShadow />
      <Box pos={[3.0, F2 + 0.42, 2.7]} size={[1.7, 0.18, 1.5]} mat={MAT.white} />
      <Box pos={[3.0, F2 + 0.75, 3.4]} size={[1.8, 0.7, 0.12]} mat={MAT.wood} />
      {/* dorm 2 bed (front-left) */}
      <Box pos={[-3.6, F2 + 0.2, 2.6]} size={[1.9, 0.35, 1.4]} mat={MAT.woodLight} castShadow />
      <Box pos={[-3.6, F2 + 0.42, 2.6]} size={[1.8, 0.18, 1.3]} mat={MAT.white} />
      {/* dorm 1 bed (back-left) */}
      <Box pos={[-3.5, F2 + 0.2, -2.9]} size={[1.9, 0.35, 1.4]} mat={MAT.woodLight} castShadow />
      <Box pos={[-3.5, F2 + 0.42, -2.9]} size={[1.8, 0.18, 1.3]} mat={MAT.white} />
      {/* shared bathroom: tub + toilet + sink */}
      <Box pos={[-0.7, F2 + 0.3, -3.25]} size={[1.2, 0.55, 0.7]} mat={MAT.white} />
      <Box pos={[0.5, F2 + 0.25, -3.35]} size={[0.45, 0.5, 0.6]} mat={MAT.white} />
      <Box pos={[0.6, F2 + 0.5, -2.4]} size={[0.5, 0.9, 0.4]} mat={MAT.stone} />
      {/* vestidor: wardrobes */}
      <Box pos={[3.0, F2 + 1.1, -3.35]} size={[3.2, 2.2, 0.6]} mat={MAT.woodLight} castShadow />
      <Box pos={[4.6, F2 + 1.1, -2.6]} size={[0.6, 2.2, 1.2]} mat={MAT.woodLight} />
    </>
  );
}

// ─── Exterior: porch, balcony, pergolas, chimney, roof, garden ──────────────

function Exterior() {
  return (
    <>
      {/* Ground + stone path */}
      <BB min={[-40, -0.2, -40]} max={[40, 0, 40]} mat={MAT.grass} />
      <BB min={[-1.1, 0, 6.6]} max={[1.1, 0.04, 13]} mat={MAT.stone} />

      {/* Porch slab */}
      <BB min={[-2.8, 0, 3.75]} max={[2.8, 0.15, 6.6]} mat={MAT.concrete} />

      {/* Wooden posts supporting balcony + pergola (full height) */}
      <Box pos={[-2.45, 2.85, 6.25]} size={[0.16, 5.5, 0.16]} mat={MAT.wood} castShadow />
      <Box pos={[2.45, 2.85, 6.25]} size={[0.16, 5.5, 0.16]} mat={MAT.wood} castShadow />

      {/* Balcony slab over porch + terracotta tile finish + red tile edge */}
      <BB min={[-2.6, C1, 3.75]} max={[2.6, 2.95, 6.4]} mat={MAT.concrete} castShadow />
      <BB min={[-2.6, 2.95, 3.75]} max={[2.6, 2.98, 6.4]} mat={MAT.tile} />
      <BB min={[-2.7, 2.86, 6.4]} max={[2.7, 3.0, 6.52]} mat={MAT.tile} />

      {/* Balcony guardrail (wood, 3 sides) */}
      <Rail from={[-2.5, 6.3]} to={[2.5, 6.3]} yBase={2.98} />
      <Rail from={[-2.5, 3.85]} to={[-2.5, 6.3]} yBase={2.98} />
      <Rail from={[2.5, 3.85]} to={[2.5, 6.3]} yBase={2.98} />

      {/* Pergola over balcony (wood slats, per renders) */}
      <Box pos={[-2.45, 5.52, 5.1]} size={[0.14, 0.12, 2.9]} mat={MAT.wood} castShadow />
      <Box pos={[2.45, 5.52, 5.1]} size={[0.14, 0.12, 2.9]} mat={MAT.wood} castShadow />
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={`slat${i}`} pos={[0, 5.62, 3.95 + i * 0.4]} size={[5.4, 0.07, 0.14]} mat={MAT.wood} castShadow />
      ))}

      {/* Stone chimney column (right of the entry, rises past the roof) */}
      <BB min={[1.2, 0, 3.45]} max={[2.3, 7.0, 4.35]} mat={MAT.stone} castShadow />

      {/* Horizontal wood band between floors (visible in renders) */}
      <BB min={[-hw - 0.04, C1, -hd - 0.04]} max={[hw + 0.04, F2, -hd]} mat={MAT.wood} />
      <BB min={[-hw - 0.04, C1, hd]} max={[hw + 0.04, F2, hd + 0.04]} mat={MAT.wood} />
      <BB min={[-hw - 0.04, C1, -hd]} max={[-hw, F2, hd]} mat={MAT.wood} />
      <BB min={[hw, C1, -hd]} max={[hw + 0.04, F2, hd]} mat={MAT.wood} />

      {/* Stone base trim (ground floor bottom, per renders) — gap at the entry door */}
      <BB min={[-hw - 0.03, 0, hd]} max={[-0.9, 0.6, hd + 0.03]} mat={MAT.stone} />
      <BB min={[0.9, 0, hd]} max={[hw + 0.03, 0.6, hd + 0.03]} mat={MAT.stone} />
      <BB min={[-hw - 0.03, 0, -hd - 0.03]} max={[hw + 0.03, 0.6, -hd]} mat={MAT.stone} />
      <BB min={[-hw - 0.03, 0, -hd]} max={[-hw, 0.6, hd]} mat={MAT.stone} />
      <BB min={[hw, 0, -hd]} max={[hw + 0.03, 0.6, hd]} mat={MAT.stone} />

      {/* ── Dual offset shed roofs with clerestory gap (per renders) ── */}
      {/* left shed: low at -X, high toward center */}
      <Box pos={[-2.45, 6.0, 0]} rot={[0, 0, 0.13]} size={[7.0, 0.14, D + 1.8]} mat={MAT.tile} castShadow receiveShadow />
      {/* right shed: higher, low at +X */}
      <Box pos={[3.05, 6.45, 0]} rot={[0, 0, -0.13]} size={[5.9, 0.14, D + 1.8]} mat={MAT.tile} castShadow receiveShadow />
      {/* clerestory glass band between the two roofs */}
      <BB min={[0.3, C2, -hd]} max={[0.9, 6.35, hd]} mat={MAT.glass} receiveShadow={false} />
      {/* wood fascia under each roof edge */}
      <Box pos={[-2.45, 5.88, 0]} rot={[0, 0, 0.13]} size={[7.0, 0.1, D + 1.6]} mat={MAT.wood} />
      <Box pos={[3.05, 6.33, 0]} rot={[0, 0, -0.13]} size={[5.9, 0.1, D + 1.6]} mat={MAT.wood} />

      {/* Porch furniture: purple bean bags + plant pots (per renders) */}
      <mesh position={[-1.9, 0.4, 5.4]} scale={[1, 0.7, 1]} castShadow material={MAT.purple}>
        <sphereGeometry args={[0.45, 16, 12]} />
      </mesh>
      <mesh position={[1.7, 0.38, 5.7]} scale={[1, 0.7, 1]} castShadow material={MAT.purple}>
        <sphereGeometry args={[0.4, 16, 12]} />
      </mesh>
      {[[-2.4, 4.1], [2.3, 4.3]].map(([x, z], i) => (
        <group key={`pot${i}`}>
          <mesh position={[x, 0.35, z]} castShadow material={MAT.tile}>
            <cylinderGeometry args={[0.22, 0.16, 0.4, 10]} />
          </mesh>
          <mesh position={[x, 0.85, z]} material={MAT.leaf}>
            <sphereGeometry args={[0.35, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* Garden trees (tropical vegetation around the house) */}
      {[[-9, -4], [-8, 6], [9, 5], [8, -6], [-4, 11], [5, 12]].map(([x, z], i) => (
        <group key={`tree${i}`}>
          <mesh position={[x, 1.6, z]} castShadow material={MAT.trunk}>
            <cylinderGeometry args={[0.14, 0.2, 3.2, 8]} />
          </mesh>
          <mesh position={[x, 3.7, z]} castShadow material={MAT.leaf}>
            <sphereGeometry args={[1.3, 10, 8]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function ProceduralHouse() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <Exterior />
      <GroundFloor />
      <SecondFloor />
    </RigidBody>
  );
}

// ─── Lighting + atmosphere ───────────────────────────────────────────────────

function Atmosphere() {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#A8CDE8');
    scene.fog = new THREE.Fog('#D4C5A9', 30, 90);
    return () => { scene.background = null; scene.fog = null; };
  }, [scene]);
  return null;
}

function Lighting() {
  return (
    <>
      <hemisphereLight skyColor="#87CEEB" groundColor="#8B7355" intensity={0.6} />

      {/* Main sun — afternoon, front-right of house */}
      <directionalLight
        position={[12, 14, 8]}
        intensity={2.2}
        color="#FFF5E0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0008}
        shadow-normalBias={0.04}
      />

      {/* Soft sky bounce */}
      <directionalLight position={[-8, 8, -6]} intensity={0.35} color="#C8D8F0" />

      {/* Interior warm fill — ground floor (sala / cocina / estudio) */}
      <pointLight position={[2.5, 2.2, 1.5]} intensity={1.2} color="#FFE4B0" distance={9} decay={2} />
      <pointLight position={[-3, 2.2, -1.5]} intensity={1.0} color="#FFE4B0" distance={8} decay={2} />
      <pointLight position={[2.5, 2.2, -2.5]} intensity={0.9} color="#FFE4B0" distance={7} decay={2} />
      {/* Interior warm fill — second floor */}
      <pointLight position={[0.5, F2 + 2.0, 0.5]} intensity={1.0} color="#FFE4B0" distance={9} decay={2} />
      <pointLight position={[-3, F2 + 2.0, 2.5]} intensity={0.8} color="#FFE4B0" distance={7} decay={2} />
      <pointLight position={[3, F2 + 2.0, -2.5]} intensity={0.8} color="#FFE4B0" distance={7} decay={2} />

      {/* HDRI environment — sky reflections + IBL */}
      <Environment preset="sunset" background={false} />
    </>
  );
}

export default function Scene() {
  return (
    <>
      <Atmosphere />
      <Lighting />
      <ProceduralHouse />
    </>
  );
}

// useGLTF.preload('/models/casa.glb');
