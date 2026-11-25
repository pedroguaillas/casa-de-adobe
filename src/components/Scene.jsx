import { Environment, Lightformer, Sky } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import { QUALITY } from '../lib/quality.js';

// ─────────────────────────────────────────────────────────────────────────────
// Casa de Adobe — procedural placeholder built from the dimensioned plans
// (resources/CASA DE ADOVE 1.pdf: plantas 1:50, lámina 2: cortes/elevaciones).
// See resources/ANALISIS.md for the full room table.
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

// ── Grid (plan axes) ─────────────────────────────────────────────────────────
// X: axes 1-2-3-4 every 3.25 m → centres at ±1.625, ±4.875. Width 9.95.
// Z: axes C-B-A every 3.40 m → centres at -3.40, 0, +3.40. Depth 7.00.
// Front facade (axis A, portal) faces +Z. Walls 0.20 centred on the axes.
const W = 9.95;
const D = 7.0;
const T = 0.2;
const hw = W / 2;          // 4.975 outer face
const hd = D / 2;          // 3.50  outer face
const iw = hw - T;         // 4.775 inner face
const id = hd - T;         // 3.30  inner face
const AX = 1.625;          // axes 2/3
const a0 = AX - T / 2;     // 1.525 inner face toward centre bay
const a1 = AX + T / 2;     // 1.725 inner face toward side bays

// ── Levels (sección longitudinal / transversal) ─────────────────────────────
const F1 = 0.2;            // planta baja  NPT +0.20
const C1 = 2.4;            // bottom of level-2 slab (+2.40)
const F2 = 2.6;            // planta alta  NPT +2.60
const C2 = 4.9;            // planta alta ceiling (+4.90)
const WT = 5.1;            // top of walls / eave beam (+5.10)
const DOOR = 2.05;         // door opening height (planta: 2.05)

// ── Stair: 13 risers of 0.185 × tread 0.235, straight run along -X ─────────
// Step 1 sits by axis 3 (sala side), arrival on the upper pasillo by axis 2.
const STAIR_STEPS = 13;
const STAIR_X0 = a0;                              // front of step 1
const STAIR_RUN = (2 * a0) / STAIR_STEPS;         // 0.235
const STAIR_RISE = (F2 - F1) / STAIR_STEPS;       // 0.185
const STAIR_Z0 = 0.82;
const STAIR_Z1 = 1.82;                            // 1.00 m clear width
const STAIR_ZC = (STAIR_Z0 + STAIR_Z1) / 2;
const STAIR_ANGLE = Math.atan2(F2 - F1, STAIR_STEPS * STAIR_RUN); // ≈ 38°
// Upper slab opening above the run
const HOLE = { x0: -a0, x1: a0, z0: STAIR_Z0, z1: 1.86 };

const SHADOWS = QUALITY.shadows;

// ─── Primitive helpers ───────────────────────────────────────────────────────

function BB({ min, max, mat, castShadow = false, receiveShadow = true }) {
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const pos = [(max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2];
  return (
    <mesh position={pos} castShadow={castShadow && SHADOWS} receiveShadow={receiveShadow && SHADOWS} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Box({ pos, size, mat, rot, castShadow = false, receiveShadow = true }) {
  return (
    <mesh position={pos} rotation={rot} castShadow={castShadow && SHADOWS} receiveShadow={receiveShadow && SHADOWS} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  );
}

// Straight wall with openings.
//   along: 'x' → wall runs along X, thickness spans z ∈ [t0, t1]
//          'z' → wall runs along Z, thickness spans x ∈ [t0, t1]
//   open:  [{ a, b, bottom = y0, top, glass, mullions }]
//          a doorway has bottom = y0 and no glass; a window/fixed pane has glass.
function Wall({ along = 'x', from, to, t0, t1, y0, y1, mat, open = [] }) {
  const box = (a, b, ya, yb) =>
    along === 'x'
      ? { min: [a, ya, t0], max: [b, yb, t1] }
      : { min: [t0, ya, a], max: [t1, yb, b] };
  // a thin slab centred in the wall thickness
  const tc = (t0 + t1) / 2;
  const thin = (a, b, ya, yb, half) =>
    along === 'x'
      ? { min: [a, ya, tc - half], max: [b, yb, tc + half] }
      : { min: [tc - half, ya, a], max: [tc + half, yb, b] };

  const parts = [];
  let cur = from;
  let k = 0;
  for (const o of [...open].sort((p, q) => p.a - q.a)) {
    const bottom = o.bottom ?? y0;
    if (o.a > cur + 1e-3) parts.push(<BB key={k++} {...box(cur, o.a, y0, y1)} mat={mat} castShadow />);
    if (bottom > y0 + 1e-3) parts.push(<BB key={k++} {...box(o.a, o.b, y0, bottom)} mat={mat} castShadow />);
    if (o.top < y1 - 1e-3) parts.push(<BB key={k++} {...box(o.a, o.b, o.top, y1)} mat={mat} castShadow />);
    if (o.glass) {
      const f = 0.05; // black steel profile
      parts.push(<BB key={k++} {...thin(o.a, o.b, bottom, bottom + f, 0.04)} mat={MAT.frame} />);
      parts.push(<BB key={k++} {...thin(o.a, o.b, o.top - f, o.top, 0.04)} mat={MAT.frame} />);
      parts.push(<BB key={k++} {...thin(o.a, o.a + f, bottom, o.top, 0.04)} mat={MAT.frame} />);
      parts.push(<BB key={k++} {...thin(o.b - f, o.b, bottom, o.top, 0.04)} mat={MAT.frame} />);
      const n = o.mullions ?? Math.max(0, Math.round((o.b - o.a) / 0.9) - 1);
      for (let i = 1; i <= n; i++) {
        const m = o.a + ((o.b - o.a) * i) / (n + 1);
        parts.push(<BB key={k++} {...thin(m - 0.025, m + 0.025, bottom, o.top, 0.035)} mat={MAT.frame} />);
      }
      parts.push(
        <BB key={k++} {...thin(o.a + f, o.b - f, bottom + f, o.top - f, 0.012)} mat={MAT.glass} receiveShadow={false} />
      );
    }
    cur = o.b;
  }
  if (to > cur + 1e-3) parts.push(<BB key={k++} {...box(cur, to, y0, y1)} mat={mat} castShadow />);
  return <>{parts}</>;
}

// Window / door shorthands
const win = (a, b, bottom, top) => ({ a, b, bottom, top, glass: true });
const door = (a, b, y) => ({ a, b, bottom: y, top: y + DOOR });

// ─── Stairs ──────────────────────────────────────────────────────────────────

function Stairs() {
  return (
    <>
      {/* solid stepped mass (closed underside = recibidor storage in the section) */}
      {Array.from({ length: STAIR_STEPS }, (_, i) => {
        const xHi = STAIR_X0 - i * STAIR_RUN;
        const xLo = xHi - STAIR_RUN;
        const top = F1 + (i + 1) * STAIR_RISE;
        return (
          <group key={i}>
            <BB min={[xLo, F1, STAIR_Z0]} max={[xHi, top - 0.04, STAIR_Z1]} mat={MAT.adobe} castShadow />
            <BB min={[xLo - 0.02, top - 0.04, STAIR_Z0]} max={[xHi, top, STAIR_Z1 + 0.02]} mat={MAT.woodLight} />
          </group>
        );
      })}
      {/* Invisible ramp collider along the step noses — the character controller
          climbs it as a 38° slope; rapier autostep alone stalls on risers.
          Line: (x0 + run, F1) → (x0 - 12·run, F2). Must be explicit — invisible
          meshes generate no collider. */}
      {(() => {
        const xa = STAIR_X0 + STAIR_RUN;
        const xb = STAIR_X0 - (STAIR_STEPS - 1) * STAIR_RUN;
        const len = Math.hypot(xa - xb, F2 - F1);
        const th = 0.03;
        return (
          <CuboidCollider
            args={[len / 2, th, (STAIR_Z1 - STAIR_Z0) / 2]}
            position={[
              (xa + xb) / 2 - th * Math.sin(STAIR_ANGLE),
              (F1 + F2) / 2 - th * Math.cos(STAIR_ANGLE),
              STAIR_ZC,
            ]}
            rotation={[0, 0, -STAIR_ANGLE]}
          />
        );
      })()}
    </>
  );
}

// Wooden guardrail: horizontal run with posts + two rails
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

// ─── Planta baja (+0.20) ─────────────────────────────────────────────────────
//   EXTRA    x[-4.78,-1.73] z[-3.30,-0.10]   │ SERVICIO x[-1.53,1.53] z[-3.30,-2.00] │ COMEDOR x[1.73,4.78] z[-3.30,-0.10]
//   ESTUDIO  x[-4.78,-1.73] z[ 0.10, 3.30]   │ COCINA   x[-1.53,1.53] z[-1.82, 0.62] │ SALA    x[1.73,4.78] z[ 0.10, 3.30]
//   BAÑO     x[-2.94,-1.73] z[ 2.95, 4.21]   │ ESCALERA x[-1.53,1.53] z[ 0.82, 1.82] │
//   (projects 0.9 m into the portal)         │ VESTÍBULO              z[ 1.82, 3.30] │

const WIN1 = [0.7, 2.2];   // ground-floor window sill / head
const WIN2 = [3.5, 4.7];   // upper-floor window sill / head

function GroundFloor() {
  return (
    <>
      {/* Slab (walking surface at y = F1) */}
      <BB min={[-hw, 0, -hd]} max={[hw, F1, hd]} mat={MAT.concrete} />

      {/* ── FRONT (z = +3.5): estudio wall · baño volume · glass entry · chimney · sala wall ── */}
      <Wall along="x" from={-hw} to={-3.135} t0={id} t1={hd} y0={F1} y1={C1} mat={MAT.adobe} />
      {/* entry: 2.90 m steel-and-glass front, sliding pair in the middle */}
      <Wall along="x" from={-a0} to={a0} t0={id} t1={hd} y0={F1} y1={C1} mat={MAT.adobe}
            open={[win(-1.375, -0.6, F1, 2.25), door(-0.6, 0.9, F1), win(0.9, a0, F1, 2.25)]} />
      <BB min={[-0.6, F1, id + 0.06]} max={[-0.55, 2.25, hd - 0.06]} mat={MAT.frame} />
      <BB min={[0.85, F1, id + 0.06]} max={[0.9, 2.25, hd - 0.06]} mat={MAT.frame} />
      <Wall along="x" from={2.625} to={hw} t0={id} t1={hd} y0={F1} y1={C1} mat={MAT.adobe} />

      {/* Baño volume (stone, projects into the portal) */}
      <Wall along="z" from={2.75} to={4.41} t0={-3.135} t1={-2.935} y0={F1} y1={C1} mat={MAT.stone} />
      <Wall along="z" from={2.75} to={4.41} t0={-a1} t1={-a0} y0={F1} y1={C1} mat={MAT.stone} />
      <Wall along="x" from={-3.135} to={-a0} t0={4.21} t1={4.41} y0={F1} y1={C1} mat={MAT.stone}
            open={[win(-2.6, -2.0, 1.5, 2.1)]} />
      <Wall along="x" from={-2.935} to={-a1} t0={2.75} t1={2.95} y0={F1} y1={C1} mat={MAT.stone}
            open={[door(-2.45, -a1, F1)]} />

      {/* ── BACK (z = -3.5): solid, celosía (perforated brick lattice) on servicio ── */}
      <Wall along="x" from={-hw} to={hw} t0={-hd} t1={-id} y0={F1} y1={C1} mat={MAT.adobe}
            open={[{ a: -a0, b: a0, bottom: 0.6, top: 2.1 }]} />
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 12 }, (_, c) =>
          (r + c) % 2 === 0 ? (
            <Box key={`cel${r}-${c}`}
                 pos={[-a0 + (c + 0.5) * (2 * a0 / 12), 0.6 + (r + 0.5) * 0.25, -hd + T / 2]}
                 size={[2 * a0 / 12, 0.25, T]} mat={MAT.adobeSide} castShadow />
          ) : null
        )
      )}

      {/* ── LEFT / RIGHT (two 2.00 m windows each, per plan side dims) ── */}
      <Wall along="z" from={-hd} to={hd} t0={-hw} t1={-iw} y0={F1} y1={C1} mat={MAT.adobeSide}
            open={[win(-2.75, -0.75, ...WIN1), win(0.75, 2.75, ...WIN1)]} />
      <Wall along="z" from={-hd} to={hd} t0={iw} t1={hw} y0={F1} y1={C1} mat={MAT.adobeSide}
            open={[win(-2.7, -0.75, ...WIN1), win(0.75, 2.75, ...WIN1)]} />

      {/* ── Interior partitions ── */}
      {/* extra | estudio — 2.05 wall + 1.00 opening by axis 2 */}
      <Wall along="x" from={-iw} to={-2.725} t0={-0.1} t1={0.1} y0={F1} y1={C1} mat={MAT.adobe} />
      {/* axis 2: extra/estudio | servicio/cocina/escalera — estudio door from the vestíbulo */}
      <Wall along="z" from={-id} to={2.75} t0={-a1} t1={-a0} y0={F1} y1={C1} mat={MAT.adobe}
            open={[door(1.85, 2.7, F1)]} />
      {/* axis 3: servicio→comedor door, cocina→comedor opening; open to sala in front */}
      <Wall along="z" from={-id} to={STAIR_Z0} t0={a0} t1={a1} y0={F1} y1={C1} mat={MAT.adobe}
            open={[door(-2.75, -2.0, F1), door(-1.19, -0.08, F1)]} />
      {/* servicio | cocina */}
      <Wall along="x" from={-a0} to={a0} t0={-2.0} t1={-1.82} y0={F1} y1={C1} mat={MAT.adobe} />
      {/* cocina | escalera */}
      <Wall along="x" from={-a0} to={a0} t0={0.62} t1={STAIR_Z0} y0={F1} y1={C1} mat={MAT.adobe} />
      {/* comedor | sala — wall stubs + low sideboard */}
      <Wall along="x" from={2.75} to={3.2} t0={-0.1} t1={0.1} y0={F1} y1={C1} mat={MAT.adobe} />
      <Wall along="x" from={4.4} to={iw} t0={-0.1} t1={0.1} y0={F1} y1={C1} mat={MAT.adobe} />
      <Box pos={[3.8, F1 + 0.4, 0.05]} size={[1.2, 0.8, 0.45]} mat={MAT.woodLight} castShadow />

      {/* ── Stairs ── */}
      <Stairs />

      {/* ── EXTRA: pool table + piano (per renders) ── */}
      <Box pos={[-3.0, 0.62, -1.45]} size={[2.2, 0.28, 1.2]} mat={MAT.wood} castShadow />
      <Box pos={[-3.0, 0.79, -1.45]} size={[2.1, 0.06, 1.1]} mat={MAT.poolGreen} />
      {[[-3.9, -1.9], [-2.1, -1.9], [-3.9, -1.0], [-2.1, -1.0]].map(([x, z], i) => (
        <Box key={`pl${i}`} pos={[x, F1 + 0.14, z]} size={[0.14, 0.28, 0.14]} mat={MAT.wood} />
      ))}
      <Box pos={[-3.9, F1 + 0.55, -3.0]} size={[1.5, 1.1, 0.6]} mat={MAT.black} castShadow />
      <Box pos={[-3.9, F1 + 0.25, -2.5]} size={[0.7, 0.5, 0.35]} mat={MAT.black} />

      {/* ── ESTUDIO: desk + chair ── */}
      <Box pos={[-3.6, F1 + 0.375, 1.6]} size={[1.5, 0.75, 0.7]} mat={MAT.woodLight} castShadow />
      <Box pos={[-3.6, F1 + 0.45, 2.25]} size={[0.5, 0.9, 0.5]} mat={MAT.black} />

      {/* ── BAÑO PB: toilet + sink ── */}
      <Box pos={[-2.6, F1 + 0.225, 3.9]} size={[0.4, 0.45, 0.6]} mat={MAT.white} />
      <Box pos={[-2.7, F1 + 0.8, 3.3]} size={[0.45, 0.1, 0.5]} mat={MAT.white} />
      <Box pos={[-2.7, F1 + 0.38, 3.3]} size={[0.16, 0.75, 0.16]} mat={MAT.stone} />

      {/* ── COCINA: two parallel runs 0.60 + 1.20 aisle + 0.60 (red fronts) ── */}
      <Box pos={[-0.26, F1 + 0.45, -1.52]} size={[2.52, 0.9, 0.6]} mat={MAT.kitchenRed} castShadow />
      <Box pos={[-0.26, F1 + 0.93, -1.5]} size={[2.56, 0.06, 0.66]} mat={MAT.woodLight} />
      <Box pos={[1.26, F1 + 0.9, -1.5]} size={[0.52, 1.8, 0.62]} mat={MAT.white} castShadow />
      <Box pos={[0.26, F1 + 0.45, 0.32]} size={[2.52, 0.9, 0.6]} mat={MAT.kitchenRed} castShadow />
      <Box pos={[0.26, F1 + 0.93, 0.3]} size={[2.56, 0.06, 0.66]} mat={MAT.woodLight} />
      <Box pos={[0.3, F1 + 0.97, 0.3]} size={[0.6, 0.02, 0.5]} mat={MAT.black} />

      {/* ── SERVICIO: washer + laundry sink ── */}
      <Box pos={[-0.9, F1 + 0.45, -2.95]} size={[0.6, 0.9, 0.6]} mat={MAT.white} />
      <Box pos={[0.0, F1 + 0.45, -2.95]} size={[0.6, 0.9, 0.6]} mat={MAT.concrete} />

      {/* ── COMEDOR: table + 4 chairs ── */}
      <Box pos={[3.25, F1 + 0.74, -1.9]} size={[1.4, 0.06, 0.9]} mat={MAT.woodLight} castShadow />
      <Box pos={[3.25, F1 + 0.36, -1.9]} size={[0.18, 0.72, 0.18]} mat={MAT.wood} />
      {[[2.85, -2.6], [3.65, -2.6], [2.85, -1.2], [3.65, -1.2]].map(([x, z], i) => (
        <Box key={`ch${i}`} pos={[x, F1 + 0.425, z]} size={[0.42, 0.85, 0.42]} mat={MAT.woodLight} />
      ))}

      {/* ── SALA: sofa against the front wall, coffee table, armchair, hearth ── */}
      <Box pos={[3.3, F1 + 0.25, 2.92]} size={[1.9, 0.5, 0.75]} mat={MAT.fabric} castShadow />
      <Box pos={[3.3, F1 + 0.65, 3.18]} size={[1.9, 0.55, 0.22]} mat={MAT.fabric} />
      <Box pos={[2.24, F1 + 0.45, 2.92]} size={[0.22, 0.55, 0.75]} mat={MAT.fabric} />
      <Box pos={[4.36, F1 + 0.45, 2.92]} size={[0.22, 0.55, 0.75]} mat={MAT.fabric} />
      <Box pos={[3.3, F1 + 0.22, 1.95]} size={[0.95, 0.44, 0.5]} mat={MAT.woodLight} castShadow />
      <Box pos={[4.4, F1 + 0.25, 1.3]} size={[0.7, 0.5, 0.75]} mat={MAT.fabric} />
    </>
  );
}

// ─── Planta alta (+2.60) ─────────────────────────────────────────────────────
//   DORM. 2  x[-4.78,-1.73] z[-3.30,-0.10] │ DORM. 1 x[-1.53,1.53] z[-3.30,0.62] │ BAÑO x[1.73,3.03] z[-3.30,-1.31]
//                                          │                                     │ VESTIDOR x[1.73,4.78] z[-3.30,-0.10]
//   BAÑO 2   x[-4.78,-3.13] z[ 0.10, 3.30] │ HUECO   x[-1.53,1.53] z[0.82,1.86]  │ MASTER  x[1.73,4.78] z[0.10,3.30]
//   PASILLO  x[-2.93,-1.73] z[ 0.10, 3.30] │ HALL    x[-1.53,1.53] z[1.86,3.30]  │
//   BALCÓN   x[-3.14, 1.53] z[ 3.50, 4.41]

function SecondFloor() {
  return (
    <>
      {/* Slab pieces around the stairwell opening */}
      <BB min={[-hw, C1, -hd]}         max={[HOLE.x0, F2, hd]}      mat={MAT.woodFloor} />
      <BB min={[HOLE.x1, C1, -hd]}     max={[hw, F2, hd]}           mat={MAT.woodFloor} />
      <BB min={[HOLE.x0, C1, -hd]}     max={[HOLE.x1, F2, HOLE.z0]} mat={MAT.woodFloor} />
      <BB min={[HOLE.x0, C1, HOLE.z1]} max={[HOLE.x1, F2, hd]}      mat={MAT.woodFloor} />

      {/* Guardrail on the open (hall) side of the stairwell; arrival end open */}
      <Rail from={[HOLE.x0 + STAIR_RUN + 0.04, HOLE.z1 + 0.04]} to={[HOLE.x1, HOLE.z1 + 0.04]} yBase={F2} />

      {/* Ceiling */}
      <BB min={[-iw, C2, -id]} max={[iw, C2 + 0.1, id]} mat={MAT.ceiling} />

      {/* ── FRONT: pasillo window · balcony glazing with sliding door · chimney · solid ── */}
      <Wall along="x" from={-hw} to={a0} t0={id} t1={hd} y0={F2} y1={WT} mat={MAT.adobe}
            open={[win(-2.81, -1.88, ...WIN2), win(-1.375, -0.6, F2, F2 + 2.1),
                   door(-0.6, 0.9, F2), win(0.9, a0, F2, F2 + 2.1)]} />
      <BB min={[-0.6, F2, id + 0.06]} max={[-0.55, F2 + 2.1, hd - 0.06]} mat={MAT.frame} />
      <BB min={[0.85, F2, id + 0.06]} max={[0.9, F2 + 2.1, hd - 0.06]} mat={MAT.frame} />
      <Wall along="x" from={2.625} to={hw} t0={id} t1={hd} y0={F2} y1={WT} mat={MAT.adobe} />

      {/* ── BACK: central 2.00 m window (dormitorio 1) ── */}
      <Wall along="x" from={-hw} to={hw} t0={-hd} t1={-id} y0={F2} y1={WT} mat={MAT.adobe}
            open={[win(-1.0, 1.0, ...WIN2)]} />

      {/* ── LEFT / RIGHT ── */}
      <Wall along="z" from={-hd} to={hd} t0={-hw} t1={-iw} y0={F2} y1={WT} mat={MAT.adobeSide}
            open={[win(-2.75, -0.75, ...WIN2), win(0.75, 2.75, ...WIN2)]} />
      <Wall along="z" from={-hd} to={hd} t0={iw} t1={hw} y0={F2} y1={WT} mat={MAT.adobeSide}
            open={[win(-2.7, -0.75, ...WIN2), win(0.75, 2.75, ...WIN2)]} />

      {/* ── Partitions ── */}
      {/* dormitorio 2 | baño 2 + pasillo (door by axis 2) */}
      <Wall along="x" from={-iw} to={-a1} t0={-0.1} t1={0.1} y0={F2} y1={C2} mat={MAT.adobe}
            open={[door(-2.55, -a1, F2)]} />
      {/* axis 2: dorm 2 | dorm 1, then dorm-1 door from the pasillo, then open to the stair top */}
      <Wall along="z" from={-id} to={-0.1} t0={-a1} t1={-a0} y0={F2} y1={C2} mat={MAT.adobe} />
      <Wall along="z" from={2.84} to={id} t0={-a1} t1={-a0} y0={F2} y1={C2} mat={MAT.adobe} />
      {/* dorm 1 front wall = back of the stairwell */}
      <Wall along="x" from={-a1} to={a0} t0={0.62} t1={STAIR_Z0} y0={F2} y1={C2} mat={MAT.adobe} />
      <BB min={[-a1, F2 + DOOR, -0.1]} max={[-a0, C2, 0.62]} mat={MAT.adobe} />
      {/* baño 2 | pasillo (door at the hall end) */}
      <Wall along="z" from={0.1} to={id} t0={-3.13} t1={-2.93} y0={F2} y1={C2} mat={MAT.adobe}
            open={[door(0.1, 0.8, F2)]} />
      {/* axis 3: dorm 1 | baño/vestidor, stairwell end, master door from the hall */}
      <Wall along="z" from={-id} to={id} t0={a0} t1={a1} y0={F2} y1={C2} mat={MAT.adobe}
            open={[door(1.86, 2.6, F2)]} />
      {/* baño (master en-suite) */}
      <Wall along="z" from={-id} to={-1.19} t0={3.03} t1={3.15} y0={F2} y1={C2} mat={MAT.adobe} />
      <Wall along="x" from={a1} to={3.15} t0={-1.31} t1={-1.19} y0={F2} y1={C2} mat={MAT.adobe}
            open={[door(2.3, 3.03, F2)]} />
      {/* vestidor | master — 1.17 m opening by axis 3 */}
      <Wall along="x" from={2.9} to={iw} t0={-0.1} t1={0.1} y0={F2} y1={C2} mat={MAT.adobe} />

      {/* ── Furniture ── */}
      {/* dormitorio 2: bed along X, head to axis 2 + wardrobe */}
      <Box pos={[-2.85, F2 + 0.18, -2.4]} size={[2.0, 0.35, 1.4]} mat={MAT.woodLight} castShadow />
      <Box pos={[-2.9, F2 + 0.42, -2.4]} size={[1.9, 0.18, 1.3]} mat={MAT.white} />
      <Box pos={[-1.8, F2 + 0.5, -2.4]} size={[0.08, 1.0, 1.45]} mat={MAT.wood} />
      <Box pos={[-3.95, F2 + 1.1, -0.42]} size={[1.6, 2.2, 0.6]} mat={MAT.woodLight} castShadow />
      {/* dormitorio 1: bed along X + closet against the stairwell wall */}
      <Box pos={[0.41, F2 + 0.18, -1.9]} size={[2.0, 0.35, 1.4]} mat={MAT.woodLight} castShadow />
      <Box pos={[0.36, F2 + 0.42, -1.9]} size={[1.9, 0.18, 1.3]} mat={MAT.white} />
      <Box pos={[1.47, F2 + 0.5, -1.9]} size={[0.08, 1.0, 1.45]} mat={MAT.wood} />
      <Box pos={[0.425, F2 + 1.1, 0.31]} size={[2.18, 2.2, 0.6]} mat={MAT.woodLight} castShadow />
      {/* baño (en-suite): tub, toilet, sink */}
      <Box pos={[2.38, F2 + 0.28, -2.92]} size={[1.28, 0.55, 0.74]} mat={MAT.white} />
      <Box pos={[1.95, F2 + 0.25, -2.1]} size={[0.4, 0.5, 0.6]} mat={MAT.white} />
      <Box pos={[1.95, F2 + 0.43, -1.55]} size={[0.42, 0.85, 0.4]} mat={MAT.stone} />
      {/* vestidor: wardrobes */}
      <Box pos={[4.475, F2 + 1.1, -1.9]} size={[0.6, 2.2, 2.6]} mat={MAT.woodLight} castShadow />
      <Box pos={[3.6, F2 + 1.1, -3.0]} size={[0.9, 2.2, 0.6]} mat={MAT.woodLight} />
      {/* master: bed along Z, headboard on the front wall */}
      <Box pos={[3.37, F2 + 0.18, 2.28]} size={[1.6, 0.35, 2.0]} mat={MAT.woodLight} castShadow />
      <Box pos={[3.37, F2 + 0.42, 2.25]} size={[1.5, 0.18, 1.9]} mat={MAT.white} />
      <Box pos={[3.37, F2 + 0.6, 3.24]} size={[1.7, 1.2, 0.08]} mat={MAT.wood} />
      {/* baño 2: tub along the front wall, toilet, sink */}
      <Box pos={[-3.95, F2 + 0.28, 2.9]} size={[1.55, 0.55, 0.74]} mat={MAT.white} />
      <Box pos={[-4.45, F2 + 0.25, 1.6]} size={[0.6, 0.5, 0.4]} mat={MAT.white} />
      <Box pos={[-4.5, F2 + 0.43, 0.6]} size={[0.45, 0.85, 0.5]} mat={MAT.stone} />
    </>
  );
}

// ─── Exterior: portal, balcony, chimney, roofs, garden ───────────────────────

const ROOF_HI = 5.8;    // side roofs, high edge at axes 2/3
const ROOF_LO = 4.98;   // side roofs, eave (20 % over 4.09 m)
const ROOF_SLOPE = Math.atan2(ROOF_HI - ROOF_LO, 4.09);
const LANTERN_RIDGE = 6.04;
const LANTERN_EAVE = 5.85;

function Exterior() {
  return (
    <>
      {/* Ground + stone path to the entry */}
      <BB min={[-40, -0.2, -40]} max={[40, 0, 40]} mat={MAT.grass} />
      <BB min={[-0.9, 0, 5.4]} max={[1.2, 0.04, 13]} mat={MAT.stone} />

      {/* Portal slab (+0.20) */}
      <BB min={[-3.135, 0, hd]} max={[2.625, F1, 5.4]} mat={MAT.concrete} />
      {/* stone step along the portal front + invisible 14° ramp collider:
          the capsule meets a 0.16–0.20 m edge at >45° and rapier autostep
          stalls there, so the step is walked as a gentle slope instead */}
      <BB min={[-3.135, 0, 5.4]} max={[2.625, 0.1, 5.75]} mat={MAT.stone} />
      {(() => {
        const z0 = 5.4, z1 = 6.2, th = 0.02;
        const ang = Math.atan2(F1, z1 - z0);
        return (
          <CuboidCollider
            args={[(2.625 + 3.135) / 2, th, Math.hypot(z1 - z0, F1) / 2]}
            position={[(2.625 - 3.135) / 2, F1 / 2 - th * Math.cos(ang), (z0 + z1) / 2 - th * Math.sin(ang)]}
            rotation={[ang, 0, 0]}
          />
        );
      })()}

      {/* Portal posts (axes 2 and 3) + low tile roof (20 %) */}
      <Box pos={[-AX, F1 + 1.09, 5.3]} size={[0.16, 2.18, 0.16]} mat={MAT.wood} castShadow />
      <Box pos={[AX, F1 + 1.09, 5.3]} size={[0.16, 2.18, 0.16]} mat={MAT.wood} castShadow />
      <Box pos={[-0.255, 2.44, 5.03]} rot={[0.185, 0, 0]} size={[5.96, 0.08, 1.3]} mat={MAT.tile} castShadow />

      {/* Balcony (0.90 m) over the baño volume and the portal */}
      <BB min={[-3.135, C1, hd]} max={[a0, F2 - 0.02, 4.41]} mat={MAT.concrete} castShadow />
      <BB min={[-3.135, F2 - 0.02, hd]} max={[a0, F2, 4.41]} mat={MAT.tile} />
      <Rail from={[-3.085, 4.36]} to={[a0, 4.36]} yBase={F2} />
      <Rail from={[-3.085, hd]} to={[-3.085, 4.36]} yBase={F2} />
      {/* pergola joists over the balcony (per renders) */}
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={`pj${i}`} pos={[-3.0 + i * 0.4, 5.0, 4.0]} size={[0.07, 0.14, 1.1]} mat={MAT.wood} castShadow />
      ))}
      <Box pos={[-0.8, 5.0, 4.52]} size={[4.7, 0.14, 0.08]} mat={MAT.wood} />

      {/* Stone chimney (Ducto Chimenea), rises past the roof */}
      <BB min={[a0, 0, id]} max={[2.625, 6.6, 4.41]} mat={MAT.stone} castShadow />

      {/* Wood band between floors (C1 → F2) */}
      <BB min={[-hw - 0.04, C1, -hd - 0.04]} max={[hw + 0.04, F2, -hd]} mat={MAT.wood} />
      <BB min={[-hw - 0.04, C1, hd]} max={[hw + 0.04, F2, hd + 0.04]} mat={MAT.wood} />
      <BB min={[-hw - 0.04, C1, -hd]} max={[-hw, F2, hd]} mat={MAT.wood} />
      <BB min={[hw, C1, -hd]} max={[hw + 0.04, F2, hd]} mat={MAT.wood} />

      {/* Stone base trim — skips the glass entry */}
      <BB min={[-hw - 0.03, 0, hd]} max={[-3.135, 0.6, hd + 0.03]} mat={MAT.stone} />
      <BB min={[2.625, 0, hd]} max={[hw + 0.03, 0.6, hd + 0.03]} mat={MAT.stone} />
      <BB min={[-hw - 0.03, 0, -hd - 0.03]} max={[hw + 0.03, 0.6, -hd]} mat={MAT.stone} />
      <BB min={[-hw - 0.03, 0, -hd]} max={[-hw, 0.6, hd]} mat={MAT.stone} />
      <BB min={[hw, 0, -hd]} max={[hw + 0.03, 0.6, hd]} mat={MAT.stone} />

      {/* ── Roofs (planta de cubiertas: 4.09 | 3.05 | 4.09 × 8.40) ── */}
      <Box pos={[-(a0 + 4.09 / 2), (ROOF_HI + ROOF_LO) / 2, 0]} rot={[0, 0, ROOF_SLOPE]}
           size={[Math.hypot(4.09, ROOF_HI - ROOF_LO), 0.12, 8.4]} mat={MAT.tile} castShadow receiveShadow />
      <Box pos={[a0 + 4.09 / 2, (ROOF_HI + ROOF_LO) / 2, 0]} rot={[0, 0, -ROOF_SLOPE]}
           size={[Math.hypot(4.09, ROOF_HI - ROOF_LO), 0.12, 8.4]} mat={MAT.tile} castShadow receiveShadow />
      {/* raised central lantern, gabled front/back */}
      {[1, -1].map((s) => (
        <Box key={`lan${s}`} pos={[0, (LANTERN_RIDGE + LANTERN_EAVE) / 2, s * 2.1]}
             rot={[s * Math.atan2(LANTERN_RIDGE - LANTERN_EAVE, 4.2), 0, 0]}
             size={[3.35, 0.12, 4.22]} mat={MAT.tile} castShadow receiveShadow />
      ))}
      {/* clerestory glass on both sides of the lantern + end infill */}
      <BB min={[-a0 - 0.04, WT, -hd]} max={[-a0 + 0.04, ROOF_HI, hd]} mat={MAT.glass} receiveShadow={false} />
      <BB min={[a0 - 0.04, WT, -hd]} max={[a0 + 0.04, ROOF_HI, hd]} mat={MAT.glass} receiveShadow={false} />
      <BB min={[-a0, WT, id]} max={[a0, LANTERN_EAVE, hd]} mat={MAT.adobe} />
      <BB min={[-a0, WT, -hd]} max={[a0, LANTERN_EAVE, -id]} mat={MAT.adobe} />

      {/* Portal furniture: purple bean bags (per renders) */}
      <mesh position={[-2.4, F1 + 0.3, 4.9]} scale={[1, 0.7, 1]} castShadow={SHADOWS} material={MAT.purple}>
        <sphereGeometry args={[0.42, 16, 12]} />
      </mesh>
      <mesh position={[2.15, F1 + 0.28, 4.85]} scale={[1, 0.7, 1]} castShadow={SHADOWS} material={MAT.purple}>
        <sphereGeometry args={[0.38, 16, 12]} />
      </mesh>
      {[[-1.5, 6.0], [1.8, 6.0]].map(([x, z], i) => (
        <group key={`pot${i}`}>
          <mesh position={[x, 0.2, z]} castShadow={SHADOWS} material={MAT.tile}>
            <cylinderGeometry args={[0.22, 0.16, 0.4, 10]} />
          </mesh>
          <mesh position={[x, 0.7, z]} material={MAT.leaf}>
            <sphereGeometry args={[0.35, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* Garden trees (tropical vegetation around the house) */}
      {[[-9, -4], [-8, 6], [9, 5], [8, -6], [-4, 11], [5, 12]]
        .slice(0, QUALITY.trees)
        .map(([x, z], i) => (
          <group key={`tree${i}`}>
            <mesh position={[x, 1.6, z]} castShadow={SHADOWS} material={MAT.trunk}>
              <cylinderGeometry args={[0.14, 0.2, 3.2, 8]} />
            </mesh>
            <mesh position={[x, 3.7, z]} castShadow={SHADOWS} material={MAT.leaf}>
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

// ─── Fittings (no collision) ─────────────────────────────────────────────────
// Rendered OUTSIDE the RigidBody on purpose: an open door leaf, a handrail or a
// gable triangle would otherwise become a bounding-box collider.

// Door leaf hinged at [x, z], swung `angle` radians about Y.
// angle 0 → leaf along +X, π/2 → along -Z, π → along -X, -π/2 → along +Z.
function Door({ hinge, y, width = 0.8, height = DOOR, angle, mat = MAT.woodLight }) {
  return (
    <group position={[hinge[0], y, hinge[1]]} rotation={[0, angle, 0]}>
      <Box pos={[width / 2, height / 2, 0]} size={[width, height, 0.045]} mat={mat} castShadow />
      <Box pos={[width - 0.08, height / 2 - 0.05, 0.04]} size={[0.05, 0.05, 0.1]} mat={MAT.frame} />
    </group>
  );
}

// Pendant lamp hanging `drop` metres below the ceiling
function Lamp({ pos, drop = 0.35 }) {
  const [x, y, z] = pos;
  return (
    <group>
      <Box pos={[x, y + drop / 2, z]} size={[0.015, drop, 0.015]} mat={MAT.frame} />
      <mesh position={[x, y - 0.02, z]} material={MAT.lamp}>
        <sphereGeometry args={[0.1, 12, 10]} />
      </mesh>
      <mesh position={[x, y + 0.07, z]} material={MAT.black}>
        <coneGeometry args={[0.19, 0.18, 14, 1, true]} />
      </mesh>
    </group>
  );
}

// Triangular infill under a side roof at the front/back facade
function Gable({ side, z }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(side * a0, WT);
    s.lineTo(side * hw, WT);
    s.lineTo(side * a0, ROOF_HI);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
  }, [side]);
  return <mesh geometry={geo} position={[0, 0, z]} material={MAT.adobe} castShadow={SHADOWS} receiveShadow={SHADOWS} />;
}

function Fittings() {
  return (
    <>
      {/* Doors, all standing open against a wall */}
      <Door hinge={[-2.45, 2.85]} y={F1} width={0.7} angle={1.45} />        {/* baño PB */}
      <Door hinge={[-2.55, 0]} y={F2} width={0.8} angle={1.45} />            {/* dormitorio 2 */}
      <Door hinge={[-AX, -0.1]} y={F2} width={0.7} angle={0.1} />            {/* dormitorio 1 */}
      <Door hinge={[-3.03, 0.8]} y={F2} width={0.68} angle={Math.PI - 0.1} />{/* baño 2 */}
      <Door hinge={[AX, 2.6]} y={F2} width={0.72} angle={0.1} />             {/* master */}
      <Door hinge={[3.03, -1.25]} y={F2} width={0.7} angle={Math.PI / 2 + 0.1} />{/* baño en-suite */}

      {/* Stair handrail, wall-mounted on the kitchen side */}
      <Box pos={[STAIR_X0 + STAIR_RUN - (STAIR_STEPS * STAIR_RUN) / 2, (F1 + F2) / 2 + 0.9, STAIR_Z0 + 0.05]}
           rot={[0, 0, -STAIR_ANGLE]}
           size={[Math.hypot(STAIR_STEPS * STAIR_RUN, F2 - F1), 0.05, 0.05]} mat={MAT.wood} />

      {/* Gable infills under the side roofs (front + back) */}
      <Gable side={-1} z={id} />
      <Gable side={1} z={id} />
      <Gable side={-1} z={-hd} />
      <Gable side={1} z={-hd} />

      {/* Pendant lamps */}
      <Lamp pos={[3.25, C1 - 0.35, -1.9]} />          {/* comedor */}
      <Lamp pos={[-3.0, C1 - 0.35, -1.45]} />         {/* mesa de billar */}
      <Lamp pos={[0.41, C2 - 0.4, -1.9]} drop={0.4} />{/* dormitorio 1 */}
      <Lamp pos={[3.37, C2 - 0.4, 2.0]} drop={0.4} /> {/* master */}
    </>
  );
}

// ─── Lighting + atmosphere ───────────────────────────────────────────────────

function Atmosphere() {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#AFD1E8');
    scene.fog = new THREE.Fog('#D8CBB2', QUALITY.fog[0], QUALITY.fog[1]);
    return () => { scene.background = null; scene.fog = null; };
  }, [scene]);
  return null;
}

const SUN = [12, 14, 8];

// Interior warm fill, most important first: QUALITY.fillLights trims the tail
// on weaker devices (each point light is a per-fragment cost on every surface).
const FILLS = [
  { pos: [2.8, C1 - 0.4, 1.2],   intensity: 1.2, distance: 8 },  // sala + vestíbulo
  { pos: [-0.3, F2 + 1.9, 2.4],  intensity: 1.0, distance: 8 },  // hall alto
  { pos: [-3.1, C1 - 0.4, -1.4], intensity: 1.0, distance: 7 },  // extra / estudio
  { pos: [0.0, C1 - 0.4, -0.6],  intensity: 0.9, distance: 6 },  // cocina
  { pos: [3.2, F2 + 1.9, 1.6],   intensity: 0.8, distance: 7 },  // master
  { pos: [-3.2, F2 + 1.9, -1.6], intensity: 0.8, distance: 7 },  // dormitorio 2
];

function Lighting() {
  return (
    <>
      <hemisphereLight skyColor="#9FC6E8" groundColor="#7E6C52" intensity={0.5} />

      <directionalLight
        position={SUN}
        intensity={2.6}
        color="#FFF1D6"
        castShadow={SHADOWS}
        shadow-mapSize={[QUALITY.shadowMap, QUALITY.shadowMap]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0008}
        shadow-normalBias={0.04}
      />

      <directionalLight position={[-9, 7, -7]} intensity={0.3} color="#C0D6F4" />

      {FILLS.slice(0, QUALITY.fillLights).map((f, i) => (
        <pointLight key={i} position={f.pos} intensity={f.intensity}
                    color="#FFE0A8" distance={f.distance} decay={2} />
      ))}

      <Sky distance={250} sunPosition={SUN} turbidity={2} rayleigh={3.2}
           mieCoefficient={0.005} mieDirectionalG={0.8} />

      <Environment resolution={QUALITY.env} frames={1}>
        <Lightformer form="rect" intensity={2.0} color="#FFE9C4"
                     position={[8, 9, 6]} scale={[12, 12, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.7} color="#BBD4F5"
                     position={[-9, 7, -7]} scale={[14, 14, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.5} color="#DCEBFF"
                     position={[0, 12, 0]} scale={[16, 16, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.45} color="#9C8A63"
                     rotation-x={Math.PI / 2} position={[0, -3, 0]} scale={[30, 30, 1]} />
      </Environment>
    </>
  );
}

export default function Scene() {
  return (
    <>
      <Atmosphere />
      <Lighting />
      <ProceduralHouse />
      <Fittings />
    </>
  );
}

// useGLTF.preload('/models/casa.glb');
