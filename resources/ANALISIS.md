# ANALISIS — Casa de Adobe

Fuente: `CASA DE ADOVE 1.pdf`, `CASA DE ADOVE 2.pdf`, `CASA DE ADOVE 3.pdf`, `casa.jpeg`  
Escala planos: 1:50

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
CAPSULE_HALF_H = 0.70  // Cápsula rapier half-height
CAPSULE_RADIUS = 0.35  // Cápsula rapier radius
EYE_OFFSET     = 0.60  // Delta Y desde centro cápsula → ojos (~1.65m sobre piso)

// Indicador de piso — umbral altura Y cápsula
FLOOR_2_THRESHOLD = 2.50  // Y > 2.50 → segundo piso

// Spawn exterior (frente de la casa, jardín)
SPAWN_POSITION = [0, 1.05, 8.0]  // Centro-frente, ojo a 1.65m, 0.5m fuera de fachada

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
