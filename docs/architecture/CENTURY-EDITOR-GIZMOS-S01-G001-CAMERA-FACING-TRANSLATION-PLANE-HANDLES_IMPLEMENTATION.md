# CENTURY-EDITOR-GIZMOS-S01-G001-CAMERA-FACING-TRANSLATION-PLANE-HANDLES — Implementación

## Resumen

Se corrigió el gizmo de traslación para que los planos **XY**, **XZ** y **YZ** se coloquen en el cuadrante visible según la cámara, evitando que queden detrás del objeto seleccionado.

## Alcance aplicado

- **Incluido:** únicamente los planos del gizmo de **traslación**.
- **Conservado:** restricción nativa de dos ejes, pickers nativos, histéresis, soporte Global/Local y congelamiento durante el arrastre.
- **Excluido:** ejes individuales, rotación, escala, gizmo de Terrain y demás sistemas editoriales.

## Detalle técnico

La lógica se implementó dentro de `src/core/editor/gizmo.js`, ampliando `_cameraFacingHandles(control)`:

1. Se mantiene la lógica existente que decide qué extremo de cada eje **X/Y/Z** queda visible según el vector de visión.
2. Para el modo `translate`, se catalogan adicionalmente los handles **XY**, **XZ** y **YZ** de los grupos `gizmo` y `picker`.
3. En cada `updateMatrixWorld`, los planos se reubican al cuadrante visible usando el signo resuelto para sus ejes correspondientes.
4. Durante `dragging`, los signos se congelan para impedir saltos del asa bajo el puntero.
5. El gizmo de **scale** no reutiliza esta reubicación de planos.

## QA ejecutado

### PASS

- `node --test scripts/test-camera-facing-translation-plane-handles.mjs` → **4/4 PASS**
- `node --test scripts/test-transform-global-local-corr-g001.mjs` → **15/15 PASS**

### Observaciones

- `scripts/test-editor-viewport-controls-s02-g001-integral.mjs` presenta fallos ajenos a este Gate en el SOURCE_BASELINE actual, por lo que **no se utilizó como evidencia de aprobación**.
- No se ejecutó QA visual en Electron dentro de esta entrega.

## Archivos modificados

- `src/core/editor/gizmo.js`
- `scripts/test-editor-viewport-controls-s02-g001-integral.mjs`
- `scripts/test-camera-facing-translation-plane-handles.mjs`
- `docs/architecture/CENTURY-EDITOR-GIZMOS-S01-G001-CAMERA-FACING-TRANSLATION-PLANE-HANDLES_IMPLEMENTATION.md`
