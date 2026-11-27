# QA — Integridad del fixture

## Evidencia del usuario (antes de la corrección)

`npm run test:suite -- edit-mesh-inspector-ux-electron`: 0 PASS / 1 FAIL; resultado del fixture `checks: []`. Excepción `TypeError: Cannot read properties of undefined (reading 'layers')` en `layerName` (`src/engine/runtime/layers.js:174:40`), llamada por `TagLayerRow.vue:21:57`. Esta evidencia corresponde a la entrega previa, no a la corrección.

## Evidencia ejecutada en el entorno de entrega

| Verificación | Resultado |
|---|---|
| Integridad baseline | 3921 archivos coincidentes |
| Pruebas focales Node | 14/14 PASS (12 originales y 2 nuevas) |
| Reproducción aislada | `layerName(undefined, 0)` lanza TypeError; registro de `defaultTagLayers()` devuelve Default |
| Regresión de 5 suites | 79/80 PASS antes y después; mismo fallo FOLD-02 preexistente |
| Sintaxis de los 3 archivos JS modificados | PASS |
| Integración Vite (fixture real, incluyendo nueva assertion) | BLOQUEADA antes de iniciar: ERR_MODULE_NOT_FOUND vite |
| Runner Electron | BLOQUEADO antes de iniciar: Falta Vite |
| 19 comprobaciones originales | Intactas, NO EJECUTADAS en la corrección |
| Compilación y QA visual | NO VERIFICADOS |

Las pruebas Node focales acreditan contrato de código y función real de capas, no el montaje del Inspector ni la ejecución del constructor de proyecto completo. El fallo histórico FOLD-02 se conserva sin modificaciones fuera del alcance. No se han alterado archivos productivos ni dependencias.

## QA local requerido

- `npm run test:suite -- edit-mesh-inspector-ux`
- `npm run test:suite -- edit-mesh-inspector-ux-electron`
- `node --test scripts/test-mesh-edit-integration-corr-g001.mjs scripts/test-mesh-edit-numeric-sign-corr-g001.mjs`

Estado: implementación en fuentes; aprobación y cierre pendientes. No declarar PASS Electron hasta contar con las 19 comprobaciones ejecutadas.
