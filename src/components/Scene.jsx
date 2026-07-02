import { Environment } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useRef } from 'react';
import * as THREE from 'three';

// House dimensions from architectural plans (meters)
const W = 9.95;
const D = 7.5;
const H = 2.8;
const T = 0.2;

// ─── Placeholder house ────────────────────────────────────────────────────────
// REPLACE PlaceholderHouse with RealHouse once casa.glb is ready:
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

// Shared material instances (avoid re-creating per mesh)
const MAT = {
  adobe:    new THREE.MeshStandardMaterial({ color: '#C8A96E', roughness: 0.92, metalness: 0 }),
  adobeSide:new THREE.MeshStandardMaterial({ color: '#BDA080', roughness: 0.92, metalness: 0 }),
  floor:    new THREE.MeshStandardMaterial({ color: '#D4B896', roughness: 0.75, metalness: 0 }),
  grass:    new THREE.MeshStandardMaterial({ color: '#5A7A3A', roughness: 1.0,  metalness: 0 }),
  wood:     new THREE.MeshStandardMaterial({ color: '#6B4226', roughness: 0.7,  metalness: 0 }),
  tile:     new THREE.MeshStandardMaterial({ color: '#7A3B1E', roughness: 0.8,  metalness: 0 }),
  stone:    new THREE.MeshStandardMaterial({ color: '#9E8B72', roughness: 0.95, metalness: 0 }),
  ceiling:  new THREE.MeshStandardMaterial({ color: '#EDE0CC', roughness: 0.85, metalness: 0 }),
};

function Box({ pos, size, mat, castShadow = false, receiveShadow = true }) {
  return (
    <mesh position={pos} castShadow={castShadow} receiveShadow={receiveShadow} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  );
}

const STEP_COUNT = 16;
const STEP_RISE  = H / STEP_COUNT;
const STEP_RUN   = 0.28;
const STEP_W     = 2.0;

function Stairs() {
  return (
    <>
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <Box
          key={i}
          pos={[-1.5 + (i + 0.5) * STEP_RUN, i * STEP_RISE + STEP_RISE / 2, -0.5]}
          size={[STEP_RUN, STEP_RISE, STEP_W]}
          mat={MAT.wood}
          castShadow
        />
      ))}
    </>
  );
}

function PlaceholderHouse() {
  const hw = W / 2;
  const hd = D / 2;

  return (
    <RigidBody type="fixed" colliders="cuboid">
      {/* ── Exterior ─────────────────────────────────────────── */}
      {/* Ground */}
      <Box pos={[0, -0.1, 0]}  size={[80, 0.2, 80]} mat={MAT.grass} receiveShadow />
      {/* Stone pathway to entrance */}
      <Box pos={[0, 0.01, 6.5]} size={[2, 0.05, 5]}  mat={MAT.stone} receiveShadow />

      {/* ── Ground floor ─────────────────────────────────────── */}
      {/* Floor slab */}
      <Box pos={[0, 0.1, 0]} size={[W, 0.2, D]} mat={MAT.floor} receiveShadow />
      {/* Ceiling */}
      <Box pos={[0, H - 0.05, 0]} size={[W - T*2, 0.1, D - T*2]} mat={MAT.ceiling} receiveShadow />

      {/* Front wall — left section (leaves ~1.2m door gap near center-right) */}
      <Box pos={[-2.8, H/2, hd]} size={[4.35, H, T]} mat={MAT.adobe} castShadow />
      {/* Front wall — right section */}
      <Box pos={[3.7, H/2, hd]}  size={[1.55, H, T]} mat={MAT.adobe} castShadow />
      {/* Back wall */}
      <Box pos={[0, H/2, -hd]}   size={[W, H, T]}    mat={MAT.adobe} castShadow />
      {/* Left wall (with window gap mid-height visual hint) */}
      <Box pos={[-hw, H*0.25, 0]}        size={[T, H*0.5, D]}    mat={MAT.adobeSide} castShadow />
      <Box pos={[-hw, H*0.85, 0]}        size={[T, H*0.3, D]}    mat={MAT.adobeSide} castShadow />
      <Box pos={[-hw, H*0.55, -hd*0.6]}  size={[T, H*0.3, D*0.5]} mat={MAT.adobeSide} castShadow />
      <Box pos={[-hw, H*0.55,  hd*0.6]}  size={[T, H*0.3, D*0.2]} mat={MAT.adobeSide} castShadow />
      {/* Right wall */}
      <Box pos={[hw, H/2, 0]}   size={[T, H, D]}    mat={MAT.adobeSide} castShadow />

      {/* Interior dividing wall (ESTUDIO / SALA area) */}
      <Box pos={[-1.2, H*0.4, 0.8]} size={[T, H*0.8, D*0.55]} mat={MAT.floor} />

      {/* Stone base trim on exterior (ground floor bottom 0.6m) */}
      <Box pos={[0, 0.3, hd+0.01]}  size={[W, 0.6, 0.04]} mat={MAT.stone} castShadow />
      <Box pos={[0, 0.3, -hd-0.01]} size={[W, 0.6, 0.04]} mat={MAT.stone} />
      <Box pos={[-hw-0.01, 0.3, 0]} size={[0.04, 0.6, D]} mat={MAT.stone} />
      <Box pos={[hw+0.01,  0.3, 0]} size={[0.04, 0.6, D]} mat={MAT.stone} />

      {/* Staircase */}
      <Stairs />

      {/* ── Second floor ─────────────────────────────────────── */}
      {/* Floor slab */}
      <Box pos={[0, H+0.1, 0]} size={[W, 0.2, D]} mat={MAT.floor} receiveShadow />
      {/* Ceiling */}
      <Box pos={[0, H*2-0.05, 0]} size={[W-T*2, 0.1, D-T*2]} mat={MAT.ceiling} receiveShadow />

      {/* Back wall */}
      <Box pos={[0, H+H/2, -hd]} size={[W, H, T]}    mat={MAT.adobe} castShadow />
      {/* Left wall */}
      <Box pos={[-hw, H+H/2, 0]} size={[T, H, D]}    mat={MAT.adobeSide} castShadow />
      {/* Right wall */}
      <Box pos={[hw, H+H/2, 0]}  size={[T, H, D]}    mat={MAT.adobeSide} castShadow />
      {/* Front wall — left section (balcony opening ~3m gap center) */}
      <Box pos={[-3.5, H+H/2, hd]} size={[2.95, H, T]} mat={MAT.adobe} castShadow />
      {/* Front wall — right section */}
      <Box pos={[3.5,  H+H/2, hd]} size={[2.95, H, T]} mat={MAT.adobe} castShadow />

      {/* Balcony floor slab (extends slightly beyond front wall) */}
      <Box pos={[0, H+0.05, hd+0.5]} size={[3.0, 0.1, 1.0]} mat={MAT.stone} receiveShadow />
      {/* Balcony railing posts */}
      {[-1.2, 0, 1.2].map((x) => (
        <Box key={x} pos={[x, H+0.55, hd+1.0]} size={[0.08, 1.0, 0.08]} mat={MAT.wood} castShadow />
      ))}
      {/* Balcony railing top rail */}
      <Box pos={[0, H+1.05, hd+1.0]} size={[3.0, 0.06, 0.06]} mat={MAT.wood} />

      {/* ── Roof ──────────────────────────────────────────────── */}
      {/* Wide overhang beam (wooden alero) */}
      <Box pos={[0, H*2+0.12, 0]} size={[W+1.0, 0.18, D+1.0]} mat={MAT.wood} castShadow receiveShadow />
      {/* Left roof slope */}
      <mesh
        position={[-W*0.25, H*2+0.5, 0]}
        rotation={[0, 0, -0.38]}
        castShadow
        receiveShadow
        material={MAT.tile}
      >
        <boxGeometry args={[W*0.57, 0.12, D+0.8]} />
      </mesh>
      {/* Right roof slope */}
      <mesh
        position={[W*0.25, H*2+0.5, 0]}
        rotation={[0, 0, 0.38]}
        castShadow
        receiveShadow
        material={MAT.tile}
      >
        <boxGeometry args={[W*0.57, 0.12, D+0.8]} />
      </mesh>
    </RigidBody>
  );
}

// ─── Lighting ────────────────────────────────────────────────────────────────

function Lighting() {
  return (
    <>
      {/* Sky / ground hemisphere — warm tropical afternoon */}
      <hemisphereLight
        skyColor="#87CEEB"
        groundColor="#8B7355"
        intensity={0.6}
      />

      {/* Main sun — afternoon angle, front-right of house */}
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

      {/* Soft sky bounce — left/back fill */}
      <directionalLight position={[-8, 8, -6]} intensity={0.35} color="#C8D8F0" />

      {/* Window light shafts — ground floor left wall windows */}
      {/* ADJUST position if real casa.glb has windows elsewhere */}
      <rectAreaLight
        position={[-4.8, 1.8, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={2.5}
        height={1.4}
        intensity={6}
        color="#FFE8B0"
      />
      {/* Window — right wall */}
      <rectAreaLight
        position={[4.8, 1.8, 1]}
        rotation={[0, -Math.PI / 2, 0]}
        width={2}
        height={1.4}
        intensity={4}
        color="#FFE8B0"
      />
      {/* Window — second floor left */}
      <rectAreaLight
        position={[-4.8, H + 1.8, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={2.5}
        height={1.4}
        intensity={5}
        color="#FFE8C0"
      />

      {/* Interior warm ambient — ground floor */}
      <pointLight
        position={[2, 2.0, 1]}
        intensity={1.2}
        color="#FFE4B0"
        distance={8}
        decay={2}
      />
      {/* Interior warm ambient — second floor */}
      <pointLight
        position={[1, H + 2.0, 0]}
        intensity={1.0}
        color="#FFE4B0"
        distance={8}
        decay={2}
      />

      {/* HDRI environment — provides sky reflections and IBL */}
      <Environment preset="sunset" background={false} />

      {/* Atmospheric fog — gives depth to exterior */}
      <fog attach="fog" args={['#D4C5A9', 40, 120]} />
    </>
  );
}

export default function Scene() {
  return (
    <>
      <Lighting />
      <PlaceholderHouse />
    </>
  );
}

// useGLTF.preload('/models/casa.glb');
