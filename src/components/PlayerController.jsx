import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────────────────────
// ADJUST: spawn exterior fachada frontal centrado
const SPAWN  = [0, 1.05, 8.0];
// Capsule: half-height 0.70 + radius 0.35 → total 2.10m, center spawns at 1.05 → bottom at ground
const CAPSULE_HALF_H = 0.70;
const CAPSULE_RADIUS = 0.35;
// Camera eye = capsule center + EYE_OFFSET → ~1.65m above floor
const EYE_OFFSET = 0.60;

const WALK_SPEED = 4.5; // m/s
const GRAVITY    = -22; // m/s²

// ── Key state ─────────────────────────────────────────────────────────────────
function useKeys() {
  const keys = useRef({ w: false, a: false, s: false, d: false });
  useEffect(() => {
    const dn = (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    keys.current.w = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  keys.current.a = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  keys.current.s = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.d = true;
    };
    const up = (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    keys.current.w = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  keys.current.a = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  keys.current.s = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.d = false;
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}

// ── Temp vectors (reused each frame) ─────────────────────────────────────────
const _fwd  = new THREE.Vector3();
const _rgt  = new THREE.Vector3();
const _move = new THREE.Vector3();
const _up   = new THREE.Vector3(0, 1, 0);

// ── Physics + movement ────────────────────────────────────────────────────────
function PlayerPhysics({ onLockChange, onFloorChange }) {
  const bodyRef      = useRef(null);   // raw RAPIER.RigidBody
  const colliderRef  = useRef(null);   // raw RAPIER.Collider (from CapsuleCollider ref)
  const ccRef        = useRef(null);   // KinematicCharacterController
  const velocityY    = useRef(0);
  const lastFloor    = useRef(1);
  const keys         = useKeys();
  const { camera }   = useThree();
  const { world }    = useRapier();    // raw RAPIER.World

  // Build character controller once
  useEffect(() => {
    const cc = world.createCharacterController(0.01);
    cc.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    cc.setMinSlopeSlideAngle((50 * Math.PI) / 180);
    cc.enableAutostep(0.40, 0.10, true);
    cc.enableSnapToGround(0.4);
    ccRef.current = cc;
    return () => world.removeCharacterController(cc);
  }, [world]);

  useFrame((_, delta) => {
    // Wait until both body and collider are ready
    if (!bodyRef.current || !colliderRef.current || !ccRef.current) return;

    const dt = Math.min(delta, 0.05);

    // ── Horizontal movement relative to camera yaw ─────────────────────────
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    _rgt.crossVectors(_fwd, _up).normalize();

    _move.set(0, 0, 0);
    if (keys.current.w) _move.addScaledVector(_fwd, 1);
    if (keys.current.s) _move.addScaledVector(_fwd, -1);
    if (keys.current.a) _move.addScaledVector(_rgt, -1);
    if (keys.current.d) _move.addScaledVector(_rgt, 1);
    if (_move.lengthSq() > 0) _move.normalize();
    _move.multiplyScalar(WALK_SPEED);

    // ── Gravity ────────────────────────────────────────────────────────────
    velocityY.current += GRAVITY * dt;

    const desired = {
      x: _move.x * dt,
      y: velocityY.current * dt,
      z: _move.z * dt,
    };

    // ── Character controller (colliderRef.current = raw RAPIER.Collider) ───
    ccRef.current.computeColliderMovement(colliderRef.current, desired);

    if (ccRef.current.computedGrounded()) {
      velocityY.current = Math.max(0, velocityY.current);
    }

    const corrected = ccRef.current.computedMovement();
    // bodyRef.current = raw RAPIER.RigidBody — no .raw() needed
    const pos = bodyRef.current.translation();
    bodyRef.current.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    });

    // ── Sync camera to body ────────────────────────────────────────────────
    const np = bodyRef.current.translation();
    camera.position.set(np.x, np.y + EYE_OFFSET, np.z);

    // ── Floor indicator ────────────────────────────────────────────────────
    // ADJUST: threshold 2.5 assumes entrepiso 2.80m; change if your model differs
    const floor = np.y > 2.5 ? 2 : 1;
    if (floor !== lastFloor.current) {
      lastFloor.current = floor;
      onFloorChange?.(np.y);
    }
  });

  return (
    // ADJUST: SPAWN position to match exterior of your casa.glb
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      position={SPAWN}
      enabledRotations={[false, false, false]}
      colliders={false}
    >
      <CapsuleCollider ref={colliderRef} args={[CAPSULE_HALF_H, CAPSULE_RADIUS]} />
    </RigidBody>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PlayerController({ onLockChange, onFloorChange }) {
  return (
    <>
      <PointerLockControls
        onLock={() => onLockChange?.(true)}
        onUnlock={() => onLockChange?.(false)}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI - 0.1}
      />
      <PlayerPhysics onLockChange={onLockChange} onFloorChange={onFloorChange} />
    </>
  );
}
