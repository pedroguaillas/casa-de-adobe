# ANALISIS — Casa de Adobe

Fuente: `CASA DE ADOVE 1.pdf`, `CASA DE ADOVE 2.pdf`, `CASA DE ADOVE 3.pdf`, `casa.jpeg`,
renders 3D `WhatsApp Image 2026-07-03 *.jpeg` (11 imágenes)  
Escala planos: 1:50

---

## Renders 3D (julio 2026) — información nueva

Los renders aportan mucho más detalle que los PDF: cortes cenitales amueblados de
ambos pisos + fachadas desde todos los ángulos.

### Exterior (fachadas)
- **Techos**: dos aguas tipo *shed* desfasadas en altura (no dos aguas clásico),
  con banda de clerestorio entre ambas. Teja color salmón/terracota.
- **Chimenea de piedra**: columna vertical a la derecha de la entrada, sobresale
  del techo. Piedra natural irregular.
- **Celosía de ladrillo** (patrón damero perforado): muro lateral derecho, planta baja.
- **Porche de entrada**: losa de concreto, postes de madera, puffs morados,
  macetas con plantas. Pérgola de madera arriba.
- **Balcón** sobre el porche: piso de teja terracota, baranda de madera,
  pérgola de listones de madera al nivel del techo.
- **Carpintería**: puertas y ventanales de perfil metálico negro con vidrio
  (entrada = doble puerta vidriada; la escalera se ve desde afuera).
- **Banda horizontal de madera** entre pisos en todo el perímetro.
- **Zócalo de piedra** en la base de la planta baja.

### Planta baja (corte cenital amueblado)
- **Sala de juegos / estudio** (izquierda): mesa de billar (paño verde) + piano negro.
- **Cocina** (fondo-derecha): muebles bajos con frentes **rojos**, mesón de madera,
  isla central, refrigerador.
- **Comedor** (derecha-centro): mesa de madera + 4 sillas.
- **Sala** (frente-derecha): sofá claro + mesa de centro.
- **Baño** (frente-izquierda): volumen con muros de **piedra**.
- **Escalera**: al centro de la planta, tramo recto de madera, visible desde la entrada.

### Planta alta (corte cenital amueblado)
- **3 dormitorios**: master (frente-derecha), dormitorio 2 (frente-izquierda),
  dormitorio 1 (fondo-izquierda). Camas con estructura de madera clara.
- **Baño compartido** (fondo-centro): tina, inodoro, lavamanos.
- **Vestidor + baño master** (fondo-derecha): armarios de madera.
- **Pasillo** central alrededor del hueco de la escalera, con baranda.
- **Balcón** al frente-centro, acceso por pasillo entre ambos dormitorios frontales.

### Decisiones aplicadas al placeholder procedural (`Scene.jsx`)
Las cotas del plano (lámina 1, plantas 1:50) y los cortes (lámina 2) mandan sobre
los renders. Distribución de renders (billar, piano, cocina roja) se conserva solo
como mobiliario dentro del ambiente correcto del plano.
- Frente de la casa = +Z (eje A). Spawn en el sendero: [0.15, 0.95, 10.5].
- **Física escalera**: rampa invisible (`CuboidCollider`) de 38° sobre las narices
  de los escalones; autostep de rapier se atasca en contrahuellas reales.
  OJO: meshes con `visible={false}` NO generan collider automático.
- **Portal**: rampa invisible de 14° + escalón de piedra en el borde frontal; la
  cápsula toca un borde de 0.16–0.20 m a >45° y el autostep no lo sube.
- Cápsula del jugador 1.80 m total (puertas 2.05 m, cielo PB libre 2.20 m).
- Debug de colliders: `http://localhost:4321/?debug` (solo dev).
- Hook de pruebas (solo dev): `window.__tour.{teleport, look, press, force}`.

---

## Sistema de ejes (planta 1:50)

| Eje | Coordenada | Nota |
|-----|-----------|------|
| 1 · 2 · 3 · 4 (X) | -4.875 · -1.625 · +1.625 · +4.875 | crujías de 3.25 m |
| C · B · A (Z) | -3.40 · 0 · +3.40 | crujías de 3.40 m, A = fachada frontal |
| Muros | 0.20 m centrados en eje | caras interiores ±4.775 / ±3.30 / ±1.525 / ±1.725 |

## Dimensiones reales

| Dato | Valor | Origen |
|------|-------|--------|
| Ancho total (X) | **9.95 m** | Cota planta baja (ejes 1–4) |
| Profundidad total (Z) | **7.00 m** | 0.20+3.20+0.20+3.20+0.20 (el 7.90 incluye el saliente del baño) |
| NPT planta baja | **+0.20** | Plantas y cortes |
| Bajo losa / cielo PB | **+2.40** | Cortes (libre 2.20 m) |
| NPT planta alta | **+2.60** | Cortes (la planta indica +2.65) |
| Cielo PA (viga) | **+4.90** | Cortes (libre 2.30 m) |
| Tope de muro / alero | **+5.10** | Cortes |
| Cumbrera lateral / linterna | **+5.75 / +6.04** | Cortes, cubierta 4.09 · 3.05 · 4.09 × 8.40 |

## Escalera
- 13 contrahuellas 0.185 (plano: 0.18 × 0.25), huella 0.235, ancho libre **1.00 m**.
- Tramo recto en crujía central x ∈ [-1.525, +1.525], z ∈ [0.82, 1.82].
- **Sube hacia -X**: paso 1 junto al eje 3 (lado sala), llega al pasillo PA junto al eje 2.
- Pendiente 38° → `setMaxSlopeClimbAngle(45°)`.
- Hueco losa PA: x ∈ [-1.525, 1.525], z ∈ [0.82, 1.86]; baranda en el lado del hall.

---

## Planta Baja (+0.20)

| Ambiente | X | Z |
|----------|---|---|
| EXTRA | -4.78 → -1.73 | -3.30 → -0.10 |
| ESTUDIO | -4.78 → -1.73 | +0.10 → +3.30 (vano 1.00 a extra, puerta al vestíbulo) |
| BAÑO | -2.94 → -1.73 | +2.95 → +4.21 (volumen de piedra, sobresale 0.90 al portal) |
| SERVICIO | -1.53 → +1.53 | -3.30 → -2.00 (celosía en fachada posterior, puerta a comedor) |
| COCINA | -1.53 → +1.53 | -1.82 → +0.62 (dos mesones 0.60 + pasillo 1.20) |
| VESTÍBULO | -1.53 → +1.53 | +1.82 → +3.30 |
| COMEDOR | +1.73 → +4.78 | -3.30 → -0.10 |
| SALA | +1.73 → +4.78 | +0.10 → +3.30 (abierta al vestíbulo) |
| PORTAL | -3.14 → +2.63 | +3.50 → +5.40, postes en x = ±1.625 |
| Chimenea | +1.53 → +2.63 | +3.30 → +4.41 |

Entrada: frente vidriado 2.90 m, x ∈ [-1.375, +1.525], corrediza x ∈ [-0.6, 0.9].
Ventanas laterales: 2 × 2.00 m por piso y lado (z ≈ [-2.75,-0.75] y [0.75,2.75]).

## Planta Alta (+2.60)

| Ambiente | X | Z |
|----------|---|---|
| DORMITORIO 2 | -4.78 → -1.73 | -3.30 → -0.10 |
| BAÑO 2 | -4.78 → -3.13 | +0.10 → +3.30 |
| PASILLO | -2.93 → -1.73 | +0.10 → +3.30 |
| DORMITORIO 1 | -1.53 → +1.53 | -3.30 → +0.62 (puerta desde pasillo por eje 2) |
| HALL (frente al hueco) | -1.53 → +1.53 | +1.86 → +3.30 |
| BAÑO (suite) | +1.73 → +3.03 | -3.30 → -1.31 |
| VESTIDOR | +1.73 → +4.78 | -3.30 → -0.10 |
| MASTER | +1.73 → +4.78 | +0.10 → +3.30 (puerta desde hall por eje 3) |
| BALCÓN | -3.14 → +1.53 | +3.50 → +4.41 (0.90 m) |

---

## Valores clave para el código

```js
HOUSE_WIDTH  = 9.95   // eje X
HOUSE_DEPTH  = 7.00   // eje Z
F1 = 0.20; C1 = 2.40; F2 = 2.60; C2 = 4.90; WT = 5.10

CAPSULE_HALF_H = 0.60  // total 1.80 m
CAPSULE_RADIUS = 0.30
EYE_OFFSET     = 0.75  // ojos ~1.65 m sobre piso

FLOOR_2_THRESHOLD = 2.30  // centro cápsula: PB ≈ 1.10, PA ≈ 3.50
SPAWN_POSITION = [0.15, 0.95, 10.5]

STAIR_STEPS = 13
STAIR_RISE  = 0.185
STAIR_RUN   = 0.235
STAIR_WIDTH = 1.00
```

---

## Estilo / materiales (referencia UI)

Casa de dos pisos, estilo tropical-rústico:
- Muros: adobe/ladrillo visto color arena/ocre
- Base primer piso: piedra natural
- Estructura: madera oscura (columnas, alero, pasamanos balcón)
- Techo: teja de barro
- Vegetación tropical alrededor
- Paleta: #C8A96E (adobe), #7D5A3C (madera), #6B8C42 (vegetación), #F5ECD7 (interior)

---

## Notas para Blender / export GLB

- Exportar con ejes Y-up, Z-forward para que coincida con Three.js
- Separar meshes de colisión sólida (paredes, pisos, escalera) con sufijo `_col` o layer separado
- Aplicar Draco compression al exportar desde Blender glTF
- Meshes recomendados para `TrimeshCollider`: casa completa o por piso
- Verificar escala: 1 unidad Blender = 1 metro
