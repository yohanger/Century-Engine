# LF-WATER-RUNTIME-S00-G001 · Editor/Play/Runtime Visibility Recovery

**Gate autorizado:** `Listo. LF-WATER-RUNTIME-S00-G001-EDITOR-PLAY-RUNTIME-VISIBILITY-RECOVERY autoriza comenzar`.

**SOURCE_BASELINE padre:** `LF_PERFORMANCE_S17_G003_CORR003_TRIANGHOR_SPATIAL_AND_REAL_COMPLEXITY_DIAGNOSTICS_SOURCE_BASELINE.zip` (3.665 archivos). El trabajo partió de una copia íntegra, comprobada byte a byte contra el ZIP.

**Estado:** IMPLEMENTADO EN FUENTES · TEST NODE PASS focal · COMPILACIÓN VITE/ELECTRON NO VERIFICADA · QA LOCAL/PLAYER NO VERIFICADO · APROBACIÓN PENDIENTE · NO CERRADO.

## Autoridad y contradicciones

Los contratos `LF-WATER-LIQUID-CA-001..004`, en particular `CA-002` §8, prevalecen. `WaterWorld`, `TerrainWaterConnection`, `WaterSurfaceView` y el nodo Water existente conservan sus responsabilidades. No se creó un segundo volumen, renderer, shader ni material de agua. Las regiones secas **no deben** inventar agua: un lago asociado a una región con `initialDepth: 0` se oculta correctamente si la región está seca. Es un caso de configuración y QA, no una excusa para falsificar masa ni volumen.

La corrección no incluye el Gate independiente de Shader Complexity / `GL_INVALID_VALUE`, ni altera su código.

## Diagnóstico OBSERVADO

1. `showPhysicalWater()` ocultaba primero las mallas de agua autorales y creaba después `WaterSurfaceView`. Si esta construcción fallaba, podía dejar un lago invisible.
2. `hidePhysicalWater()` restauraba el booleano `visible` guardado al inicio de la sustitución, que podía ser un estado transitorio obsoleto, en vez de la propiedad de autoría actual; también dejaba `uPhysicalCount`/firmas de preview sin limpiar en algunos recorridos.
3. La firma de `refreshPhysicalWaterPreview()` no incluía asociación, visibilidad, posición ni parentesco de los nodos Agua. Un cambio de asociación podía mantener una vista vieja; además se requería otro frame para restaurar la edición tras Stop.
4. `WaterSurfaceView` no liberaba su grupo si el constructor fallaba a mitad de `update()`; una construcción parcial de material podía retener geometría.
5. En `_setupScene` el orden de uniformes y montaje físico era sensible: aplicar los límites antes de sustituir la vista previa podía dejar uniformes obsoletos. **No se acredita una causa raíz única en la escena real**, porque no se recibió el proyecto `.lfproj` en este Gate.

## Cambios implementados

| Archivo | Corrección |
|---|---|
| `src/engine/runtime/scene/water.js` | Construcción de la nueva superficie antes de ocultar el nodo de autoría; restauración con `nodeActive/visible` vigente; invalidación de firma al desmontar, redibujado; firma de preview incluye transformaciones, asociación y ancestros; errores recuperables |
| `src/engine/runtime/geometry/water-surface.js` | Liberación de grupo, geometría y material cuando falla la construcción o actualización inicial |
| `src/engine/runtime/events/play.js` | Orden: montar superficie física antes de publicar sus límites de shader; recuperación de vista previa de Edit inmediatamente después de `session.end()` |
| `scripts/test-water-runtime-visibility-s00-g001.mjs` | 14 pruebas nuevas, escenarios normal/físico/dry, error de montaje, cambios autorales y en padre, Play/Runtime compartido, fuga de recursos |

No se modifican nodos o archivos originales de proyectos experimentales. El flujo Play y Player conserva el mismo código de renderización y WaterWorld, con distinto host. La simulación física sigue siendo *opt-in*.

## Comandos y resultados

| Prueba | Resultado |
|---|---|
| `node --test scripts/test-water-runtime-visibility-s00-g001.mjs` | **14/14 PASS** |
| Node sobre 10 suites de Agua/LIQUID y este Gate | **202/203 PASS, 1 FAIL preexistente** |
| `node --test scripts/test-water-s03.mjs` en SOURCE_BASELINE original | Reproduce exactamente el fallo W23/W24/W25: `src/engine/runtime/player/fps/water.js` inexistente; no es una regresión nueva |
| Node sobre ocho suites adyacentes de escena, Play, Runtime y editor | 126/132 PASS, seis fallos históricos |
| Las mismas suites históricas con el SOURCE_BASELINE original | 44/50 PASS, **los mismos seis fallos** (fixtures antiguos de cambio de escena, físicas y snap) |
| `node --check` sobre todos los JS modificados | PASS |
| `npm run build` | BLOQUEADO: `vite: not found`, no hay `node_modules` |
| QA gráfico Electron y Player exportado | **NO VERIFICADO** |

Archivos de salida Node en `docs/qa/evidence/LF_WATER_RUNTIME_S00_G001/`.

## QA LOCAL obligatorio antes de aprobación

1. `npm install`, `npm run build`, `npm run electron` en el equipo local y registrar errores de consola.
2. Lago ordinario (`waterSimulation.enabled=false`) visible en Edit, Play y Player exportado. Probar Ocean, Lago, Estanque y Río; verificar color, olas y materiales.
3. Lago asociado a una región física **con agua** (`initialDepth > 0`): misma superficie física única en Edit/Play, sin duplicaciones; al detener, Edit vuelve a mostrar su representación de autoría/preview efectiva.
4. Región física **seca** (`initialDepth=0`): verificar que no aparece agua inventada y que al salir de Play no queda ningún nodo oculto por error. Identificar explícitamente este caso si ocurre en la escena aportada.
5. Desactivar simulación, cambiar `physicalRegionId`, mover un nodo Agua o su padre y alternar `visible` antes y después de Play; verificar reaparición y que los padres invisibles continúen invisibles.
6. Probar entradas/salidas repetidas, errores de configuración o de material y cambios de escena sin pérdidas de recursos ni mallas originales ocultas.
7. Comprobar Runtime/Player exportado y guardar/cargar una escena; registrar capturas, stdout y datos de reproducción.

**Límite de evidencia:** Las pruebas Node verifican contratos y escenarios de ciclo de vida mediante los métodos reales con dependencias gráficas simuladas; no sustituyen la compilación Three.js/WebGL2 o una prueba real del proyecto del usuario. El defecto reportado podría tener una causa adicional si no corresponde a asociación física o a las transiciones estudiadas.

**Cierre:** PENDIENTE de compilación, QA local, aprobación y ledger de cierre.
