// Shared mutable input state. Written by TouchControls (DOM, outside the
// Canvas), read by PlayerController inside useFrame — a plain object avoids a
// React re-render per touch move.
export const input = {
  move: { x: 0, y: 0 },   // analogue stick, -1..1 (y = forward)
  look: { dx: 0, dy: 0 }, // pixels accumulated since last frame; consumed by the frame loop
  sprint: false,
};

export function resetInput() {
  input.move.x = 0;
  input.move.y = 0;
  input.look.dx = 0;
  input.look.dy = 0;
  input.sprint = false;
}
