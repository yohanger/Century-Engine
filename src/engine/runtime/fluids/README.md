# Módulo de fluidos

`FluidRegion` es el núcleo de simulación independiente del editor, Three.js y Jolt.
`geometry/water-solver.js` conserva `WaterRegion` como adaptador compatible y añade
las funciones de recipientes y escurrimiento que utiliza `WaterWorld`.

- `liquid.js`: perfiles de densidad y viscosidad; agua como perfil predeterminado.
- `shallow-water.js`: volúmenes finitos HLL con reconstrucción hidrostática,
  positividad, reloj CFL, fondo, máscaras de caras, perturbaciones, snapshots y balances.
- `solids.js`: intersección vertical de colliders orientados; cuadratura 4×4 sobre
  cada intersección horizontal, recortada contra fondo y lámina de agua.
- `index.js`: API pública. Unidades: metros, segundos, m³, kg/m³ y m/s.

El método hidrostático sigue la base del solver existente; referencia:
[Audusse et al., 2004](https://publications.imp.fu-berlin.de/478/).
Las paredes usan una presión independiente en cada lado para mantener agua en
reposo sobre fondos distintos, sin flujo de masa ni transferencia entre sectores.

El host posee el reloj y los dominios: `TerrainWaterConnection` muestrea terreno y
barreras; `WaterWorld` conserva inventarios, consultas y transferencias. Play y el
renderer leen ese estado. No hay un segundo solver de agua o un reloj por nodo.
Las rutas antiguas de importación conservan perfiles y adaptadores existentes.

La aproximación de `FluidRegion` es 2.5D, no SPH/FLIP. La ocupación no introduce masa; no resuelve
cavidades, presión 3D ni el flujo por debajo de sólidos completamente sumergidos.
Los sólidos superpuestos suman ocupación equivalente con límite en la lámina
local; no hay unión geométrica exacta de múltiples colliders. Las barreras estáticas
bloquean caras enteras; no representan aún vertederos de altura finita.
Los dominios nativos tienen margen acotado y conservan bordes cerrados. No se
extienden automáticamente sin límite ni unen dos lagos que lleguen a tocarse.

Verificación: `npm run test:suite -- fluids`. Incluye dinámica wet/dry, conservación,
reposo a ambos lados de paredes, cuerpos orientados y raycasts con Jolt WASM real.


## Recipientes y mar

- `container-mpm.js`: port CPU de los kernels MLS-MPM de Splash. Gravedad, APIC,
  presión, paredes, movimiento del marco, cuello, tapa y salida de partículas.
- `container-world.js`: recepción por boca barrida, integración de gotas, colisión,
  depósito en regiones físicas, derrames transitorios y contabilidad de límites.
- `container-shape.js` / `container-props.js`: forma interior, capacidad y presets.
- `container-view.js`: MarchingCubes de las partículas e instancias de gotas.
- `spectral-water.js`: FFT de Ultra Water, costa, PBR, ciclo de recursos GPU y
  lectura asíncrona de la función compartida para natación/flotación del mar.
- `ocean-grid.js`: malla polar adaptada de Ultra Water.
- `vendor/SOURCES.json`: revisiones y procedencia. Ambas bibliotecas son MIT.

El nodo `fluidcontainer3d` vive en Utilería. CPU mantiene compatibilidad con WebGL:
no se exige WebGPU. Máximo 8 envases activos, 256/512/1024 partículas por envase.
La reconstrucción visual y la presión son aproximaciones a esta resolución;
no son un interior de malla arbitraria ni ejercen fuerzas de reacción en Jolt.
El mar es una condición exterior espectral; las regiones siguen siendo finitas.
Se comparte un espectro de viento por escena. Las consultas GPU tienen retardo,
48² muestras y 24–96 m de alcance alrededor de la cámara; fuera, nivel medio.

El snapshot v8 incluye los estados de partículas, volumen libre en tránsito y
configuraciones de charcos temporales; se valida completamente antes del commit.
`npm run test:suite -- fluid-integration` prueba nodo, Inspector, GPU, Play/Stop,
vertido, conservación y guardado con Electron real (Vite → Electron).
