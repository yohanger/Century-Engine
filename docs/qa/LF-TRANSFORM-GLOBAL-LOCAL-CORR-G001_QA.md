# LevelForge — LF-TRANSFORM-GLOBAL-LOCAL-CORR-G001

**Autorización exacta:** `Listo. LF-TRANSFORM-GLOBAL-LOCAL-CORR-G001 autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_ADDMENU_CATEGORIES_CORR_G001_SOURCE_BASELINE(1).zip`, ZIP íntegro, 1.428 archivos. La versión anterior de Shift+A fue **APROBADA POR EL USUARIO**, sin evidencia adicional de Electron/Player.

**Estado de este Gate:** IMPLEMENTADO · TEST NODE FOCAL PASS · COMPILADO NO VERIFICADO · ELECTRON/WEBGL NO VERIFICADO · QA VISUAL USUARIO PENDIENTE · NO CERRADO.

## Diagnóstico

**OBSERVADO:** El espacio global/local ya está conectado por `TransformControls.setSpace(store.space)` en `selection.js` y `EditSession.syncGizmoMode` en `session.js`. La barra y el atajo X alternan una preferencia temporal, no una posición serializada. Un objeto sin rotación puede mostrar ejes aparentemente iguales al cambiar de espacio. El gizmo específico de Terrain se limita a traslación del terreno alineado a mundo.

**CAUSA DEMOSTRADA EN CÓDIGO:** `gizmo.js` transformaba `object.position` (coordenadas del padre) directamente por el quaternion mundial del objeto al calcular Snap local. Con padre rotado o trasladado, las coordenadas eran incompatibles y el valor cuantizado podía ser incorrecto. En rotación con Snap se reconstruía el giro manualmente con `rotationAxis` sin convertir correctamente los espacios del padre. `session-xform.js` obtenía el pivote antes de actualizar la matriz mundial de la malla.

**NO DEMOSTRADO:** Que `TransformControls.setSpace()` por sí mismo no funcione, o que todos los gizmos tengan el mismo defecto visual. La orientación visual definitiva exige Electron y prueba humana. No se ha añadido una segunda posición almacenada ni otra clase de gizmo.

## Modificaciones autorizadas

- `src/core/editor/gizmo.js`: durante Snap de movimiento se proyecta posición local a mundo usando `parent.localToWorld`, se cuantiza en los ejes mundiales o en la base mundial del objeto tomada al inicio, y se vuelve al padre mediante `parent.worldToLocal`. Shift mantiene tramos incrementales sin saltos. En rotación se cuantiza el **delta real** generado por TransformControls, sin recomponer ejes en espacios diferentes. En Snap desactivado se conserva el giro del addon.
- `src/core/mesh/session-xform.js`: sincroniza `visual.matrixWorld` antes de obtener el pivote de Edit Mode.
- `scripts/test-editor-snap-shift-g001.mjs` y `scripts/test-terrain-transform-shift-snap-s02-corr001.mjs`: sus dobles de prueba implementan `getWorldQuaternion`, `updateWorldMatrix` y `Quaternion.slerpQuaternions` existentes en Three.js. Se preservan las expectativas históricas de Snap, Shift y Terrain.
- `scripts/test-transform-global-local-corr-g001.mjs`: **15/15 PASS** ejecutados sobre las funciones actuales, con padres rotados/trasladados, Snap, Shift, modos y API local/world.
- `scripts/test-transform-global-local-electron-corr-g001.mjs` y `scripts/fixtures/editor/transform-global-local-corr-g001.html`: runner Electron embebido y fixture Three.js/TransformControls/NodeHandle reales, **NO VERIFICADO** en este entorno.

No se ha cambiado `play-nodes.js`, su contrato público sigue siendo `node.position` local modificable, `node.worldPosition` mundial de solo lectura. El selector `Global/Local` no cambia por sí mismo los datos del nodo.

## QA efectuado y limitaciones

- `node --test scripts/test-transform-global-local-corr-g001.mjs`: **15 PASS, 0 FAIL, 0 SKIP**.
- Regresión focal (8 suites de gizmo, Snap, Terrain, Edit Mode y scripting): **141 PASS, 0 FAIL, 0 SKIP**.
- Regresión ampliada (13 suites): **227 PASS, 1 FAIL**. El fallo `CAM-09` de proyección de cámara fue reproducido sobre el SOURCE_BASELINE anterior sin el correctivo; su prueba y archivo de cámara no han cambiado. La suite ampliada **no es PASS total**.
- `npm ci --offline`: no pudo instalar paquetes por caché incompleta (`ENOTCACHED`). El intento normal tampoco completó npm (`Exit handler never called!`).
- Runner Electron: **NO VERIFICADO**; Vite no está instalado. `npm run build` responde `vite: not found`. Sin evidencia de compilación Editor/Player o QA de Jolt.

## QA local indispensable (Linux)

Extraer el nuevo `SOURCE_BASELINE` en una carpeta independiente y ejecutar desde su raíz:

```bash
npm ci
node --test scripts/test-transform-global-local-corr-g001.mjs
node --test scripts/test-editor-snap-shift-g001.mjs scripts/test-terrain-transform-shift-snap-s02-corr001.mjs
node --test scripts/test-transform-global-local-electron-corr-g001.mjs
npm run build
npm run electron
```

**Expectativas automatizadas:** 15/15 nueva Node; pruebas históricas de Snap y Terrain PASS; Electron **1/1 con al menos 16 controles internos**; Editor y Player compilados sin errores. Estas expectativas NO son resultados del entorno actual.

**Inspección del usuario:**

1. Seleccionar un objeto rotado 45° o 90°; pulsar X o el selector de la barra. En Global los ejes se alinean al mundo y en Local al objeto. Alternar sin arrastrar no altera ningún Transform.
2. Repetir con un objeto hijo de un grupo rotado 90° y desplazado, comprobar X Global y X Local, con Snap activado y con Shift para suspender Snap. Comparar numéricamente posiciones locales y mundiales antes/después.
3. Comprobar rotación local/mundial con Snap de 15°, Shift intermitente, escala en espacio local y pivote de selección múltiple.
4. Entrar a Edit Mode: comprobar gizmo y desplazamiento de vértices con objeto rotado y padre transformado; verificar que no hay saltos de pivote.
5. Ejecutar script en Play leyendo/modificando `node.position` y consultando `node.worldPosition`. Debe actualizarse la representación y la física donde corresponda. No probar un setter mundial que no existe.
6. Guardar y recargar escenas con jerarquías, comprobar Undo/Redo, Player exportado, Terrain y componentes que dependan del Transform.

**Evidencia solicitada:** logs Node, Electron y build; capturas de gizmos Global/Local sobre un objeto girado, una prueba de padre rotado con valores numéricos, resultado de script y QA Play/Player. No declarar QA LOCAL PASS ni CERRADO antes de la aceptación.

## Fuera del alcance

No se introdujo setter de `worldPosition`, nueva API de transformaciones, cambio de formato de `position`, refactor de escena o Inspector, ni corrección general de Terrain. Siguen pendientes `LF-MESH-VERTEX-WORKFLOW-CORR-G001` y `LF-TERRAIN-INSPECTOR-UNIFICATION-S03-G001`.

## Entrega obligatoria

Exactamente **dos ZIP**: CHANGE con archivos nuevos/modificados y SOURCE_BASELINE acumulado. Excluir `node_modules`, dist, builds, cachés y temporales; comparar contra SOURCE_BASELINE y registrar nuevos/modificados/eliminados/inesperados. Mantener seis hojas del ledger sincronizadas.
