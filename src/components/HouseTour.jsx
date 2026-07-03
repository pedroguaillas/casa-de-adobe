import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useState, useRef } from 'react';
import Scene from './Scene';
import PlayerController from './PlayerController';
import LoadingScreen from './LoadingScreen';
import Crosshair from './Crosshair';
import Instructions from './Instructions';
import FloorIndicator from './FloorIndicator';

export default function HouseTour() {
  const [locked, setLocked] = useState(false);
  const [playerY, setPlayerY] = useState(1.05); // initial capsule center Y

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0806' }}>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.05, far: 300, position: [0, 1.65, 10.5] }}
        gl={{
          antialias: true,
          // Cap pixel ratio — crucial for Retina/4K performance
          pixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
        }}
      >
        <Suspense fallback={null}>
          <Physics
            gravity={[0, -22, 0]}
            // timeStep="vary" lets rapier match actual frame delta
            timeStep="vary"
            debug={import.meta.env.DEV && typeof window !== 'undefined' && window.location.search.includes('debug')}
          >
            <Scene />
            <PlayerController
              onLockChange={setLocked}
              onFloorChange={setPlayerY}
            />
          </Physics>
        </Suspense>
      </Canvas>

      {/* UI overlays — rendered outside Canvas as regular DOM */}
      <LoadingScreen />
      <Instructions locked={locked} />
      {locked && <Crosshair />}
      {locked && <FloorIndicator playerY={playerY} />}
    </div>
  );
}
