# LevelForge · LF-MESH-EDIT-MODAL-TRANSFORM-CORR-G001

**Autorización recibida:** `Listo. LF-MESH-EDIT-MODAL-TRANSFORM-CORR-G001 autoriza comenzar`

**SOURCE_BASELINE vinculante:** `LevelForge_NATURE_NODES_S01_G001_SOURCE_BASELINE.zip`

**Estado:** IMPLEMENTADO · NODE TEST PASS · ELECTRON/BUILD/QA LOCAL NO VERIFICADOS · **NO CERRADO**.

## Diagnóstico observado

Edit Mesh construía una segunda instancia de `TransformControls`, con `proxy`, escucha de `dragging-changed`/`objectChange`, `pointerMove`, Snap de gizmo y `ContinuousGrab`. A la vez, `session-input.js` y `session-modal.js` ya soportaban transformaciones modales G/R/S, ejes X/Y/Z, exclusión con Shift, confirmación/cancelación y Snap. La duplicación complicaba selección e interacción con la malla. Los `TransformControls` de Object Mode son un sistema distinto, conservado sin modificaciones.

## Corrección implementada

- `src/core/mesh/session.js`: retirar solamente el `TransformControls` propio de Edit Mesh (construcción, proxy, escucha, render de helper y disposición); conservar la única instancia de `ContinuousGrab` utilizada por las transformaciones modales, Extrude y operaciones existentes. `syncGizmoMode` permanece como punto de compatibilidad con las señales del Editor, sin volver a crear gizmos.
- `src/core/mesh/session-xform.js`: eliminar callbacks de edición por gizmo, reutilizar el mismo pivote, `PolyMesh` y transformación `_xform` de operaciones modales y numéricas. Actualizar `matrixWorld` al refrescar.
- `src/core/mesh/session-input.js`: dejar de consultar `tc.axis` al seleccionar vértices, aristas o caras; mantener Shift temporal de Snap en la sesión y su modal.
- `src/core/mesh/session-modal.js`: retirar acceso a `this.tc` al iniciar G/R/S y demás modales; conservar confirmación Enter/clic izquierdo, cancelación Esc/clic derecho, eje local/global, Snap, preview, Undo/Redo, Fill, Extrude y acceso de herramientas.
- `src/components/MeshPanel.vue`: explicar G/R/S, ejes, Enter y Esc; los controles numéricos continúan disponibles. El HUD de transformación se muestra en la posición inferior ya aprobada del Viewport; no se introduce otra barra de mensajes.
- Ningún cambio de `src/core/editor/gizmo.js`, escena, serialización, Player o geometría persistida.

## QA automatizado

- Suite nueva `scripts/test-mesh-edit-modal-transform-corr-g001.mjs`: **20/20 PASS**. Verifica ausencia de Gizmo propio, G/R/S, ejes y planos, entrada numérica, Enter, Esc, clic izquierdo/derecho, Shift, selección sin `tc.axis`, ausencia de doble `ContinuousGrab`, edición numérica y Object Mode intacto.
- Regresión de 24 suites de Mesh, Edit Mode, Transform, Snap, Nature y Terrain (excluyendo runner que requiere Jolt nativo no instalado): **477 PASS, 0 FAIL, 0 SKIP**.
- La suite de `test-terrain-transform-jolt-s02-g001.mjs` no puede ejecutarse correctamente sin dependencias de Jolt instaladas. Está fuera del mecanismo de este Gate: **NO VERIFICADO**. No declarar suite integral PASS.
- Electron `scripts/test-mesh-edit-modal-transform-electron-corr-g001.mjs`: fixture con Vue `MeshPanel`, `EditSession` y Three.js reales, verificaciones de G X 2, R Z 90, S 2, Undo, Esc, padre rotado y ausencia de gizmo. **NO VERIFICADO** sin `node_modules`/Vite/Electron.
- `npm run build`: **NO VERIFICADO** (`vite: not found`).

## QA local obligatorio (Electron embebido)

Extraer SOURCE_BASELINE en carpeta independiente. En la raíz:

```bash
npm ci
node --test scripts/test-mesh-edit-modal-transform-corr-g001.mjs
node --test scripts/test-editor-editmode-shift-snap-corr-g001.mjs scripts/test-mesh-transform-numeric-g001.mjs
node --test scripts/test-mesh-edit-modal-transform-electron-corr-g001.mjs
npm run build
npm run electron
```

1. En Object Mode, seleccionar cubo: gizmos de movimiento, rotación y escala siguen disponibles.
2. Entrar en Edit Mesh con Tab: no debe aparecer **ningún** Gizmo de TransformControls ni bloquearse clic/rectángulo de selección; probar vértices, aristas y caras.
3. Seleccionar vértice; G y mover ratón; X/Y/Z y Shift+X para restricciones; valor numérico (G X 2), Enter confirma con una entrada Undo.
4. Repetir R y S en aristas y caras; Esc y clic derecho cancelan dejando la misma geometría sin entrada de historial.
5. Shift suspende Snap, Ctrl y Snap persistente conservan sus comportamientos; comprobar local/global con padre rotado.
6. Usar transformación numérica del MeshPanel; ejecutar Extrude/Fill, Vertex Draw, selección por caja, cámara y Undo/Redo.
7. Los textos temporales deben aparecer abajo, nunca en la Toolbar. Guardar/reabrir; Play/Player sin diferencias de escena.
8. Salir con Tab: gizmos normales de Object Mode deben reaparecer.

**Evidencia a devolver:** Node, Electron, build, capturas antes/después Edit Mesh, G/R/S y QA visual de selección con ratón, y resultado de Player. Sin esas pruebas no declarar QA LOCAL PASS ni cierre.

## Fuera del Gate

- Reorientar los planos cuadrados XY/XZ/YZ del gizmo de Object Mode hacia la cámara.
- Migrar la propiedad de vegetación pintada de Terrain.
- Unificación del Inspector Terrain.
- Refactors de la escena/Player y cambios a los contratos de coordenadas mundiales/locales.

Se conservan las seis hojas del ledger y el historial anterior. Entregar exactamente dos ZIP, CHANGE y SOURCE_BASELINE. Sin SHA separado ni scripts `.sh`.
