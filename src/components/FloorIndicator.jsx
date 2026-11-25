import '../styles/overlay.css';

// playerY is capsule centre Y: ≈ 1.10 on planta baja (+0.20), ≈ 3.50 on planta alta (+2.60)
const FLOOR_2_THRESHOLD = 2.3;

export default function FloorIndicator({ playerY }) {
  const floor = playerY > FLOOR_2_THRESHOLD ? 2 : 1;
  const label = floor === 1 ? 'Planta Baja' : 'Planta Alta';
  return <div className="floor-indicator">{label}</div>;
}
