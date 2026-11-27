# LF-NODE-SIGNALS-AUDIO-S02-G001 — QA

**Fecha:** 2026-11-02 · **Estado:** IMPLEMENTADO · NODE PASS · ELECTRON NO VERIFICADO · BUILD NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

| Verificación | Estado |
|---|---|
| Nueva suite `test-node-signals-audio-s02-g001.mjs` | **15/15 Node PASS** |
| Regresión conjunta Audio, Signals S04–S06, Multiscript S01, Jolt/CharacterBody, grupos y ciclo de vida | **345 PASS, 0 FAIL, 8 SKIP**, 353 totales, 20 módulos |
| `node scripts/gen-docs.mjs --check` | PASS |
| Sintaxis `node --check` producción y fixture | PASS |
| `test-node-signals-audio-electron-s02-g001.mjs` | NO VERIFICADO: falta Vite en este entorno |
| `npm run build` Editor/Player | NO VERIFICADO: `vite: not found` |
| QA local de usuario | PENDIENTE |

Los 8 casos SKIP proceden de suites históricas; no se contaron como PASS. Las pruebas Node usan simulación determinista de Web Audio para fin natural, stop, pausa, resume, loop, reemplazo, objeto con ID reutilizado, escena, suscripciones e inicio. La prueba Electron incluida usa Web Audio real, clip generado de forma controlada, WebGL2 y Jolt WASM del proyecto; **su presencia no equivale a ejecución**.

## Comandos Linux

```bash
npm ci
node --test scripts/test-node-signals-audio-s02-g001.mjs
node --test scripts/test-node-signals-audio-electron-s02-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

**Esperado:** 15/15 Node PASS; Electron 34+ comprobaciones PASS con Jolt WASM, WebGL2 y Web Audio real; compilación Editor y Player PASS. En el Editor: seleccionar Audio 3D y Audio UI; comprobar `finished` entre señales nativas; conectar a un método público `node.expose()` de un Script de Nodo; reproducir clip no-loop de corta duración y verificar una entrega; detener, pausar, repetir, reemplazar clip y cambiar escena: sin falsas emisiones ni referencias anteriores. Comprobar `playOnStart` con clip breve y conexión visual inicial. No confundir build con QA visual.

Registrar errores, pasos y logs, sin normalizar el resultado. El usuario aprueba/cierra el Gate solo tras QA local.

**Pendientes fuera de alcance:** rediseño Signals tipo Godot, Terreno en Inspector, Consola limpia al final, vulnerabilidades npm heredadas. No se modificaron dependencias.

### Adenda: aprobación QA local del usuario (2026-11-02)

Tras la entrega de Audio G001, el usuario respondió **«Aprobado. Sigamos»**. Registrar **QA LOCAL PASS DECLARADO · APROBADO**, sin incidencias declaradas. Esto actualiza el estado histórico PENDIENTE mostrado al principio de este documento. No se aportaron nuevos logs Electron o build con esa aprobación; conservar esas verificaciones como **NO VERIFICADO documentalmente** y no inventar evidencia de ejecutarlas. La actualización del ledger y la continuación a Animation G002 constan en los artefactos de G002.
