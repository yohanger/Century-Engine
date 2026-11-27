# QA · S13-G004 · Inspector de Escena

**Estado: IMPLEMENTADO · NODE PASS · ELECTRON/BUILD/QA LOCAL NO VERIFICADOS · NO APROBADO · NO CERRADO.**

## Evidencia ejecutada en el entorno de preparación

| Ámbito | Resultado | Evidencia |
|---|---|---|
| Node focal G004 | 20 PASS, 0 FAIL | `evidence/LF_S13_G004_NODE_FOCAL.log` |
| Node compatible | 88 PASS, 0 FAIL | `evidence/LF_S13_G004_NODE_COMPATIBLE.log` |
| Node ampliado | 121 PASS, 2 FAIL **preexistentes** | `evidence/LF_S13_G004_NODE_EXPANDED.log` |
| Reproducción baseline inalterado | `S02-16`, `SCENE-09`: 2 FAIL idénticos | `evidence/LF_S13_G004_BASELINE_PREEXISTING.log` |
| Electron G004 | 0 verificaciones ejecutadas; falta Vite | `evidence/LF_S13_G004_ELECTRON_ENV.log` |
| Compilación Editor/Player | No arranca: `vite: not found` | `evidence/LF_S13_G004_BUILD_ENV.log` |
| QA visual, World, Bake, Player real | Pendiente de pruebas del usuario | Sin evidencia |

## Comandos en la raíz existente del proyecto

```bash
node --test scripts/test-inspector-scene-ux-cleanup-s13-g004.mjs
node --test scripts/test-inspector-scene-ux-cleanup-s13-g004-electron.mjs
node --test scripts/test-scene-fade-transitions-s01-g001.mjs scripts/test-scene-inspector-ownership-s02-g001.mjs
npm run build
npm run electron
```

**Esperado:** 20 PASS focales; Electron **1 PASS / 36 checks internos**; build Editor+Player. El grupo Scene Ownership contiene la aserción `S02-16` **preexistente FAIL**: mantener su evidencia separada y no presentar esa suite histórica completa como PASS. Lo mismo ocurre con `SCENE-09` del antiguo test Scene S01.

## QA usuario requerido

- Abrir Escena y revisar los tres grupos; los 18 apartados tienen identidades estables, se pliegan y reabren con ratón/teclado y no modifican datos o Undo.
- Contraer y reabrir Escena, Mundo, Recursos y subapartados; verificar persistencia `inspFold` entre selección/reinicio, sin contaminación de tipos de nodo.
- Revisar transiciones de pantalla y GameManager; no se pierden ajustes ni Fade In/Out.
- Probar Manual, Ciclo día/noche y escena heredada; sin luz direccional, mensaje visible en encabezado.
- Confirmar que World controla clima, niebla y nubes cuando corresponde, sin borrar valores manuales; alerta HDRI sin imágenes.
- Confirmar requisitos de volumétrica y advertencias de Bake (progreso, cancelar, desactualizado) aun al colapsar; la ejecución del bake y limpieza de lightmaps siguen siendo las originales.
- Test visual de panel estrecho y desacoplado, scroll vertical sin desbordamiento horizontal, UI limpia con tooltips activos/desactivados.
- Verificar Editor y Player con un proyecto existente; no se aceptará compilación como prueba auditiva o visual.

No declarar PASS Electron, FIXED, APPROVED o CLOSED sin logs y aprobación del usuario.
