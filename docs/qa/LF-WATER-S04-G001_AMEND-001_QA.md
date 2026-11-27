# LevelForge — LF-WATER-S04-G001 + AMEND-001

Estado: IMPLEMENTACIÓN EN FUENTE; compilación y QA WebGL/Player pendientes de usuario.
Fecha: 2026-10-25. Baseline de entrada: `LevelForge_WATER_S03_G001_CORR-001_SOURCE_BASELINE.zip` (703 ficheros).

## Contrato de arquitectura

- WaterWorld mantiene el único estado de agua; Three.js, el material PBR/PSX, salpicaduras y efectos sólo representan ese estado.
- El modo físico continúa optativo por escena. Ninguna migración destructiva afecta lagos, ríos o guardados antiguos.
- Perfilador (instrumentación de tiempos) y QA (pruebas y aceptación) son responsabilidades separadas. No se crea servicio de profiling ni se ejecuta QA dentro del runtime.
- No se incluyen SPH, FLIP, volumetría 3D, acumulación sobre superficies arbitrarias o cáusticas/raytracing externos.

## Implementación W27–W35

- **W27**: `WaterRegion.snapshot()/validateSnapshot()/restoreValidated()` y `WaterWorld.snapshot()/restore()` versión 1, con validación previa y restauración atómica multi-región. Se preservan dimensiones, posición, métricas de celda, topografía/validez, profundidad, momento, aportes pendientes y balance. El snapshot es JSON-serializable.
- **W28**: `captureWorld()` guarda estado de agua y `restoreWorld()` lo restaura tras montar escena y antes de reanudar. Partidas sin el campo `water` mantienen inicialización heredada. Rejillas/topografías incompatibles se rechazan con error, sin restauración parcial del agua.
- **W29**: `filmJump()` vuelve al estado inicial del agua y reconstruye clima y solver con pasos alternados de 1/60 s, refrescando la superficie. **Limitación:** replay desde t=0; coste proporcional a la duración, sin checkpoints del clima. Saltos extensos pueden ser lentos. No afirmar acceso aleatorio instantáneo.
- **W30**: cuando una escena activa agua física, la evolución de World avanza dentro del paso fijo justo antes de WaterWorld; el estado visual se aplica una vez al final. Sin agua física se conserva la ruta anterior de actualización por frame.
- **W31**: reutilización de buffers del solver (flujos, balance temporal, pendientes y limítrofes); las regiones completamente secas sin lluvia no ejecutan el transporte.
- **W32**: la vista de agua deja de regenerar buffers si su `revision` no cambió tras un paso físico; el renderer recibe corrientes X/Z reales y profundidad en cada vértice. Las ondas visuales de lluvia se enlazan al contacto real con agua del mismo WaterWorld, con limitador de frecuencia; no generan volumen adicional. Se libera referencia del WaterWorld al salir del juego.
- **W33**: QA Node ejecutado. **Editor, Player, exportado y render WebGL: NO VERIFICADOS** por falta de dependencias locales (`vite: not found`, `three` no instalado).
- **W34**: API heredada `WaterWorld.at()` conservada; sin agua física, shaders y charcos procedurales continúan en modo legado. Para modo físico, el agua PBR/PSX utiliza datos de región única.
- **W35**: evidencias, benchmarks orientativos y ledger en seis hojas. No se ha medido un equipo Intel N5030 real.

## AMEND-001 — Credibilidad perceptual

- Lluvia: reutiliza gotas del GPU, raycasts acotados sobre primitivas y superficies (CORR-001); los impactos sobre agua activa provocan anillos usando `waterripple.js`, sin cuerpos Jolt por gota ni duplicación de masa.
- Flujo: geometría `water-surface.js` ahora alimenta `rtAFlow` por celda desde `qx/depth` y `qz/depth`; shader simulado arrastra las microondas según esa velocidad en lugar de utilizar flujo nulo.
- Profundidad: el shader simulado utiliza profundidad física y evita sobreescribirla con el mapa de agua heredado. El modo PSX aprovecha `rtFaceted` existente; no introduce otro shader de fluidos.
- Las gotas ya eran representadas como partículas GPU muestreadas en CORR-001. Este cambio no convierte todas las gotas en partículas físicas 3D, ni crea charcos sobre mallas que no sean Terrain.
- **No es fotorrealismo ni hidrodinámica 3D**. Aceptación perceptual PSX y PBR queda pendiente de pruebas visuales reales.

## QA automatizado

Comandos:

```bash
node --test scripts/test-water-s04.mjs
node --test scripts/test-water-s01.mjs scripts/test-water-s02.mjs scripts/test-water-s03.mjs scripts/test-water-s03-corr001.mjs
node --test scripts/test-*.mjs
npm run build
npm run electron
```

El comando global `test-*.mjs` exige tener `three` instalado: `test-starcat.mjs` falla por `ERR_MODULE_NOT_FOUND` sin dependencias, por lo que se informa por separado. Los 9 SKIP de otras suites también se conservan para QA con dependencias.

## QA visual del usuario — pruebas mínimas

- [ ] Guardar con charco y flujo, cargar misma escena, comparar profundidad, volumen, movimiento, posición y aspecto.
- [ ] Cargar partida vieja sin `water` y comprobar ausencia de error.
- [ ] Rechazar snapshot incompatible sin corrupción ni escritura sobre otra escena.
- [ ] Film Maker: avanzar, retroceder, repetir desde t=0; comprobar clima y charcos con el mismo estado. Registrar latencia en saltos largos.
- [ ] PSX: lluvia sobre cubo, techumbre y charco. Impactos correctamente localizados; perturbaciones reconocibles sin ruido visual exagerado.
- [ ] PBR: mismo escenario. Las microondas siguen la dirección de la corriente y la absorción visual depende de profundidad.
- [ ] Cambios de Terrain, celdas sin fondo y extremos de región: ningún charco flotante.
- [ ] Edit Mode: vista previa sin avance físico. Play: agua avanza. Salir/entrar 10 veces sin recursos residuales.
- [ ] Build Editor + Player y exportado; consola sin errores GLSL/Three.js.
- [ ] En Pentium Silver N5030, UHD 605, RAM 4 GB: medir ms por paso y FPS (lluvia 100 %, 32×32, 64×64), con y sin agua física, con PSX/PBR.

## Estado de riesgos abiertos

1. Film Maker: replay O(t) sin checkpoints completos de World; saltos de horas potencialmente costosos.
2. El solver sigue modelando aguas someras. Superficies complejas, cascadas y recipientes arbitrarios NO están simulados.
3. No hay compilación ni capturas de imagen WebGL desde el entorno de entrega. Las mejoras ópticas deben aceptarse mediante QA visual.
4. Guardados con topografía distinta se rechazan explícitamente; no existe algoritmo de remapeo automático para cambios de resolución.
5. El reloj fijo en escenas con WaterWorld puede mover el momento de actualización de clima respecto al de escenas heredadas: comprobar eventos meteorológicos en juego.

No presentar estos riesgos como PASS visual ni como cierre incondicional del programa WATER.

### Resultado verificado en el entorno de entrega

- 13 pruebas nuevas específicas de S04: **13 PASS, 0 FAIL**.
- Suites Node disponibles (sin `test-starcat.mjs`, que requiere instalar Three.js): **770 PASS, 0 FAIL, 9 SKIP**.
- Al incluir `test-starcat.mjs` sin dependencias, esa suite no arranca con `ERR_MODULE_NOT_FOUND`; no se declara PASS.
- `npm run build`: **NO VERIFICADO** (`vite: not found`).
- QA real PSX/PBR y exportación del Player: **NO VERIFICADOS**.
