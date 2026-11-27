# LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-002 — Plan y evidencia QA

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · TEST NODE 410 PASS / 0 FAIL / 1 SKIP · VUE COMPILER NO VERIFICADO · ELECTRON NO VERIFICADO · BUILD NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia del usuario (CORR-001, QA FALLIDO)

- Node CORR-001: 18/18 PASS.
- Electron: 1 FAIL — `Error: No se obtuvo resultado WebGL de la fixture`.
- Editor build: FAIL — `[vite:vue] v-else/v-else-if has no adjacent v-if or v-else-if`, `SignalConnectionsPanel.vue:286`.
- Player build: NO EJECUTADO, Editor falló antes.
- Docs: PASS. Arranque `npm run electron` sin prueba visual concluyente.
- CORR-001 sigue **QA FAIL · NO APROBADO**; tampoco se cierra el Gate parent S04-G001.

## Evidencia propia de CORR-002

| Verificación | Resultado |
|---|---|
| Suite Node CORR-001 ampliada | **19 PASS, 0 FAIL, 1 SKIP**; CORR-19 compilar Vue se omitió por dependencias ausentes; CORR-20 fixture PASS |
| Regresión 21 suites S01–S04, Audio, Animation, Custom, Multiscript y Area3D | **410 PASS, 0 FAIL, 1 SKIP** |
| Sintaxis Node de scripts de prueba | PASS |
| `node scripts/gen-docs.mjs --check` | PASS |
| Vue SFC / Vite Editor/Player | NO VERIFICADO aquí |
| Electron WebGL2/Jolt WASM / fixture real | NO VERIFICADO aquí |
| QA visual usuario | PENDIENTE |

La prueba `CORR-19` usa **`@vue/compiler-sfc` real**: tras ejecutar `npm ci` **no debe aparecer como SKIP**. Si aparece SKIP o FAIL, el Gate queda BLOQUEADO aunque las demás pruebas Node pasen.

## Pruebas Linux

```bash
npm ci
node --test scripts/test-node-signals-godot-ux-s04-g001-corr001.mjs
node --test scripts/test-node-signals-godot-ux-electron-s04-g001-corr001.mjs
node --test scripts/test-node-signals-godot-ux-s04-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

**Esperado:** suite Node ampliada **20 PASS, 0 FAIL, 0 SKIP**, incluido compilador Vue real; Electron **1 PASS** y al menos **36 checks**, Vite Editor y Player **ambos PASS**. La fixture no debe perder el resultado de `#lf-sig-name`. Electron sigue usando Chromium embebido, sin navegador externo.

### QA visual

Seleccionar Area3D: señales físicas en árbol; hacer doble clic en `body_entered` y comprobar el origen fijo. Conectar receptor real y método, editar, desconectar y Undo/Redo. Cambiar a CollisionShape3D: las señales físicas de Area3D deben desaparecer. En Play deben deshabilitarse edición y botones, mostrando el mensaje de aviso. Repetir con Custom Signal detectada y conexión histórica sin declaración. Probar dock angosto y manejo de foco con teclado. Conservar proyectos existentes y los SOURCE_BASELINE previos hasta aprobación.

**Evidencia a devolver:** salida completa de los tests Node (sin SKIP), Electron y ambos builds; capturas del árbol y diálogo si hay diferencias visuales, pasos de reproducción de incidencias. Cierre y ledger de CORR-002 únicamente tras QA local PASS y aprobación del usuario.
