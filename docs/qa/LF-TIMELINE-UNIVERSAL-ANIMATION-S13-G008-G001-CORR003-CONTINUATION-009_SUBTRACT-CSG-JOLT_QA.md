# LevelForge · CORR-003 · Continuación 009 — Subtract / CSG–Jolt

**Fecha:** 2026-11-11. **Gate vigente:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`, autorizado previamente. **Amendment:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-002` ratificado. Esta es una continuación del MISMO Gate, no una autorización nueva.

**SOURCE_BASELINE de entrada suministrado por el usuario:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_008_NAVIGATION_STEP_SOURCE_BASELINE(1).zip`. Verificado con prueba CRC (`unzip -tq`); 3.107 archivos. No se fusionan fuentes procedentes de otros proyectos, sesiones ni ramas.

**Estado al entregar:** IMPLEMENTADO EN FUENTES (PARCIAL) · NODE TEST AUTOMATIZADO PASS · COMPILACIÓN/QA ELECTRON/JOLT WASM/PLAYER NO VERIFICADOS · CORR-003 ABIERTO.

## 1. Diagnóstico: OBSERVADO / INFERENCIA / CAUSA RAÍZ

**OBSERVADO** en código del baseline 008:

- `nodes/subtract.js` define el Volumen `box | cylinder | stairs`, render del gizmo y escala, pero no registraba `subtract.kind` como canal animable.
- `scene/brushes.js` reconstruye el BSP a partir de `project.objects` y `worldMatrix()` autoral, mediante `carveGeometries()` de `geometry/csg.js`; las transformaciones que Timeline aplica a los nodos Three.js no provocaban esa reconstrucción.
- `events/play.js` ejecuta `ed.refreshBrushes()` al montar la escena **antes** de construir las formas Jolt. En ejecución, una malla receptora puede ser origen de `TriMeshShape3D` en un `StaticBody3D`; Jolt conserva una Shape nativa después de la reconstrucción inicial.
- `NodeBodyRuntime` ya tiene la autoridad de cuerpos físicos declarados y `JoltWorld.bi.SetShape` se usa para animación de `CollisionShape3D`. `TimelinePreview` comparte SceneGraph pero no actualizaba el CSG tras mover el brush.

**INFERENCIA**: una llave visual sola da hueco sin colisión correcta; añadir cuerpos Jolt para cada cambio destruiría la identidad de contactos/raycast. Un CSG por fotograma puede resultar costoso en PC de bajo rendimiento, especialmente con muchos receptores, y exige QA de FPS real.

**CAUSA RAÍZ:** desacople entre la muestra temporal de Subtract/descendientes, la reconstrucción BSP de receptores y la Shape física persistida del propietario existente.

## 2. Implementado en propietarios originales

| Archivo | Cambio |
|---|---|
| `src/engine/runtime/nodes/subtract.js` | Registra `subtract.kind` como `enum` y expone `read`, `apply`, `capture`, `restore` y `runtimeRead` sin escribir en `obj.kind`. El mismo `refreshShape()` actualiza la visualización del brush y libera su geometría temporal de escalera; no toca TransformControls ni crea otro visor. |
| `src/components/Inspector.vue` | Una llave `PropertyKey` en la misma fila de **Volumen**, vinculada a la propiedad real del nodo. |
| `src/engine/runtime/scene/brushes.js` | Extiende `refreshBrushes({timeline:true})` para utilizar matrices reales y escala de cortadores/receptores animados, clase de forma efectiva y actividad temporal de la jerarquía. Recalcula solo cambios de firma y devuelve IDs receptores afectados. Preparación de nuevas geometrías BSP antes de liberar la anterior; formas temporales de escalera liberadas tras su uso. Fuera de Timeline conserva la vía autoral original. |
| `src/engine/runtime/physics/node-bodies.js` | `syncCarvedSources(ids)` localiza el `StaticBody3D` **existente** con `TriMeshShape3D` apuntando al receptor modificado; valida elegibilidad y conserva BodyID. Construye Shapes temporales con el ensamblador físico original y prepara **todas** las Shapes antes del primer `BodyInterface.SetShape`, liberando referencias propias. Si un receptor está bajo un cuerpo con BoxShape3D u otro esquema físico no vinculado, lanza error en vez de aparentar colisión. No crea cuerpos, managers, cachés paralelas ni una nueva física. |
| `src/engine/runtime/events/play-timeline.js` | `_tlSyncBrushes()` reutiliza el reloj PlayMode existente. Detecta pistas activas del cortador, receptor y ancestros (incluidos desplazamientos). Firma cuantizada evita recálculos con la misma pose; después de CSG actualiza la Shape física del mismo cuerpo. Al detener se restaura la vista autoral; si falla Jolt, informa y bloquea reintentos repetidos en esa sesión. |
| `src/engine/runtime/events/play-controls.js` | Invoca la sincronización después del evaluador temporal y antes de los consumidores y el paso Jolt; sin un segundo loop. |
| `src/core/timeline/preview.js` | Editor Preview sincroniza los cortes del mismo SceneGraph cuando se animan brush, receptores o padres; STOP restaura la geometría editorial. El estado CSG no depende de MotionPath. |
| `src/engine/runtime/events/play-level.js` | Cleanup defensivo al desmontar PlayMode: elimina override temporal de Subtract y regenera el CSG autoral. |
| `scripts/test-timeline-node-method-track-s04-g003.mjs` | Ajuste del harness heredado de Node que evalúa el módulo vía `data:`: sustituye el nuevo import `getDef` con un stub. No modifica ni elimina las aserciones anteriores. |

**Frontera física:** la sustitución nativa solo se propone para **colisionadores declarados** `StaticBody3D` + `TriMeshShape3D` de su malla receptora. Un receptor visual fuera de un cuerpo explícito continúa siendo solo gráfico; un `BoxShape3D` ajeno al recorte no se convierte de manera automática en un agujero físico. No se fabrica BodyID si falta uno. Transiciones que eliminan todos los triángulos o generan geometría Jolt inválida deben fallar de forma explícita.

**Limitación de recuperación:** toda construcción de Shapes se valida antes de aplicar la primera, pero una excepción nativa inesperada **durante** el segundo `SetShape` todavía exige comprobar en Jolt WASM real que el rollback visual y la restauración física funcionan. No se certifica atomicidad de bajo nivel sin esa evidencia.

## 3. QA automatizado (ejecutado)

- Nueva suite `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont009-subtract.mjs`: **21/21 PASS**. Incluye descriptor, persistencia, validación enum, snapshots, refresh de gizmo, CSG por transformaciones efectivas, firma de no duplicación, STOP editorial, Jolt mismo BodyID, preflight de múltiples Shapes, rechazo de BoxShape incompatible, ancestros y receptores, errores y preservación de MotionPath.
- Regresión seleccionada de 20 archivos: **284/284 PASS, 0 FAIL, 0 SKIP**. Abarca Navigation 008, Terrain 007, Model/Water 006, colisiones 005, física, Camera/Timeline, métodos, audio y UX.
- `node --check` de JS modificados: **PASS**.
- Se intentó `npm ci --offline`: `ENOTCACHED` por `zip-stream`. Intento de `npm ci` en línea finalizó por timeout sin dependencias completas. **`npm run build` no se certifica**, pues Vite no está disponible. No modificar `package-lock.json` ni incluir `node_modules` en el ZIP.
- Las pruebas de CSG usan matrices/geometrías simuladas; las pruebas de forma Jolt usan dobles de `BodyInterface`. **No son prueba de Three.js real, Jolt WASM ni GPU**.

## 4. QA local del usuario

A partir de SOURCE_BASELINE 008, comparar y respaldar archivos afectados antes de aplicar CHANGE. No fusionar otras ramas ni sobrescribir cambios locales sin diff. En carpeta raíz con `package.json`:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont009-subtract.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont008-navigation.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont007-terrain.mjs
npm run build
npm run electron
```

**Esperado**: 21 PASS en la nueva suite. Compilación de Editor/Player: verificar salidas reales, no extrapolar resultados de 008.

**Escena de integración obligatoria:** crear un Subtract que corte una malla receptora editable/cerrada, con `StaticBody3D` y `CollisionShape3D` configurada como `TriMeshShape3D` apuntando a **esa misma malla receptora**. Insertar claves de Volumen caja→cilindro→escalera y cambiar posición/escala/rotación del cortador y de su padre. Verificar que el recorte, paredes internas, material y colisión de jugador/raycast coinciden **en el mismo frame del paso físico**. Repetir seek, pausa, loop, STOP, edición de un segundo receptor, guardado/recarga y Player exportado. Una segunda prueba con BoxShape3D incompatible debe bloquear de manera visible, sin mostrar “PASS”. Medir el FPS y uso de memoria en una escena pequeña y en una escena de varios cortes, en el hardware real, antes de aceptar CSG dinámico como rendimiento apropiado.

**Evidencias a devolver:** salida íntegra Node, build, consola Electron, vídeo de cámara/colisión/gizmo/STOP, prueba equivalente en Player y observación de rendimiento. No declarar QA LOCAL PASS con capturas de compilación exclusivamente.

## 5. Pendientes exactos para cerrar CORR-003

1. **QA CSG–Jolt nativo** y limpieza de recursos bajo cambios rápidos, varios cuerpos, cortes que eliminan totalmente la malla, colisión FPS, persistencia y paridad Player. Comportamiento `BoxShape3D` no equivalente a `TriMeshShape3D` está bloqueado, no arreglado automáticamente.
2. **Navigation Bake completo**: `cell`, `agentRadius`, `agentHeight`, `maxSlope`, `layers` y el efecto de `stepHeight` sobre erosión de celdas. La continuación 008 solo cambió conexiones entre celdas horneadas; no actualiza el binario del NavGrid.
3. **Propiedades restantes en Inspector**: habilitación, geometría y volumen de recipientes; combustión térmica; GI/hornos de Model; parámetros de topología, pintura y generación de Terrain; campos comunes estructurales (Tags, Groups, Layers, DontDestroyOnLoad), autoajuste editorial de BoxShape y cualquier otro control cuya autoridad todavía no se haya auditado y conectado. Prefab excluido y postprocesado de cámara diferido por decisión explícita.
4. **QA de cámara y Cinematics**: cambio de cámara principal, Camera Shake, Camera Preview, métodos, eventos, audio y FPS a través de Editor y Player exportado. Las pruebas Node no sustituyen QA visual.
5. **Matriz completa Inspector→propietario→evaluación→STOP→Player**, con pruebas por todos los tipos y propiedades alcanzables. El conteo informativo tras añadir `subtract.kind` pasa de 31/34 a **32/34 tipos con algún descriptor especializado**; los dos tipos restantes, `node` y `group`, son estructurales y disponen de canales comunes. **No equivale a 32 tipos terminados ni a una cobertura del 94,1 % de propiedades**. No hay evidencia para certificar 34/34 al 100 %.

**CORR-003 sigue ABIERTO, NO CERRADO.** No abrir G009–G014 de otro alcance ni adelantar Camera Orchestration por su cuenta.

## 6. Inventario diferencial final — SOURCE_BASELINE 008 del usuario

**2 nuevos, 10 modificados, 0 eliminados y 0 inesperados.** Se excluyen `node_modules`, builds, cachés y temporales.

**Archivos nuevos:**
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-CONTINUATION-009_SUBTRACT-CSG-JOLT_QA.md`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont009-subtract.mjs`

**Archivos modificados:**
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-timeline-node-method-track-s04-g003.mjs`
- `src/components/Inspector.vue`
- `src/core/timeline/preview.js`
- `src/engine/runtime/events/play-controls.js`
- `src/engine/runtime/events/play-level.js`
- `src/engine/runtime/events/play-timeline.js`
- `src/engine/runtime/nodes/subtract.js`
- `src/engine/runtime/physics/node-bodies.js`
- `src/engine/runtime/scene/brushes.js`

Las seis hojas ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY están actualizadas, preservando exactamente los valores y fórmulas de las  filas históricas.
