# LF-TIMELINE-ADVANCED-DIRECTION-S09-G001-INTEGRAL — Evidencia y QA

Fecha: 2026-11-05  
Gate: AUTORIZADO, **NO CERRADO**  
SOURCE_BASELINE de entrada: `LF_TIMELINE_VISUAL_PREVIEW_S08_G001_CORR001_SOURCE_BASELINE.zip`.

## Auditoría del código original

**Observado**

- `TimelinePanel.vue` ya contenía `tl.duration`, claves temporales, Snap y continuidad visual entre claves de cámara/nodos; no existían clips persistentes para los tramos.
- `core/timeline/model.js` normaliza claves, pistas, interpolación y duración.
- `core/timeline/preview.js` utiliza `evalNode`/`evalCamera`; aplica poses de Editor y las restaura; excluye audio, commands y methods.
- `Viewport.overlay` es la infraestructura existente para ayudas visuales de Editor.
- `core/state/tree.js` y `engine/runtime/scene/matrix.js` calculan matrices mundiales, con escala heredada solo en Node3D.
- `engine/runtime/events/cmd-world.js` define `weather`; `EXEC.weather` llama al `World` real.
- `World.strike` y `WeatherAudio.thunder` ejecutan los sistemas existentes de relámpago y trueno; en Play, el listener de `lightning` programa el trueno según distancia/343.
- `TimelineRunner` despacha las claves `commands` en Play/Player, pero no durante `seek` ni en previsualización de edición.

**Causa técnica confirmada:** no había asas para ajustar duración; tampoco overlay seleccionada con flechas ni acción para capturar cámara, ni acciones específicas para separar relámpago y trueno en el catálogo de comandos.

## Implementación realizada

1. Duración total editable por asa y teclado, con límite inferior determinado por los contenidos reales. Se preservan IDs, claves y bake. El zoom no cambia la duración.
2. Extremo de tramo (cámara/nodo) arrastrable; modifica exclusivamente el tiempo de la clave siguiente, manteniendo valor e interpolación y sin cruzar otras claves. Undo/Redo usa `commit` original al soltar.
3. Trayectoria seleccionada de posición en `TimelinePreview`, con `evalNode` real, transformación animada de padres, puntos, líneas y flechas. Overlay en Editor, sin persistencia; limpieza de geometrías propias al cerrar, ocultar o cambiar selección. No liberar geometrías compartidas de `THREE.ArrowHelper`.
4. «Capturar posición de cámara» toma `vp.persp` en espacio mundial, la transforma al espacio local del padre y crea/actualiza una clave; no modifica directamente el nodo, ni rota la cámara, ni usa raycast.
5. Menú de pistas: lluvia, intensidad, detener lluvia, relámpago sin trueno automático y trueno independiente. Son claves de la **pista original `commands`**, con definiciones declarativas del editor de eventos; sin JavaScript almacenado.
6. `World.strike(..., withThunder = true)` conserva el comportamiento existente por defecto. La opción explícita false suprime el trueno automático de esa descarga; la nueva orden de trueno reutiliza `WeatherAudio.thunder`.
7. En Edit, las claves de naturaleza aparecen en la Timeline, pero **no ejecutan audio ni comandos durante scrubbing**.

## Bloqueo contractual/técnico de preview ambiental

S08 mantiene la prohibición de despachar comandos/audio en el Editor. S09 exige restauración del estado ambiental completo al detener el preview. `World.setWeather` muta también el director y estados transitorios; en el baseline no existe una operación demostrada que garantice revertir exactamente los estados anteriores sin alterar la sesión.

**Estado:** preview meteorológico visual/sonoro en Edit **BLOQUEADO, NO IMPLEMENTADO**; requiere Contract Amendment específico y un mecanismo reversible probado. El disparo en **Play/Player** está implementado en fuentes y queda pendiente de QA local. No se simulan efectos meteorológicos para hacer pasar la prueba.

**Nota de alcance:** la acción «Cambiar intensidad de lluvia» usa el comando `weather` existente con parámetro `seconds`, que permite transición gradual en el runtime. Un rayo de naturaleza excluye trueno automático para permitir un sonido posterior en otra clave; las descargas meteorológicas normales conservan el trueno automático.

## Evidencia automatizada

- `scripts/test-timeline-advanced-direction-s09-g001-integral.mjs`: **12 PASS, 0 FAIL** en el entorno de desarrollo. Incluye retiming, continuidad, propiedades preservadas, conversión mundo/local simulada, catálogo real, comandos meteorológicos, protección del rayo habitual y overlay con objetos Three simulados.
- Regresión ampliada y suites de meteorología: consultar resultados adjuntos a la entrega. Las suites que necesitan `vite` o `jszip` **no arrancan** sin dependencias; no contarlas como PASS.
- `node --check` de los módulos JavaScript modificados: PASS.
- Vue/Vite y Electron: **NO VERIFICADOS** en este entorno (`node_modules` ausente).
- QA WebGL real, lluvia/rayo/trueno auditivos, guardado `.lfproj` y Player: **NO VERIFICADOS**.

## Pruebas locales obligatorias del usuario

Desde la **raíz del proyecto LevelForge existente, que contiene `package.json`** y ya tiene aplicado S08 CORR-001, después de comparar y respaldar los archivos de CHANGE:

```bash
node --test scripts/test-timeline-advanced-direction-s09-g001-integral.mjs
npm run build
npm run electron
```

Si el proyecto local parte de otro baseline, **no aplicar CHANGE a ciegas**. Conservarlo y utilizar el SOURCE_BASELINE completo en una carpeta independiente para las pruebas, sin sobreescribir los cambios locales ni los proyectos del usuario.

**A. Duración.** Dos claves de posición a 0 y 2 s; seleccionar pista, mover el extremo a 4 s. Comprobar Snap, clave final a 4 s, curva intacta y Undo/Redo. Intentar recortar duración total antes de última clave: debe bloquearse sin borrarla. Arrastrar el marcador final cuando el cabezal coincide con él.

**B. Trayectoria.** Con dos o más claves, seleccionar pista de Posición; verificar línea, puntos y flechas en viewport, ajustar una curva y confirmar su geometría. Probar también nodo con padre trasladado/rotado y padre animado. Ocultar Timeline y comprobar que el overlay desaparece sin contaminar Play.

**C. Cámara.** Mover cámara del editor, seleccionar la pista de Posición y elegir en menú contextual «Capturar posición de cámara». Verificar posición mundial equivalente aun con padre transformado y que no se modifica la rotación del nodo ni la escena fuera de la previsualización.

**D. Naturaleza.** Crear un Timeline con comandos: lluvia a 0 s, intensidad a 2 s, relámpago a 4 s, trueno a 5 s, detener lluvia a 9 s. Abrir Editor de Eventos para modificar parámetros. En **Play/Player**, verificar efectos y audio con el sistema meteorológico de escena correctamente configurado. Verificar que un relámpago de naturaleza no emite además otro trueno automático, y que los rayos normales siguen emitiéndolo.

**E. Persistencia/regresión.** Guardar/reabrir `.lfproj`, verificar IDs/tiempos/claves/comandos. Comprobar Timeline S07/S08, Jerarquía, Inspector y Assets. Validar preview de poses al mover cabezal sin despachar efectos de naturaleza durante scrubbing.

**Evidencia solicitada:** salida completa de tests Node y `npm run build`; captura/video de duración y trayectorias; captura de clave capturada desde cámara; grabación corta de Play con lluvia/relámpago/trueno; confirmación de persistencia.

## Estados

- IMPLEMENTADO EN FUENTES: cuatro áreas, con bloqueo específico de preview ambiental Edit.
- TEST AUTOMATIZADO PASS: solo suites efectivamente ejecutadas que pasaron.
- COMPILADO: NO VERIFICADO.
- QA LOCAL PASS: PENDIENTE.
- APROBADO: PENDIENTE.
- CERRADO: NO.

FilmMaker y Cinematics permanecen pausados; no se modificaron sus componentes.

## Inventario frente al SOURCE_BASELINE S08 CORR-001

**Nuevos (2):**

- `docs/qa/LF-TIMELINE-ADVANCED-DIRECTION-S09-G001-INTEGRAL_QA.md`
- `scripts/test-timeline-advanced-direction-s09-g001-integral.mjs`

**Modificados (9):**

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-timeline-visual-preview-s08-g001-integral.mjs` (harness adaptado a la selección usada por la nueva vista, sin suprimir aserciones)
- `src/components/TimelinePanel.vue`
- `src/core/timeline/model.js`
- `src/core/timeline/preview.js`
- `src/engine/runtime/events/cmd-world.js`
- `src/engine/runtime/events/exec-commands.js`
- `src/engine/runtime/events/play.js`
- `src/engine/runtime/world/world.js`

**Eliminados:** ninguno. **Cambios inesperados:** ninguno. No se modificaron FilmMaker, Cinematics, runtime TimelineRunner ni archivos del Player.
