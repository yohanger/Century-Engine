# Edit Mesh — integridad de selección y fusión de caras

**Gate autorizado:** `CENTURY-EDITOR-MESH-S01-G001-CORR-007-FACE-PICKING-AND-MERGE-CONNECTIVITY-INTEGRITY`.

## Fuente y autoridad

- SOURCE_BASELINE exacto: `CENTURY-EDITOR-MESH-S01-G001-CORR-006-MERGE-FACES-RUNTIME-DISPATCH_SOURCE_BASELINE.zip`.
- CORR-005 permanece **NO APROBADA** por el usuario; CORR-006 tiene implementación y pruebas Node, pero no aprobación visual ni cierre.
- La implementación modifica exclusivamente las rutas de selección de caras, diagnóstico de conectividad, pruebas y registros de QA. `setPointerCapture`, Loop Cut, física, gizmos, scripts de compilación y Git quedan fuera.

## Problemas y mecanismo

1. `session-pick.js`: `_pickFace` accedía sin validación a `this.body.geometry.userData.faceOf[faceIndex]`. Cuando el mapa faltaba, se producía el `TypeError` observado con índices de triángulo 113, 119, 137 y otros. **Corrección:** validar mapa, longitud frente a triángulos renderizados, índice y cara de `PolyMesh`; reconstruir la geometría actual y repetir el raycast cuando el mapa está ausente, desactualizado o fuera de rango. Si la reparación no entrega una cara válida, no crear una selección falsa. La fuente exacta que invalidaba el mapa dentro de la escena del usuario **no está acreditada**, porque no se proporcionó el proyecto ni se ejecutó Electron.
2. `ops-edit.js`: `groupsByEdge` determina adyacencia por aristas con los mismos IDs de vértices. Este criterio es correcto para topología de `PolyMesh` y evita fusiones sobre islas distintas. **Corrección:** diagnóstico previo de aristas coincidentes espacialmente con IDs diferentes, vértices compartidos sin arista, uniones en T de aristas subdivididas y caras realmente desconectadas. No soldar, cambiar índices ni reescribir una escena sin consentimiento.
3. El algoritmo preexistente `mergeSelectedFaces` y `dissolveFaces` se conservan para regiones conectadas, coplanares y con contorno válido. Las selecciones inválidas no modifican malla, UV ni selección, y no registran un cambio falso en `EditSession.run`.

## Compatibilidad y límites

- Los triángulos renderizados se corresponden con `PolyMesh` mediante el mapa existente `polyBuffers.faceOf`; se reutiliza `_rebuildBody` sin duplicar generadores ni algoritmos de raycast.
- El diagnóstico posicional de bordes es acotado para evitar comparaciones costosas en selecciones extensas.
- Las caras que se ven pegadas pueden pertenecer a la misma malla y, sin embargo, carecer de arista compartida; no se fusionan automáticamente. La corrección identifica la razón y preserva geometría existente.
- No se cambia el contrato de Undo/Redo, la serialización ni el árbol de escena.
- QA Electron, render real, entrada/salida visual de Edit Mesh y la reproducción exacta de las dos capturas permanecen pendientes.

## QA

Pruebas específicas en `scripts/test-mesh-face-picking-and-merge-integrity.mjs`; runner `mesh-face-integrity` en `scripts/qa-suites.json`. Evidencia y comparativa con baseline en `docs/qa/`.

**Estado:** IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA VISUAL NO VERIFICADO · NO APROBADO · NO CERRADO.
