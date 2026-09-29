import '../styles/overlay.css';

export default function Instructions({ locked, touch, onStart }) {
  return (
    <div
      className={`instructions${locked ? ' hidden' : ''}${touch ? ' tappable' : ''}`}
      onPointerDown={touch ? onStart : undefined}
    >
      <div className="instructions-box">
        <h2>Recorrido Virtual</h2>
        {touch ? (
          <>
            <p>Pulgar izquierdo — caminar</p>
            <p>Arrastra a la derecha — mirar</p>
            <p>Botón CORRER — ir más rápido</p>
            <p className="instructions-cta">Toca para comenzar</p>
          </>
        ) : (
          <>
            <p>WASD / flechas — caminar</p>
            <p>Shift — correr</p>
            <p>Mouse — mirar</p>
            <p>ESC — salir del recorrido</p>
            <p className="instructions-cta">Click para comenzar</p>
          </>
        )}
      </div>
    </div>
  );
}
