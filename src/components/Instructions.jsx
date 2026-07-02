import '../styles/overlay.css';

export default function Instructions({ locked }) {
  return (
    <div className={`instructions${locked ? ' hidden' : ''}`}>
      <div className="instructions-box">
        <h2>Recorrido Virtual</h2>
        <p>WASD / flechas — caminar</p>
        <p>Mouse — mirar</p>
        <p>ESC — salir del recorrido</p>
        <p className="instructions-cta">Click para comenzar</p>
      </div>
    </div>
  );
}
