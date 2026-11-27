# LF-EDITOR-UX-S01-G004 — Cámara y navegación del Editor

**Autorización exacta:** `Listo. LF-EDITOR-UX-S01-G004 autoriza comenzar` (2026-10-25).  
**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_UX_S01_G003_CORR_001_SOURCE_BASELINE.zip` (739 archivos), Three.js **0.186.1**.  
**Objetivo:** corregir el enfoque y el pivote de órbita, preservar la cámara de autoría al regresar de Play y disponer de acciones diferenciadas de cámara, nodo y Player Spawn, inspiradas en las operaciones del viewport de Unreal. **No** se incorpora arquitectura de Unreal.  
**Estado técnico:** implementado y probado por regresión Node. **Compilación Editor/Player y QA WebGL pendientes en Linux**; no declarar aceptado sin inspección local.

## Contrato e implementación

1. **Órbita seleccionada:** preferencia personal `orbitSelection` activada por defecto; `Viewport` obtiene el centro de uno o varios objetos seleccionados mediante callback del Editor, **no depende del Store ni de selección en Player**. Se prepara el pivote al empezar a girar con el botón central o Alt+izquierdo, o durante el gesto de órbita de trackpad. Seleccionar un objeto por sí solo no desplaza la cámara. Sin selección conserva el objetivo libre de OrbitControls. El usuario puede desactivar este comportamiento en la barra o en Ver.
2. **Enfocar selección (F):** calcula unión de los volúmenes seleccionados. `frameBox` preserva la dirección actual de cámara tanto en perspectiva como ortográfica; utiliza campo de visión vertical/horizontal para calcular una distancia legible. No cambia el ángulo a un vector fijo.
3. **Restauración exacta tras Play:** `saveEditorView` almacena cámara perspectiva y ortográfica, pose de ambas, zoom, objetivo de OrbitControls, `currentView`, semialtura ortográfica y límites polares **antes** de forzar perspectiva; `restoreEditorView` reinstala cámara activa, suscriptores (gizmos), proyección, objetivo y estado de vista. El Player sigue usando su cámara independiente; el runtime del juego no recibe estado de selección.
4. **Acciones separadas:** «Mover cámara al nodo» cambia solo el visor; «Alinear nodo con la vista» modifica solo el nodo seleccionado, con conversión mundo→local y Undo/Redo; «Colocar Spawn desde la vista» utiliza altura de ojos de Database cuando existe y sitúa pies sobre el terreno si hay una superficie próxima; orienta el Spawn horizontalmente en mundo antes de convertir a local. «Jugar desde aquí» (Shift+F5) continúa siendo temporal.
5. **Pilotaje:** una Camera seleccionada puede pilotarse. El visor sigue su pose, los movimientos y cambios de orientación se transfieren al nodo durante la sesión, también con vuelo WASD; al detener, se libera el listener y se registra una única entrada de Undo/Redo. Se detiene al cambiar de selección/escena, entrar a Play o destruir el Editor. La órbita por selección se suspende mientras pilota para evitar retroalimentación.
6. **UI:** la barra Scene del visor añade activación de órbita seleccionada y menú compacto «Cámara…»; el registro de comandos existente alimenta los menús Ver y la paleta de acciones. No se altera la jerarquía del proyecto ni el Player exportado.

## Archivos afectados

- `src/engine/runtime/render/viewport.js`: snapshot/restauración y enganche de órbita en pointerdown.
- `src/engine/runtime/render/viewport-nav.js`: órbita por selección, orientación conservada al enfocar.
- `src/core/editor/selection.js`: centro/volumen de selección simple y múltiple; detención de pilotaje por cambio de selección.
- `src/core/editor/play-session.js`: captura de vista antes del cambio a perspectiva; restauración completa al detener.
- `src/core/editor/camera-tools.js` (**nuevo**): acciones de cámara, Spawn y pilotaje, una sola autoridad de transformación.
- `src/core/editor.js`: mixin, callback de selección de órbita, ciclo de vida del pilotaje.
- `src/core/editor/keys.js`: preferencia persistente de órbita.
- `src/core/state/state.js`: preferencia `orbitSelection` con default `true`, retrocompatible.
- `src/core/commands.js`: acciones vinculadas a los menús originales, sin registro duplicado.
- `src/components/ViewBar.vue`: acciones accesibles en la barra del viewport.
- `scripts/test-editor-ux-s01-g004.mjs` (**nuevo**): suite de regresión con comprobaciones de comportamiento y contrato.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas actualizadas.

## QA automatizado

- `node --test scripts/test-editor-ux-s01-g004.mjs`: **16 PASS**; incluye ejecución real de captura/restauración mediante los métodos fuente, sesión Play emulada y órbita por selección, más controles de integración y permisos.
- `node --test scripts/test-*.mjs` con exclusión de `test-starcat.mjs` (requiere Three.js npm): regresión global documentada en el registro de esta entrega.
- `node --check` para los JavaScript afectados: **PASS**.
- `npm run build`: **NO VERIFICADO**, este entorno no tiene `node_modules` (`vite: not found`). No inferir fallo de compilación.

## QA manual — Linux, CPU y GPU reales

- [ ] Perspectiva: seleccionar nodo A; orbitar con botón central y Alt+izquierdo. Repetir desde otra posición. La vista rota alrededor de A; seleccionar A no mueve el visor por sí solo.
- [ ] Selección múltiple: Shift/Ctrl sobre tres objetos distantes y F. El conjunto queda encuadrado, con la dirección de vista anterior, sin saltar a un ángulo fijo.
- [ ] Deseleccionar: órbita libre sigue disponible sin objeto. Cambiar preferencia Orbitar selección OFF/ON y repetir con mouse y trackpad.
- [ ] Órbita y enfoque en vistas ortográficas top/front/back, ejes numéricos y perspectiva; sin alteraciones del control de pan y rueda de zoom.
- [ ] Desde vista ortográfica con zoom no unitario: entrar a Play F5, cambiar cámaras y escena dentro del juego, detener. Verificar orientación, proyección ortográfica, posición, zoom y objetivo idénticos.
- [ ] Desde vista perspectiva: mismo ciclo anterior. No se pierde el FOV ni se cambia el objetivo de navegación.
- [ ] «Mover cámara al nodo» NO cambia objeto ni registra historial. «Alinear nodo con vista» SÍ modifica objeto y se revierte con un Ctrl+Z.
- [ ] Alinear un nodo Camera hijo de grupo rotado y luego Spawn en otro grupo. Comprobar conversión mundo/local y orientación correcta.
- [ ] Spawn: activar «Colocar Spawn desde la vista» y verificar que la base de la cápsula queda en el terreno y no a la altura de los ojos. Probar terreno vacío (no forzar Y=0 si no existe terreno).
- [ ] Shift+F5 inicia juego desde posición del visor **sin escribir en Spawn**. Detener devuelve cámara inicial.
- [ ] Pilotar Camera seleccionada: mover con navegación normal, cambiar orientación y usar vuelo WASD; el nodo acompaña al visor. Al terminar, Ctrl+Z deshace la sesión como una sola operación.
- [ ] Cambiar selección o escena mientras se pilota y entrar en Play; sin listeners fantasma, cámara retenida ni gizmos en Play.
- [ ] Verificar FPS, Player exportado, consola WebGL y demás sistemas de G001–G003 (WATER, luces, Selection, Outline, Lensflare).

## Restricciones y riesgos explícitos

- La transición inicial hacia el centro de la selección al **comenzar** la órbita puede ajustar la orientación si se estaba mirando lejos del objeto. No se produce ningún movimiento de cámara al seleccionar sin orbitar.
- El botón de pilotaje solo admite nodos **Camera**; no pilota cualquier objeto genérico. «Mover cámara» y «Alinear nodo» sí pueden operar sobre otros tipos elegibles.
- Para Spawn, `Database.player.eyeHeight` utiliza valor de respaldo de 1,65 m y ajusta suelo solo si hay terreno; **no ejecuta la física completa de Jolt** en modo edición. Se debe validar terreno/pies en QA local.
- Vista y zoom son estado transitorio del Editor, no una nueva propiedad de proyecto ni una función del Player. No se cambian `Jolt`, `Three.js` ni los pipelines de luz/cielo ni se generan listeners globales adicionales.

**Criterio de cierre:** compilación Editor/Player y QA local satisfactoria, aprobación expresa del usuario y ledger registrado como aprobado. Actualmente: entregado para QA local.
