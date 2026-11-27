# Century Engine — Enlace de Fusionar caras entre sesión y operaciones

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-006-MERGE-FACES-RUNTIME-DISPATCH`.

## Base y autoridad

- SOURCE_BASELINE: `CENTURY-EDITOR-MESH-S01-G001-CORR-005-MERGE-SELECTED-FACES_SOURCE_BASELINE.zip`.
- La corrección previa CORR-005 fue rechazada por el usuario tras un fallo visible al fusionar caras; su historia se conserva.
- Alcance exclusivo: reparar la llamada al módulo de operaciones que realiza `EditSession.op('mergeFaces')`.

## Causa raíz acreditada

`EditSession.op('mergeFaces')` llamaba `O.mergeFaces`. `src/core/mesh/ops.js` exportaba `mergeSelectedFaces` (mediante `export * from './ops-edit.js'`) y lo registraba en `OPS.mergeFaces`, pero **no exportaba `mergeFaces` como símbolo de módulo**. Al activar el comando, la función era `undefined` y lanzaba `TypeError`.

## Cambio implementado

- `src/core/mesh/ops.js`: exporta `mergeSelectedFaces` también bajo el nombre público `mergeFaces`; sigue siendo la **misma función** registrada en `OPS.mergeFaces`, sin lógica ni duplicación nuevas.
- `src/core/mesh/session.js`, `src/core/mesh/ops-edit.js`, menús, herramientas y geometría: **sin cambios**.
- `scripts/test-mesh-merge-runtime-dispatch.mjs`: pruebas que importan el símbolo usado por la sesión y ejecutan la rama `EditSession.op('mergeFaces')` extraída sin alteraciones, con un arnés mínimo del método `run`. Verifican éxito, rechazo sin mutación/commit ficticio y serialización anterior/posterior.
- `scripts/qa-suites.json`: añade runner `mesh-merge-runtime-dispatch` sin retirar las suites existentes.

## Garantías y límites

- La fusión solo se acepta para regiones coplanares y conectadas conforme a la validación existente.
- Undo/Redo usa el sistema existente; las pruebas dirigidas verifican estados de malla serializables. La ejecución visual real de Ctrl+Z en Electron no fue posible.
- No se modifica Loop Cut, `setPointerCapture`, Jolt, manejo de materiales ni captura de entrada.
- La implementación está probada en Node, pero **NO COMPILADA** (`vite` ausente) y **QA VISUAL ELECTRON NO VERIFICADO**.
- CORR-005 permanece NO APROBADA; CORR-006 no recibe aprobación ni cierre hasta que el usuario valide el comportamiento en el editor.
