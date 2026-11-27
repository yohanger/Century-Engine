# LF-NODE-SIGNALS-EDITOR-S06-G004 — QA final

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO NODE PASS · QA LOCAL PASS DECLARADO POR USUARIO · APROBADO FUNCIONALMENTE · ELECTRON/BUILD AUTOMATIZADOS NO VERIFICADOS · CIERRE TÉCNICO PENDIENTE.

## Evidencia automatizada

Ejecutado desde SOURCE_BASELINE S06-G003 extendido con G004:

```text
node --test scripts/test-node-signals-editor-s06-g004.mjs \
  scripts/test-node-signals-editor-s06-g003.mjs \
  scripts/test-node-signals-editor-s06-g002.mjs \
  scripts/test-node-custom-signals-s04-g001.mjs \
  scripts/test-node-area-signal-bridge-s05-g001.mjs \
  scripts/test-node-group-call-s03-g001.mjs \
  scripts/test-node-script-method-call-s02-g001.mjs \
  scripts/test-node-reference-resolution-s01-g001.mjs \
  scripts/test-node-script-s05-g001.mjs \
  scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs \
  scripts/test-scene-clipboard-g001.mjs \
  scripts/test-mesh-linked-instance-g001.mjs
```

**238 tests; 238 PASS; 0 FAIL; 0 SKIP.** G004: 20/20 PASS, incluidas pruebas de remapeo real de Prefabs y del plan de importación `.levelpackage` con rechazo de referencias externas.

`node scripts/gen-docs.mjs --check`: PASS.

`npm run build`: **NO VERIFICADO**; `vite: not found` por ausencia de paquetes instalados en este entorno.

`node --test scripts/test-node-signals-editor-electron-s06-g004.mjs`: **NO VERIFICADO**. E01 (Jolt WASM real y remapeo) y E02 (Vue/Inspector + historial) no iniciaron por ausencia de Vite. No declarar fallo funcional del motor ni un PASS Electron.

La expectativa PERSIST-18 de G002 se actualizó porque el bloqueo provisional de `.levelpackage` quedó sustituido por una importación con remapeo validado en G004; la protección Godot sigue intacta. Las suites históricas de mallas vinculadas y portapapeles mantienen 51/51 PASS.

## QA local solicitado

1. Crear una escena con señales personalizadas y Area3D, comprobar envío y recepción de métodos publicados con Jolt WASM real.
2. Duplicar un subárbol y varios nodos con conexiones internas; verificar aislamiento y que no se copien enlaces hacia extremos externos. Repetir Ctrl+D, Alt+D y Ctrl+C/V.
3. Crear dos instancias de un mismo Prefab conectado; comprobar aislamiento, Apply/Revert/Unpack, persistencia y que referencias externas a hijos reemplazados no se redirijan silenciosamente.
4. Borrar/restaurar nodos y conexiones con Undo/Redo; guardar, cerrar y reabrir `.lfproj`.
5. Exportar e importar `.levelpackage` con conexiones en escenas y Prefabs; verificar remapeos. Confirmar rechazo explícito de enlaces a nodos no incluidos.
6. Probar Play/Stop, cambio de escena y Player exportado. Verificar que Godot bloquea conexiones no convertibles y que no aparecen subscripciones huérfanas.
7. Probar FPS en hardware objetivo y confirmar ausencia de regresión visible.

**Comandos locales:**

```bash
npm ci
node --test scripts/test-node-signals-editor-s06-g004.mjs
node --test scripts/test-node-signals-editor-electron-s06-g004.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

Aprobación del usuario: **RECIBIDA 2026-11-01** — respuesta «Aprobado» tras la entrega de G004. Se registra QA LOCAL PASS declarado por el usuario y APROBADO, sin solicitar repetir el QA. La secuencia S01–S06 está funcionalmente terminada. No hay evidencia nueva de compilación o Electron automatizado; permanecen NO VERIFICADOS y el cierre técnico formal no se afirma.

## Evidencia posterior de aceptación — 2026-11-01

- **OBSERVADO EN LA CONVERSACIÓN:** el usuario respondió «Aprobado» a la entrega de S06-G004. Conforme al criterio expresamente acordado, confirma haber realizado QA local exhaustivo; no se infieren logs ni comandos ejecutados concretos.
- **ESTADO ACTUAL:** QA LOCAL PASS declarado por usuario; APROBADO funcionalmente.
- **EVIDENCIA TÉCNICA MANTENIDA:** 20/20 G004 y 238/238 regresiones Node PASS; `gen-docs --check` PASS. Electron real y compilación Vite siguen NO VERIFICADOS por falta de dependencias en el entorno de implementación.
- **CIERRE:** secuencia funcional S01–S06 terminada; **CERRADO técnico no acreditado** mientras se mantengan las verificaciones obligatorias pendientes, sin reabrir artificialmente el QA del usuario.
- **ARCHIVOS PRODUCCIÓN:** ninguno modificado durante el registro de la aprobación.
