import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';
import '../styles/overlay.css';

export default function LoadingScreen() {
  const { progress, active } = useProgress();
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!active && progress === 100) {
      setFadingOut(true);
      const t = setTimeout(() => setVisible(false), 650);
      return () => clearTimeout(t);
    }
  }, [active, progress]);

  if (!visible) return null;

  return (
    <div className={`loading-screen${fadingOut ? ' fade-out' : ''}`}>
      <p className="loading-title">Casa de Adobe</p>
      <div className="loading-bar-wrap">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="loading-pct">{Math.round(progress)}%</p>
    </div>
  );
}
