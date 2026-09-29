import { useEffect, useRef } from 'react';
import { input, resetInput } from '../lib/input.js';
import '../styles/overlay.css';

// Floating joystick: the base appears wherever the left thumb lands.
const JOY_RADIUS = 58;
const LOOK_ZONE = 0.45; // left fraction of the screen reserved for the stick

export default function TouchControls({ onExit }) {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const moveId = useRef(null);
  const lookId = useRef(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => resetInput, []);

  const showJoy = (x, y) => {
    const base = baseRef.current;
    base.style.left = `${x}px`;
    base.style.top = `${y}px`;
    base.style.opacity = '1';
    knobRef.current.style.transform = 'translate(-50%, -50%)';
  };

  const hideJoy = () => {
    baseRef.current.style.opacity = '0';
    knobRef.current.style.transform = 'translate(-50%, -50%)';
  };

  const onPointerDown = (e) => {
    if (e.target.dataset?.btn) return; // buttons manage their own state
    // Capture so a thumb that slides off the element keeps feeding us moves.
    // Best-effort: a pointer released between down and here throws NotFoundError.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (e.clientX < window.innerWidth * LOOK_ZONE && moveId.current === null) {
      moveId.current = e.pointerId;
      showJoy(e.clientX, e.clientY);
    } else if (lookId.current === null) {
      lookId.current = e.pointerId;
      lookLast.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e) => {
    if (e.pointerId === moveId.current) {
      const base = baseRef.current;
      const ox = parseFloat(base.style.left);
      const oy = parseFloat(base.style.top);
      let dx = e.clientX - ox;
      let dy = e.clientY - oy;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      input.move.x = dx / JOY_RADIUS;
      input.move.y = -dy / JOY_RADIUS;
    } else if (e.pointerId === lookId.current) {
      input.look.dx += e.clientX - lookLast.current.x;
      input.look.dy += e.clientY - lookLast.current.y;
      lookLast.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerUp = (e) => {
    if (e.pointerId === moveId.current) {
      moveId.current = null;
      input.move.x = 0;
      input.move.y = 0;
      hideJoy();
    } else if (e.pointerId === lookId.current) {
      lookId.current = null;
    }
  };

  return (
    <div
      className="touch-layer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="joy-base" ref={baseRef}>
        <div className="joy-knob" ref={knobRef} />
      </div>

      <button
        className="touch-btn touch-sprint"
        data-btn="sprint"
        onPointerDown={(e) => {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
          input.sprint = true;
        }}
        onPointerUp={() => { input.sprint = false; }}
        onPointerCancel={() => { input.sprint = false; }}
      >
        Correr
      </button>

      <button className="touch-btn touch-exit" data-btn="exit" onPointerDown={onExit}>
        Salir
      </button>
    </div>
  );
}
