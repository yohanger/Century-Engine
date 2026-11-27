# LF-NODE-SIGNALS-INTEGRATION-S07-G001 — QA

## Estado al entregar

- Implementación de host de escena Player: **IMPLEMENTADO**.
- Suite nueva `node --test scripts/test-node-signals-integration-s07-g001.mjs`: **16/16 PASS**.
- Regresión de 24 suites: **463 PASS, 0 FAIL, 1 SKIP**; el SKIP corresponde a compilación de plantilla Vue en un test anterior (dependencias no instaladas aquí).
- Sintaxis JS: **PASS**.
- Documentación: `node scripts/gen-docs.mjs --check` **PASS**.
- Electron: **NO VERIFICADO** (`Falta Vite; ejecutar npm ci antes del QA`).
- Compilación: **NO VERIFICADA** (`vite: not found`).
- QA LOCAL: **PENDIENTE**. No declarar CERRADO, FIXED ni READY para la integración completa.

## Comandos en la carpeta extraída del SOURCE_BASELINE S07

```bash
npm ci
node --test scripts/test-node-signals-integration-s07-g001.mjs
node --test scripts/test-node-signals-integration-electron-s07-g001.mjs
node --test scripts/test-node-signals-godot-callback-s06-g002-integral.mjs
node --test scripts/test-node-signals-godot-callback-electron-s06-g002-integral.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

La suite S07 debe presentar **16 PASS/0 FAIL**. El runner Electron S07 debe dar **1 PASS** con al menos 27 comprobaciones, WebGL2 y Jolt WASM. Las compilaciones deben terminar para Editor y Player.

## Matriz de integración local

| ID | Acción | Evidencia requerida |
| --- | --- | --- |
| S07-01 | Nodo emisor y receptor con método publicado; conectar nativa `ready` | Entrada real al Play, callback una vez, sin duplicación |
| S07-02 | Crear callback y conexión desde Editor, guardar y reabrir | Ambos persisten; Undo/Redo conjunto y protección de edición posterior |
| S07-03 | Dos scripts en un receptor y Custom Signal literal | Publicación de método correcto y entrega de argumentos |
| S07-04 | Cambiar de escena A a B y volver a A | Conexiones de cada escena distintas; sin fugas ni duplicados |
| S07-05 | Probar `tree_entered`, `tree_exiting`, `tree_exited` | Orden, identidad y limpieza según contrato |
| S07-06 | Area3D con Jolt real | `body_entered` / `area_entered` únicamente con eventos reales |
| S07-07 | Audio `finished` y Animación `animation_finished` | Solo finalizaciones naturales, nunca falsas por detener o loop |
| S07-08 | Exportar Player LevelForge y navegar dos escenas con conexiones distintas | Cada escena recibe solo sus conexiones persistidas |
| S07-09 | Exportación Godot de escena con señales | Bloqueo explícito, sin pérdida de proyecto |
| S07-10 | Repetir Play/Stop y abrir el Editor tras exportar | Sin conexiones activas en Edit Mode ni listeners huérfanos |

## Interpretación de incidencias

- **Signals / Player:** cualquier error de conexión, serialización, emisor, receptor, Node Script o cambio de escena bloquea el cierre.
- **Edit Mesh:** `snapModalValue`, `_cancelPaintStroke`, `setPointerCapture`, advertencias geométricas y CSP detectadas por el usuario se registran para el saneamiento final; no se corrigen en este Sprint.
- **Consola / Terreno:** continúan pendientes y fuera de alcance.

**Estado contractual:** S06-G002-INTEGRAL sigue **APROBADO PARCIALMENTE** hasta su cierre formal; S07 permanece **IMPLEMENTADO / QA LOCAL PENDIENTE**. La opinión del usuario no se sustituye por el resultado automatizado.

## Adenda de aprobación del usuario (2026-11-02)

El usuario respondió «Aprobado. Sigmaos.» tras la entrega de Signals S07-G001. Se registra como **QA LOCAL PASS declarado por el usuario y APROBADO**. No aporta en ese mensaje nuevos logs locales de Electron/build; no se atribuyen resultados automatizados adicionales. El cierre documental se realiza en el Gate autorizado LF-TERRAIN-INSPECTOR-CONTEXT-S04A-G001-INTEGRAL.
