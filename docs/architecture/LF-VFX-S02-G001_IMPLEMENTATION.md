# LF-VFX-S02-G001 — Simulación CPU y billboards instanciados

**Fuente:** `LevelForge_VFX_S01_G002_SOURCE_BASELINE.zip` (1006 archivos; ZIP CRC íntegro). **Autoridad:** `docs/architecture/LF-VFX-S00-G001_CONTRACT.md`, `LF-VFX-S00-G001_SPRINTS.md` y declaración específica `LF-VFX-S02-G001` autorizada por el usuario. La aprobación documental S00 y la integración S01 fueron ratificadas posteriormente por el usuario. Esta implementación no modifica sus contratos ni autoriza G002.

## Módulos y responsabilidades

- `src/engine/runtime/vfx/simulation.js`: `VfxSimulation` CPU independiente del host gráfico. Recurso v1 validado al crear, pool tipado fijo y límite máximo de 1024, RNG xorshift32 con semilla de instancia, emisión continua/ráfaga, nacimiento punto/caja/esfera, vida, velocidad/aceleración, curvas lineales, color interpolado en espacio lineal, sincronización por pasos fijos de 1/60 s. En actualización normal ejecuta como máximo seis pasos; contabiliza segundos y nacimientos descartados. `step()` permite un avance discreto mientras la reproducción esté detenida. `reset()` restablece toda la secuencia. No crea Jolt, nodos o timers.
- `src/engine/runtime/vfx/render.js`: `VfxBillboardRenderer`, un `THREE.Mesh` con `InstancedBufferGeometry` y `ShaderMaterial` y atributos dinámicos de posición/tamaño/opacidad/color/rotación. Billboard orientado a cámara en espacio de vista, para proyecciones ortográfica y perspectiva. Alpha: depthTest activo, depthWrite desactivado y ordenación de lejos a cerca **dentro de un emisor**; aditivo: `AdditiveBlending`. Soporta textura proporcionada por el propietario Assets y silueta procedural suave si no se ha seleccionado textura. Una referencia de textura sin objeto cargado falla explícitamente. `dispose()` libera solo geometría/material/mesh, nunca el recurso textural compartido.

El render externo usa el renderer, escena y ciclo de actualización **existentes** al integrarse en G002. Para `movement.space === 'local'`, la malla debe insertarse bajo el transform del emisor; para `world`, bajo la escena y con transform identidad. `VfxSimulation.update(dt, matrixWorld)` recibe el transform real al emitir en modo mundo. Las partículas previas no siguen al emisor en modo mundo. Este Gate no conecta SceneGraph, NodeRegistry, ciclo RAF, Player ni editor VFX: ese cableado pertenece a `LF-VFX-S02-G002`.

## Restricciones verificadas y limitaciones

1. La configuración canónica sigue siendo `project.vfx`/`.vfx`; los arrays temporales no se serializan. No se modifica `resource.js` ni el formato de proyecto.
2. Texturas y transformaciones son responsabilidad del integrador G002; cada renderer no toma propiedad de una textura compartida. Sin valor `textureId`, se usa fallback; con referencia ausente, se lanza error.
3. El límite **global** de 4096 partículas por escena permanece PENDIENTE PLANIFICADO para G002; G001 limita únicamente cada emisor. No se inventa un gestor global anticipado.
4. Alpha ordena partículas de un mismo emisor; no garantiza orden correcto entre emisores o elementos de vidrio, soft-particles ni física volumétrica. Las caras del quad mantienen tamaño de vista frente a escalado no uniforme; G002 debe verificar esa decisión en escenas parentadas.
5. El campo `duration > 0` con emisión continua y `loop: false` detiene nuevas partículas; en ráfaga con `loop: true` repite tras cada duración mayor que cero. `duration: 0` representa emisión continua ilimitada o una ráfaga única. La simulación descarta tiempo excedente para prevenir espirales.
6. El shader aplica chunks oficiales de tonemapping/colorSpace de Three.js 0.186.1; necesita prueba real con el renderer concreto del Editor, incluyendo PSX, durante la integración G002. No emite luces ni proyecta sombras.

## QA y medios incluidos

- `scripts/test-vfx-simulation-s02-g001.mjs`: 13 tests `node:test` ejecutados **PASS**.
- `scripts/fixtures/vfx/webgl.html` y `scripts/test-vfx-webgl-s02-g001.mjs`: harness de Chromium + Vite que ejecuta **los módulos reales** y renderiza 96×96 píxeles en WebGL. Compara muestras renderizadas en cámara perspectiva/ortográfica, profundidad, textura DataTexture, fallback, un draw call por emisor, mezcla alpha/aditiva y propiedad de textura. El harness no añade un segundo renderer al editor ni modifica el juego.
- La regresión general adicional `test-project-safe.mjs` y `test-resource-history-corr-g001.mjs` pasó **27/27**; total nuevo ejecutado **40/40 PASS**. El harness WebGL y build **NO VERIFICADOS** en el entorno de entrega: falta instalación de dependencias. Su ejecución local es requisito de QA del usuario; ver `docs/qa/LF-VFX-S02-G001_QA.md`.

**Estado:** IMPLEMENTADO; TEST AUTOMATIZADO DE SIMULACIÓN PASS; WEBGL NO VERIFICADO; COMPILACIÓN NO VERIFICADA; QA LOCAL PENDIENTE; APROBADO/CERRADO NO. El único Gate siguiente propuesto es `LF-VFX-S02-G002`, no autorizado por esta entrega.
