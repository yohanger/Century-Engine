# LF-EDITOR-SNAP-SHIFT-G001 — QA y evidencia

## Implementación

SOURCE_BASELINE de entrada: `LevelForge_MESH_BEVEL_VERTEX_CORR_G001_SOURCE_BASELINE.zip`.
Cambios: `src/core/editor/snap.js`, `src/core/editor/gizmo.js`, `src/core/editor/keys.js`, `src/core/editor.js`, `src/engine/runtime/platform.js` (lectura de `doc.hidden`), documentación, paquete de pruebas y ledger.

## QA automatizado (2026-10-30)

`node --test scripts/test-editor-snap-shift-g001.mjs`: **17/17 PASS, 0 FAIL**. Valida cuantización absoluta/incremental, Shift en inicio/medio, movimiento en local/mundo con padre rotado, rotación local/global, escala, Snap previamente apagado, aislamiento de controles, no mutación de ajustes y contratos de listeners y eventos. Emplea dobles matemáticos de Three.js, no GUI real.

Regresión cruzada `node --test scripts/test-editor-snap-shift-g001.mjs scripts/test-mesh-transform-numeric-g001.mjs scripts/test-mesh-workflow-integration-qa-g001.mjs scripts/test-scene-clipboard-g001.mjs scripts/test-mesh-linked-instance-g001.mjs scripts/test-resource-history-corr-g001.mjs`: **120 PASS / 1 FAIL**. El único fallo es `HC-15` (`test-resource-history-corr-g001.mjs`): la serialización incluye `timelines`, `captures`, `assets`, `models`, `render`, `audio` que el valor esperado no contempla. **Reproducido sin modificaciones en SOURCE_BASELINE de entrada** (14 PASS / 1 FAIL). Se registra como deuda preexistente fuera del Gate; no se corrige el contrato de historia para justificar un resultado verde.

Comprobaciones sintácticas `node --check` de módulos nuevos/modificados: PASS.

## QA local todavía pendiente

1. Seleccionar una primitiva con Snap de movimiento activo. Arrastrar X y XZ sin Shift; debe respetar paso absoluto. Repetir manteniendo Shift desde antes de tocar el gizmo: movimiento libre.
2. Arrastrar sin Shift; a mitad mantener Shift y mover despacio. Soltar Shift, seguir moviendo: la transformación debe mantener continuidad y recuperar paso incremental. Pulsar y soltar Shift **sin mover**: no debe saltar.
3. Repetir en rotación (grados, ejes X/Y/Z, global/local) y escala (incluida escala visual) con las tres herramientas y el gizmo universal.
4. Repetir con varios nodos seleccionados y jerarquías padre/hijo. Al soltar el ratón, un solo Undo/Redo debe restaurar el estado anterior.
5. Confirmar que `Shift+A`, `Ctrl+Shift+Z`, `Shift+Tab`, `Shift+F5` y el bisel `Ctrl+Shift+B` siguen funcionando; Edit Mesh y terreno mantienen su Snap sin cambios.
6. Pérdida de foco, cambio de ventana y retorno al editor: Shift no debe quedar permanentemente activo.
7. `npm ci`, `npm run build`, `npm run electron` y Player exportado; Windows y Linux deben probarse por separado. No hubo compilación Vite ni QA GUI en este entorno por ausencia de `node_modules`.

**ESTADO:** Implementado + pruebas Node limitadas. NO COMPILADO / QA LOCAL NO VERIFICADO / NO CERRADO.
