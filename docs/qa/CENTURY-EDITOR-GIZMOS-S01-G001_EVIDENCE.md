# Century Engine — Gizmos de escena: visibilidad independiente de selección

**Gate:** `CENTURY-EDITOR-GIZMOS-S01-G001-SELECTION-INDEPENDENT-VISIBILITY`  
**Fecha:** 2026-11-21  
**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA LOCAL NO VERIFICADO · APROBADO POR USUARIO · NO CERRADO

## Fuente y autorización

- Fuente: `Century-Engine-main.zip` aportado por el usuario.
- SHA-256 de la fuente: `119bb7a537a2d4565f78f42d59e6392a4d4f4144d71576489916c0f425bef08f`.
- Autorización literal: `Listo. CENTURY-EDITOR-GIZMOS-S01-G001-SELECTION-INDEPENDENT-VISIBILITY autoriza comenzar`.
- No se ejecutaron operaciones Git ni se publicaron cambios.

## Implementación

- `src/core/editor/selection.js`: la selección deja de controlar la visibilidad de los auxiliares; mandan el interruptor general, las categorías y el contexto editorial. Las zonas de interacción siguen la categoría Volúmenes. La selección permanece como autoridad para las asas de edición.
- `src/core/editor/collider.js`: contorno del collider visible sin selección cuando su configuración lo permite, asas visibles únicamente al seleccionar, y reutilización de la geometría si la forma y dimensiones no cambiaron. Se conserva `colliderPreview`.
- `src/engine/runtime/nodes/physics.js`: `CollisionShape3D` respeta la autorización de visibilidad del Editor en sus actualizaciones, sin condicionar la forma a la selección.
- `src/core/editor/camera-tools.js`: Game View oculta también colisiones auxiliares, celdas y el helper de luces de área.
- `scripts/test-editor-gizmo-independent-visibility.mjs`: seis pruebas de visibilidad, categorías, contornos, asas, física y Game View.
- `scripts/test-editor-ux-hub-gizmos-g001.mjs`, `scripts/test-editor-ux-s01-g002.mjs`, `scripts/test-physics-gizmo-s01-g001.mjs`: expectativas históricas sobre selección actualizadas al contrato vigente, manteniendo el resto de comprobaciones.
- `scripts/qa-suites.json`: grupo `editor-gizmos` para ejecutar las cuatro suites dirigidas.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: añadidos los registros de este Gate a ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY; historial existente conservado.

## QA ejecutado

| Comando / comprobación | Resultado |
| --- | --- |
| `node --check` de los módulos modificados | PASS |
| `npm run test:suite -- editor-gizmos` | **55/55 PASS** |
| `npm test` | 29/30 PASS y 1 FAIL; **idéntico resultado en la fuente original** |
| Pruebas extendidas de cámaras y controles de viewport | 40/51 PASS y 11 FAIL; **idéntico resultado en la fuente original** |
| `npm run build` | **NO COMPILADO**: `vite: not found` (`node_modules` ausentes) |
| QA visual en Electron, Game View real, Play y Player exportado | **NO VERIFICADO** |

El grupo `editor-gizmos` usa pruebas de Node con dobles de escena y verificaciones de contrato. El resultado no demuestra todavía el comportamiento visual ni el compilado de la aplicación completa.

### Evidencia conservada

Archivos en `docs/qa/evidence/CENTURY-EDITOR-GIZMOS-S01-G001/`:

- `node-targeted.log`: 55/55 PASS.
- `smoke-current.log` y `smoke-original.log`: comparación de smoke.
- `integration-current.log` y `integration-original.log`: comparación de las pruebas extendidas.
- `build-attempt.log`: bloqueo por ausencia de Vite.

## QA local pendiente

El usuario aprobó la corrección en esta conversación el 2026-11-21. No aportó nuevas pruebas de Electron o compilación; la aprobación no se registra como QA LOCAL PASS.


En el Editor real, abrir una escena con cámara, luces, audio, `CollisionShape3D`, un cuerpo físico, un trigger y un nodo auxiliar. Deseleccionar todo y comprobar que cada ayuda continúa visible. Desactivar y restaurar cada categoría, usar el interruptor general, seleccionar un collider para comprobar sus asas y ejecutar Game View y Play para comprobar que las ayudas no aparecen en el Runtime. Compilar el Editor/Runtime antes de aprobar y cerrar el Gate.
