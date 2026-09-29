import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';
import '../styles/overlay.css';

export default function LoadingScreen() {
  const { progress, active } = useProgress();
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Everything in the scene is procedural, so the loader can report 0/0 and
    // never reach 100. `active` going false is the real "scene is up" signal;
    // the grace period covers the gap before a loader has registered anything.
    if (active) return;
    const grace = setTimeout(() => setFadingOut(true), progress === 100 ? 0 : 450);
    return () => clearTimeout(grace);
  }, [active, progress]);

  useEffect(() => {
    if (!fadingOut) return;
    const t = setTimeout(() => setVisible(false), 650);
    return () => clearTimeout(t);
  }, [fadingOut]);

  if (!visible) return null;

  return (
    <div className={`loading-screen${fadingOut ? ' fade-out' : ''}`}>
      <p className="loading-title">Casa de Adobe</p>
      <div className="loading-bar-wrap">
        <div className="loading-bar-fill" style={{ width: `${Math.max(progress, fadingOut ? 100 : 8)}%` }} />
      </div>
      <p className="loading-pct">{Math.round(Math.max(progress, fadingOut ? 100 : 0))}%</p>
    </div>
  );
}
