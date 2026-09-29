import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { input } from '../lib/input.js';
import { isTouch } from '../lib/quality.js';

// ── Constants ─────────────────────────────────────────────────────────────────
// ADJUST: spawn exterior fachada frontal centrado
const SPAWN  = [0, 0.95, 10.5];
// Capsule: half-height 0.60 + radius 0.30 → total 1.80m (clears 2.1m door openings)
const CAPSULE_HALF_H = 0.60;
const CAPSULE_RADIUS = 0.30;
// Camera eye = capsule center + EYE_OFFSET → ~1.65m above floor
const EYE_OFFSET = 0.75;

const WALK_SPEED   = 2.6;  // m/s — human walking pace
const SPRINT_SPEED = 4.8;  // m/s
const ACCEL        = 16;   // m/s² ramp-up
const DECEL        = 22;   // m/s² ramp-down
const GRAVITY      = -22;  // m/s²

// Head bob — subtle; tuned so a full stride is ~2 steps/s at walking pace
const BOB_FREQ   = 1.85;   // cycles per metre travelled
const BOB_Y      = 0.032;  // metres
const BOB_X      = 0.022;  // metres of lateral sway
const TOUCH_LOOK = 0.0032; // radians per pixel dragged
const PITCH_LIMIT = Math.PI / 2 - 0.08;

// ── Key state ─────────────────────────────────────────────────────────────────
function useKeys() {
  const keys = useRef({ w: false, a: false, s: false, d: false, sprint: false });
  useEffect(() => {
    const dn = (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    keys.current.w = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  keys.current.a = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  keys.current.s = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.d = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.sprint = true;
    };
    const up = (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    keys.current.w = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  keys.current.a = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  keys.current.s = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.d = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.sprint = false;
    };
    // Releasing keys on blur avoids "stuck walking" after an alt-tab
    const blur = () => { keys.current = { w: false, a: false, s: false, d: false, sprint: false }; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return keys;
}

// ── Temp vectors (reused each frame) ─────────────────────────────────────────
const _fwd  = new THREE.Vector3();
const _rgt  = new THREE.Vector3();
const _want = new THREE.Vector3();
const _up   = new THREE.Vector3(0, 1, 0);

// ── Physics + movement ────────────────────────────────────────────────────────
function PlayerPhysics({ onFloorChange, active }) {
  const bodyRef      = useRef(null);   // raw RAPIER.RigidBody
  const colliderRef  = useRef(null);   // raw RAPIER.Collider (from CapsuleCollider ref)
  const ccRef        = useRef(null);   // KinematicCharacterController
  const velocity     = useRef(new THREE.Vector3()); // horizontal, m/s
  const velocityY    = useRef(0);
  const bobDist      = useRef(0);
  const yaw          = useRef(0);
  const pitch        = useRef(0);
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

  // On touch we own the camera orientation (no PointerLockControls)
  useEffect(() => {
    if (!isTouch) return;
    camera.rotation.order = 'YXZ';
    yaw.current = camera.rotation.y;
    pitch.current = camera.rotation.x;
  }, [camera]);

  useFrame((_, delta) => {
    // Wait until both body and collider are ready
    if (!bodyRef.current || !colliderRef.current || !ccRef.current) return;

    const dt = Math.min(delta, 0.05);

    // ── Touch look ─────────────────────────────────────────────────────────
    if (isTouch) {
      yaw.current   -= input.look.dx * TOUCH_LOOK;
      pitch.current -= input.look.dy * TOUCH_LOOK;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -PITCH_LIMIT, PITCH_LIMIT);
      input.look.dx = 0;
      input.look.dy = 0;
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    }

    // ── Desired direction, relative to camera yaw ──────────────────────────
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    _rgt.crossVectors(_fwd, _up).normalize();

    _want.set(0, 0, 0);
    if (active) {
      if (keys.current.w) _want.addScaledVector(_fwd, 1);
      if (keys.current.s) _want.addScaledVector(_fwd, -1);
      if (keys.current.a) _want.addScaledVector(_rgt, -1);
      if (keys.current.d) _want.addScaledVector(_rgt, 1);
      // Analogue stick is additive: the magnitude survives, so half-tilt walks slowly
      _want.addScaledVector(_fwd, input.move.y);
      _want.addScaledVector(_rgt, input.move.x);
    }
    if (_want.lengthSq() > 1) _want.normalize();

    const sprinting = keys.current.sprint || input.sprint;
    _want.multiplyScalar(sprinting ? SPRINT_SPEED : WALK_SPEED);

    // ── Smooth acceleration (no instant start/stop) ────────────────────────
    const rate = Math.min(1, (_want.lengthSq() > 0 ? ACCEL : DECEL) * dt);
    velocity.current.x += (_want.x - velocity.current.x) * rate;
    velocity.current.z += (_want.z - velocity.current.z) * rate;
    if (Math.abs(velocity.current.x) < 0.01) velocity.current.x = 0;
    if (Math.abs(velocity.current.z) < 0.01) velocity.current.z = 0;

    // ── Gravity ────────────────────────────────────────────────────────────
    velocityY.current += GRAVITY * dt;

    const desired = {
      x: velocity.current.x * dt,
      y: velocityY.current * dt,
      z: velocity.current.z * dt,
    };

    // ── Character controller (colliderRef.current = raw RAPIER.Collider) ───
    ccRef.current.computeColliderMovement(colliderRef.current, desired);

    const grounded = ccRef.current.computedGrounded();
    if (grounded) {
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

    // ── Sync camera to body, with head bob ─────────────────────────────────
    const np = bodyRef.current.translation();
    const travelled = Math.hypot(corrected.x, corrected.z);
    let bobY = 0, bobX = 0;
    if (grounded) {
      bobDist.current += travelled;
      // amplitude scales with how fast we are actually moving, not input
      const amp = Math.min(1, (travelled / dt) / WALK_SPEED);
      const phase = bobDist.current * BOB_FREQ * Math.PI * 2;
      bobY = Math.sin(phase) * BOB_Y * amp;
      bobX = Math.cos(phase * 0.5) * BOB_X * amp;
    }
    camera.position.set(
      np.x + _rgt.x * bobX,
      np.y + EYE_OFFSET + bobY,
      np.z + _rgt.z * bobX,
    );
    if (import.meta.env.DEV) {
      window.__playerPos = { x: np.x, y: np.y, z: np.z };
      window.__world = world;
    }

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
export default function PlayerController({ onLockChange, onFloorChange, active = true }) {
  return (
    <>
      {!isTouch && (
        <PointerLockControls
          onLock={() => onLockChange?.(true)}
          onUnlock={() => onLockChange?.(false)}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI - 0.1}
        />
      )}
      <PlayerPhysics onFloorChange={onFloorChange} active={active} />
    </>
  );
}
