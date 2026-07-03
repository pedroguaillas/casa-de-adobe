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
- Escalera: tramo recto en X, arranque x=-2.3, 16 escalones, ancho 1.2 m, z∈[-1.1, 0.1].
- Hueco de losa piso 2 sobre la escalera: x∈[-1.2, 2.4], z∈[-1.2, 0.2]
  (dimensionado para altura de cabeza desde el escalón 4) + baranda en 3 lados.
- Niveles: piso 1 en y=0.2, piso 2 en y=3.0, cielo raso alto en y=5.4.
- Frente de la casa = +Z. Spawn del jugador en el sendero: [0, 0.95, 10.5].
- **Física escalera**: el autostep de rapier se atasca en escalones reales; se usa
  un `CuboidCollider` invisible en rampa (32°) alineado con las narices de los
  escalones. OJO: meshes con `visible={false}` NO generan collider automático.
- Cápsula del jugador 1.80 m total (vanos de puerta 2.1 m; una cápsula de 2.1 m
  quedaba atascada exactamente en el dintel).
- Debug de colliders: `http://localhost:4321/?debug` (solo dev).

---

## Dimensiones reales estimadas

| Dato | Valor | Origen |
|------|-------|--------|
| Ancho total (eje X) | **9.95 m** | Cota acotada en planta baja (ejes 1–4) |
| Profundidad total (eje Z) | **~7.50 m** | Cota lateral visible en planta baja |
| Altura entrepiso (piso 1→2) | **2.80 m** | Sección longitudinal: cota +2.80 |
| Altura alero (eje Y tope muro) | **5.16 m** | Sección longitudinal: cota +5.16 |
| Cumbrera (eje Y cima techo) | **6.16 m** | Sección longitudinal: cota +6.16 |
| Grosor de muros | **~0.20 m** | Lectura escala en planta |

---

## Planta Baja (+0.00)

Ambientes (de izquierda a derecha, fondo a frente):

| Ambiente | Posición aprox. |
|----------|----------------|
| EXTRA | Izquierda fondo |
| SERVICIO | Centro fondo |
| COMEDOR | Derecha fondo |
| COCINA | Centro medio |
| ESTUDIO | Izquierda medio |
| VESTÍBULO | Centro frente (hall entrada) |
| SALA | Derecha frente |
| BAÑO | Izquierda frente |

**Escalera:** ubicada en zona centro-izquierda (entre COCINA y ESTUDIO), sube en dirección longitudinal (eje Z / profundidad). Descanso en la cima que conecta con PASILLO planta alta.

**Entrada principal:** fachada frontal (Z positivo), al centro-derecha. Puerta en VESTÍBULO.

---

## Planta Alta (+2.80)

| Ambiente | Posición aprox. |
|----------|----------------|
| DORMITORIO 2 | Izquierda |
| DORMITORIO 1 | Centro |
| BAÑO | Centro-izquierda |
| VESTIDOR | Derecha fondo |
| DORMITORIO MASTER | Derecha |
| PASILLO | Centro (circulación) |
| BALCÓN | Frente centro (sobre VESTÍBULO) |

---

## Valores clave para el código

```js
// Dimensiones reales (metros)
HOUSE_WIDTH  = 9.95   // eje X
HOUSE_DEPTH  = 7.50   // eje Z
FLOOR_HEIGHT = 2.80   // Y: cota piso 2

// Cámara / jugador
CAPSULE_HALF_H = 0.60  // Cápsula rapier half-height (total 1.80m — despeja vanos de 2.1m)
CAPSULE_RADIUS = 0.30  // Cápsula rapier radius
EYE_OFFSET     = 0.75  // Delta Y desde centro cápsula → ojos (~1.65m sobre piso)

// Indicador de piso — umbral altura Y cápsula
FLOOR_2_THRESHOLD = 2.50  // Y > 2.50 → segundo piso

// Spawn exterior (sendero frente a la casa)
SPAWN_POSITION = [0, 0.95, 10.5]

// Escalera (placeholder — ajustar con nombres de mesh del .glb real)
STAIR_STEPS    = 16
STAIR_RISE     = 0.175  // 2.80 / 16
STAIR_RUN      = 0.28   // profundidad por escalón
STAIR_WIDTH    = 2.0    // ancho libre escalera
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
