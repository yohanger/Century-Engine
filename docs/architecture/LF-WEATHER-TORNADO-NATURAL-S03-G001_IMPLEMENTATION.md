# LF-WEATHER-TORNADO-NATURAL-S03-G001 — Superficie, polvo y visibilidad

**Estado:** IMPLEMENTADO · 146/146 Node PASS (10 suites) · ELECTRON/BUILD/QA VISUAL NO VERIFICADOS · NO CERRADO.

**Autorización previa exacta:** `Listo. LF-WEATHER-TORNADO-NATURAL-S03-G001 autoriza comenzar`. La implementación estuvo condicionada a QA de S02. El usuario posteriormente confirmó oclusión correcta en escena y funcionamiento del Player independiente; ambas se registran como **QA LOCAL PASS DECLARADO POR USUARIO**, sin inventar capturas ni métricas de export.

**Baseline:** `LevelForge_WEATHER_TORNADO_NATURAL_S02_G001_CORR_002_SOURCE_BASELINE.zip` (1.330 archivos). El pulido superior/cromático del tornado queda pospuesto por decisión del usuario.

## Observado antes de cambiar código

- `NatureFX` ya concentra los efectos ambientales en Editor/Player. Es creado por `SceneGraph`, y `Viewport` lo actualiza cuando hay clima en Play.
- `VfxSimulation` permite `spawnAt`, `flowAt` y `emissionEnabled`. `VfxBillboardRenderer` ya aporta quads suaves con test de profundidad y exclusión del G-buffer GTAO; no se justifica otro renderer.
- `Terrain.paintAt()` y `Terrain.layers[].surface` permiten conocer la capa dominante; el Inspector posee el modo `Auto` mediante `surfaceFromPaintName()` (también utilizado por sonidos de pasos).
- `WaterWorld.at()` devuelve nivel superficial. Las regiones hidrológicas aportan `moistureAt(col,row)`; `NatureFX` ya calcula humedad ambiental global como respaldo.
- `World.windAt3D` y `World.precipitationAt` son las autoridades existentes; PrecipFX y Fog conservan sus rutas. S03 no cambia World, WaterWorld, PrecipFX, Sky ni Jolt.

## Integración realizada

1. `world/tornado-surface.js`: consulta pura del suelo. Requiere presencia real de terreno y clasificación `dirt`, `sand` o `gravel` mediante `surface` o el fallback **Auto existente**. Ninguna nube, agua, roca, hierba, nieve, madera o material desconocido emite polvo. Agua física por encima del suelo, saturación, lluvia y nieve reducen o impiden emisión.
2. `world/nature.js`: extiende **NatureFX existente** con un único efecto transitorio de polvo. Construye `VfxSimulation` + `VfxBillboardRenderer` de 96 instancias máximo *solo al necesitarlos*. La definición se crea **en memoria**, usando el validador VFX; no se guarda en Assets ni añade el campo tornado a `.vfx`. `flowAt()` toma `World.windAt3D`, y el ritmo de emisión depende de `World.tornado.intensity`, no de la condensación visual. El color consume el color auténtico de la capa dominante (sin asignar materiales nuevos).
3. `scene-graph.js`: inyecta las consultas **ya existentes** `terrains`, `WaterWorld.at`, humedad por `WaterRegion.moistureAt` y cámara al NatureFX original. Sirve tanto para Editor como Player, sin árbol paralelo.
4. Play/Stop: al detener Play, la simulación limpia las partículas, libera el renderer temporal y elimina su mesh de la escena. Durante debilitamiento la emisión se reduce y las partículas aún vivas desaparecen por edad. El renderer tiene `depthTest` y `depthWrite=false` y `lfExcludeFromAO` por infraestructura previa. Esto no demuestra la oclusión del propio Sky.
5. **Visibilidad:** PrecipFX, niebla y el shader volumétrico conservan su acoplamiento con el clima. La precipitación disminuye la visibilidad del polvo en `visualOpacity` y condiciona la emisión; no se ha añadido una segunda ruta de niebla ni alterado las fuerzas físicas.

## Límites y decisiones

- Materiales sin clasificación reconocida permanecen sin emisión: no se infiere polvo de una textura arbitraria. Las capas con `Auto` reconocidas por el Inspector sí funcionan. Ej.: `Tierra`, `Arena` y `Grava`.
- No hay escombros físicos nuevos, despegue de árboles nuevo, acoplamiento nuevo con agua ni simulación CFD. No se usa VFX3D como representación del embudo.
- Se limita a terreno con capa pintada, no se produce emisión desde primitivas por simple cercanía; eso requeriría un material de superficie con contrato y consulta demostrada.
- Las partículas de polvo son transitorias. Su estado visual no se incorpora al guardado de partida; la física World y su persistencia permanecen intactas. Queda pendiente evaluar si la reproducibilidad exacta de partículas a mitad de una carga es un requisito futuro, no simularla como PASS.
- **No hay `node_modules` en este entorno**; fixture Electron y builds Vite **NO VERIFICADOS** aquí. La ejecución de Player exportado y la oclusión de S02 fueron confirmadas por el usuario, pero no sustituyen QA de S03.

## Evidencia

- `scripts/test-weather-tornado-natural-s03-g001.mjs`: 21 casos nuevos PASS.
- Regresión de 10 suites: **146/146 Node PASS**; 0 FAIL.
- `scripts/fixtures/weather/tornado-natural-s03.html` + `scripts/test-weather-tornado-natural-electron-s03-g001.mjs`: fixture con el motor VFX real que comprueba píxeles, emisión, agua, materiales, disposición del renderer y Stop. **NO EJECUTADA** aquí; requiere Electron del usuario.
- `npm run build`, render integrado Editor/Player, perfil Compatibility, frame time CPU/GPU, screenshots locales de polvo: **NO VERIFICADOS**.

## Estado de S02 y dependencias

S02 CORR-002 recibió 11/11 Node, 1/1 Electron (36 checks), TN2 16/16 Node, 1/1 Electron (25 checks), builds Editor/Player PASS y aprobación visual del usuario para retirar el rectángulo. El usuario confirmó oclusión correcta y Player independiente funcional. El pulido del color y tramo superior **PENDIENTE PLANIFICADO PARA EL FINAL** y no modifica S03.

**Regresión VFX adicional limitada:** se intentaron cinco archivos de test, con 35 casos PASS y dos módulos de prueba que no pudieron importarse por ausencia de `jszip` en este entorno (`test-vfx-player-s02-g002.mjs` y `test-vfx-resource-s01-g001.mjs`). La regresión VFX global queda pendiente de repetición con dependencias instaladas; no atribuirle PASS general.
