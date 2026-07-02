import '../styles/overlay.css';

// ADJUST: playerY is capsule center Y. Capsule center on floor 2 ≈ 2.80 + 1.05 = 3.85
// Set FLOOR_2_THRESHOLD to ~2.5 to catch transition reliably
const FLOOR_2_THRESHOLD = 2.5;

export default function FloorIndicator({ playerY }) {
  const floor = playerY > FLOOR_2_THRESHOLD ? 2 : 1;
  const label = floor === 1 ? 'Planta Baja' : 'Planta Alta';
  return <div className="floor-indicator">{label}</div>;
}
