# Prompt: Recorrido 3D inmersivo de casa (Astro + React Three Fiber)

Copia y pega esto directo en Claude Code (idealmente en un repo/carpeta vacía, o menciona que ya tienes Astro instalado si es el caso).

---

## PROMPT

Quiero que desarrolles un sitio web de recorrido 3D inmersivo en primera persona de una casa, construida a partir de un modelo `.glb` que yo voy a proveer (modelado en Blender a partir de planos arquitectónicos, a escala real en metros).

### Paso 0 — Analiza primero la carpeta `resources/`

Antes de tocar código, revisa la carpeta `resources/` en la raíz del proyecto. Ahí encontrarás:
- Uno o más **PDF con los planos arquitectónicos** de la casa (plantas de cada piso, posiblemente con medidas acotadas).
- Una **imagen de referencia** de cómo se ve la casa (fachada/render).

Con esa información necesito que:
1. Extraigas y me resumas la distribución de cada piso que identifiques en los planos: cantidad de ambientes, ubicación aproximada de la escalera, puertas y ventanas, y las medidas si están acotadas en el PDF.
2. Estimes las dimensiones reales de la casa (ancho, largo, altura de entrepiso) a partir de las medidas del plano, ya que esto define la escala real que debe tener el modelo `.glb` y por lo tanto valores clave del código: altura de la cámara (~1.6m), umbral de altura Y para `FloorIndicator`, y el punto de spawn exterior.
3. Uses la imagen de referencia para orientarte sobre el estilo/materiales de la fachada (esto es solo para tu contexto de diseño del overlay de UI y textos, no vas a generar el modelo 3D — ese lo hago yo en Blender).
4. Si el PDF trae múltiples plantas (piso 1, piso 2), identifica cuál es cuál y en qué orden aparecen en el archivo.
5. Si algo en los planos es ambiguo (medidas ilegibles, escalera no clara, orientación no evidente), pregúntame en vez de asumir — estos valores después definen física real (colisiones, altura de escalón) y un error aquí rompe el auto-step de la escalera.

Documenta ese análisis en un archivo `resources/ANALISIS.md` antes de continuar con el desarrollo, para que quede como referencia mientras construyes los componentes.

### Objetivo de la experiencia

El usuario debe poder:
1. Iniciar la experiencia desde el exterior de la casa (fachada/jardín)
2. Caminar en primera persona (WASD + mouse) hacia la entrada
3. Recorrer libremente el interior del primer piso
4. Subir por una escalera real al segundo piso (con física de colisión que resuelva el escalón automáticamente, no teletransporte)
5. Recorrer libremente el segundo piso
6. No poder atravesar paredes, muebles ni el piso

### Stack técnico obligatorio

- **Astro** como framework base — el sitio es prácticamente una sola página, todo el contenido es la experiencia 3D, no uses Tailwind ni ningún framework de CSS, usa CSS plano o CSS Modules solo para el overlay de UI.
- **React** como único island, montado con `client:only="react"` (nunca `client:load`, para evitar que Three.js intente ejecutar en SSR).
- **@react-three/fiber** como renderer de Three.js.
- **@react-three/drei** para helpers: `useGLTF`, `PointerLockControls`, `Environment`, `Preload`, `Stats` (solo en dev).
- **@react-three/rapier** para física — necesito un character controller tipo cápsula con "auto-step" para que suba escalones de la escalera sin necesidad de saltar, y colisión sólida contra el mesh de la casa completa (usa `<RigidBody type="fixed"> <TrimeshCollider />` o `<CuboidCollider />` según convenga por objeto).
- **Draco compression** ya aplicada al `.glb` (asumo que yo lo entrego optimizado, pero valida el tamaño y avísame si conviene usar `meshopt` en su lugar).

### Estructura de carpetas esperada

```
/
├── resources/
│   ├── planos.pdf                  ← ya provisto por mí, analiza primero (ver Paso 0)
│   ├── fachada.jpg                 ← ya provisto por mí
│   └── ANALISIS.md                 ← generado por ti tras el análisis
├── public/
│   └── models/
│       └── casa.glb
├── src/
│   ├── pages/
│   │   └── index.astro
│   ├── components/
│   │   ├── HouseTour.jsx          ← contenedor principal del Canvas + Physics
│   │   ├── Scene.jsx               ← carga del modelo .glb y luces
│   │   ├── PlayerController.jsx    ← cápsula física + PointerLockControls + movimiento WASD
│   │   ├── LoadingScreen.jsx       ← overlay mientras carga el .glb (con % de progreso)
│   │   ├── Crosshair.jsx           ← punto central en pantalla
│   │   ├── Instructions.jsx        ← overlay "Click para entrar / WASD para moverte"
│   │   └── FloorIndicator.jsx      ← indicador de piso actual (1° o 2°), detectado por altura Y de la cámara
│   └── styles/
│       └── overlay.css
└── astro.config.mjs
```

### Requisitos por componente

**`HouseTour.jsx`**
Componente raíz. Monta el `<Canvas>` de R3F a pantalla completa (`position: fixed, inset: 0`), envuelve la escena en `<Physics>` de rapier, maneja el estado global mínimo (cargando / cargado / pointer lock activo), y renderiza los overlays de UI condicionalmente encima del canvas.

**`Scene.jsx`**
Carga `casa.glb` con `useGLTF` (con `suspense`), recorre los meshes del modelo para separar los que deben tener colisión sólida (paredes, pisos, techos, escalera) de los puramente decorativos si aplica, y configura iluminación — usa `<Environment>` con un preset de interior o HDRI si te lo proveo, más una luz direccional suave simulando luz de ventana. Asegúrate de que las sombras estén activadas pero optimizadas (`shadow-mapSize` razonable, no por defecto en 4K).

**`PlayerController.jsx`**
Cápsula de rapier (`RigidBody` tipo dinámico, con `lockRotations`) que representa al jugador. Cámara de Three.js anclada a la posición de la cápsula, a altura de "ojos" (~1.6m si el modelo está a escala real). Movimiento con WASD relativo a hacia donde mira la cámara (no world-space fijo), velocidad de caminata razonable (~1.4 m/s equivalente), y salto opcional deshabilitado (no es necesario para este recorrido, solo caminar). Implementa el auto-step para escalones usando el character controller de rapier (`world.createCharacterController` con `setMaxSlopeClimbAngle` y `enableAutostep`).

**`LoadingScreen.jsx`**
Mientras el `.glb` carga, muestra un overlay con barra o porcentaje de progreso (usa el progreso real de `useProgress` de drei, no un mock), fondo oscuro, y transición suave de fade-out cuando termina.

**`Instructions.jsx`**
Overlay inicial con instrucciones claras antes de entrar en pointer lock: "Click para comenzar el recorrido", "WASD para moverte, mouse para mirar, ESC para salir". Desaparece al hacer click y activarse el pointer lock; debe reaparecer si el usuario sale del pointer lock (ESC).

**`FloorIndicator.jsx`**
Pequeño indicador fijo en una esquina (ej. "Primer piso" / "Segundo piso") que cambia según la altura Y de la cámara, comparado contra un umbral que definiremos según la altura real del entrepiso en el modelo.

**`index.astro`**
Página única, `<body style="margin:0; overflow:hidden; background:#000;">`, monta `<HouseTour client:only="react" />`. Meta tags básicos (título, descripción, viewport) pero sin contenido adicional — toda la experiencia vive en el componente React.

### Consideraciones de performance

- Usa `frustumCulled` (default de Three.js, no lo desactives sin razón).
- Si el `.glb` es pesado, implementa carga progresiva o al menos un loader que no bloquee el hilo principal.
- Limita el `pixelRatio` del Canvas a un máximo razonable (ej. `Math.min(window.devicePixelRatio, 2)`) para no matar el rendimiento en pantallas retina/4K.
- No renderices sombras de objetos fuera del frustum si el modelo es grande.

### Lo que necesito que hagas ahora

1. Analiza la carpeta `resources/` como se describe en el Paso 0, y genera `resources/ANALISIS.md`.
2. Inicializa el proyecto Astro (o adáptalo si ya existe un `astro.config.mjs` en el repo — revísalo primero).
3. Instala todas las dependencias del stack mencionado.
4. Crea la estructura de componentes completa descrita arriba, con código funcional (no placeholders vacíos) usando un modelo `.glb` de prueba/cubo temporal si aún no te he entregado `casa.glb`, para que el movimiento y la física ya se puedan probar — usa las dimensiones estimadas del Paso 0 para que el cubo de prueba tenga una escala realista.
5. Deja comentado en el código dónde exactamente debo ajustar: altura del entrepiso para `FloorIndicator`, nombres de los meshes de colisión sólida si mi export de Blender usa nombres distintos a los de ejemplo, y la posición inicial de la cámara (spawn point exterior).
6. Al terminar, dime cómo correr el proyecto en local y qué debo verificar primero (colisiones, escalera, pointer lock).

Pregúntame antes de asumir nombres específicos de objetos dentro del `.glb` si no te los he dado — no inventes convenciones que luego no coincidan con mi archivo real.
