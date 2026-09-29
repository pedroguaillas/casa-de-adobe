import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PerformanceMonitor } from '@react-three/drei';
import { Suspense, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import Scene from './Scene';
import PlayerController from './PlayerController';
import LoadingScreen from './LoadingScreen';
import Crosshair from './Crosshair';
import Instructions from './Instructions';
import FloorIndicator from './FloorIndicator';
import TouchControls from './TouchControls';
import { QUALITY, isTouch } from '../lib/quality.js';

// Touch devices have no pointer lock: the tour starts on tap and we ask for
// fullscreen so the browser chrome stops eating the viewport.
async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    }
    await screen.orientation?.lock?.('landscape').catch(() => {});
  } catch {
    /* fullscreen/orientation are best-effort — iOS Safari refuses both */
  }
}

export default function HouseTour() {
  const [locked, setLocked] = useState(false);
  const [playerY, setPlayerY] = useState(1.05); // initial capsule center Y
  const [dpr, setDpr] = useState(QUALITY.dpr[1]);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    if (!isTouch) return;
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  const start = useCallback(() => {
    if (!isTouch) return; // desktop enters through PointerLockControls
    enterFullscreen();
    setLocked(true);
  }, []);

  const exit = useCallback(() => {
    setLocked(false);
    if (document.fullscreenElement) document.exitFullscreen?.();
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0806' }}>
      <Canvas
        dpr={dpr}
        // PCFSoftShadowMap is deprecated in three 0.185; PCF is the supported filter
        shadows={QUALITY.shadows ? { type: THREE.PCFShadowMap } : false}
        camera={{ fov: QUALITY.fov, near: 0.05, far: QUALITY.far, position: [0, 1.65, 10.5] }}
        gl={{
          antialias: QUALITY.antialias,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          if (QUALITY.shadows) gl.shadowMap.autoUpdate = true;
        }}
      >
        {/* Drop resolution rather than framerate when the GPU can't keep up */}
        <PerformanceMonitor
          onDecline={() => setDpr(QUALITY.dpr[0])}
          onIncline={() => setDpr(QUALITY.dpr[1])}
          flipflops={3}
          onFallback={() => setDpr(QUALITY.dpr[0])}
        />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, -22, 0]}
            // timeStep="vary" lets rapier match actual frame delta
            timeStep="vary"
            debug={import.meta.env.DEV && typeof window !== 'undefined' && window.location.search.includes('debug')}
          >
            <Scene />
            <PlayerController
              active={locked}
              onLockChange={setLocked}
              onFloorChange={setPlayerY}
            />
          </Physics>
        </Suspense>
      </Canvas>

      {/* UI overlays — rendered outside Canvas as regular DOM */}
      <LoadingScreen />
      <Instructions locked={locked} touch={isTouch} onStart={start} />
      {locked && !isTouch && <Crosshair />}
      {locked && <FloorIndicator playerY={playerY} />}
      {locked && isTouch && <TouchControls onExit={exit} />}
      {isTouch && portrait && (
        <div className="rotate-hint">
          <span className="rotate-icon">⟳</span>
          Gira el teléfono para un mejor recorrido
        </div>
      )}
    </div>
  );
}
