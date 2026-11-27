# LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001 — QA

## Estado vigente: aprobado y cerrado

El usuario aportó Node 33/33 PASS y Electron 1/1 PASS con 35 comprobaciones, seguido de «Aprobado. Sigamos.». G001 y CORR-001 quedan cerrados documentalmente en LF-MESH-EDIT-INTEGRATION-CORR-G001. Evidencia final: `docs/qa/evidence/LF-MESH-EDIT-INTEGRATION-CORR-G001/console-approval.md`. Las seis hojas del ledger reflejan ese cierre. No se requiere repetir el QA de Consola aprobado.

## Historial conservado: estados anteriores al cierre

Estado: IMPLEMENTADO. Suite nueva 30/30 PASS. Regresión focal 316/316 PASS. Editor y Player COMPILADOS. Regresión ampliada 1.368 PASS / 11 FAIL heredados. Electron/WebGL2 y QA visual/local NO VERIFICADOS. NO APROBADO, NO CERRADO.

## Ejecuciones y límites

| Comprobación | Evidencia real |
| --- | --- |
| Consola Node | 30 PASS, 0 FAIL, 0 SKIP; console-node.log |
| Focal: Scripts, Multiscript, Signals, Terreno y UI | 316 PASS, 0 FAIL, 0 SKIP en 17 suites; focal.log, focal-suites.json |
| Ampliada | 1.379 pruebas: 1.368 PASS, 11 FAIL, 0 SKIP en 51 suites; regression.log, regression-suites.json |
| Base original sin cambios de producción/tests | 1.349 pruebas: 1.338 PASS, los mismos 11 FAIL, 0 SKIP; baseline-regression.log |
| Compilación Editor y Player | npm run build, exit 0; build.log. Advertencias de chunks grandes y externalización node:module de Jolt; sin modificar dependencias |
| Documentación | node scripts/gen-docs.mjs --check; docs.log |
| Electron de Consola | Se ejecutó el runner: falla antes de abrir fixture por falta de X/$DISPLAY; console-electron.log |
| Intento Electron sin ventana | No ejecuta fixture; restricciones de sockets y fallo de proceso; electron-single-process.log. No representa WebGL PASS |
| Ledger | Seis hojas, contenido histórico preservado fuera de celdas autorizadas y filas añadidas, sin errores de fórmula detectados; ledger-validation.json |

Las pruebas Node verifican niveles, salida única, game.log, contexto, closures tras await/Signals, consola local del autor, errores, invalidación de slots/eventos/rutas/sesiones, límite del historial, serialización, Player sin store y compilador Vue. UI se verifica además con render SSR y callbacks conservando la salida léxica. SSR no verifica DOM, clics, scroll ni apariencia.

La fixture Electron prepara al menos 30 comprobaciones de panel real, niveles, contador, toast, Multiscript/Signals, montaje/UI/clic y error de Vue, límite, scroll, limpiar, sesiones y host Player. Incluye WebGL2 y carga de Jolt WASM sin modificar física. Estas comprobaciones están PREPARADAS, NO EJECUTADAS con éxito aquí.

## Fallos heredados demostrados

| IDs | Diagnóstico limitado a la evidencia |
| --- | --- |
| F12-01…06 | Fixture histórica rechaza require('./recovery-session.cjs'). Se reproducen seis fallos en la base original |
| NC-25, NP-29 | Harnesses que extraen la fábrica no incluyen migrateObjectGroups; mismo ReferenceError en original |
| NE6-16 | Expectativa de CSS @container insp (max-width: 340px) no coincide con estilos originales |
| NE6-18 | Espera componentes especializados en InspectorDock; el Inspector fue integrado anteriormente |
| NI-12 | Espera el markup histórico del icono de SceneTree; no coincide con el archivo original |

No se corrigen esas suites ni los sistemas de producción asociados. No se declara PASS global de la regresión ampliada. Las tres expectativas de avisos de Database que sí dependían del canal modificado se actualizaron manteniendo sus verificaciones funcionales y añadiendo ausencia de salida del autor.

## QA local en Linux

En una carpeta nueva extraída del SOURCE_BASELINE:

```bash
npm ci
node --test scripts/test-editor-console-script-output-corr-g001.mjs
node --test scripts/test-editor-console-script-output-electron-corr-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

Esperado: Node 30/30 PASS sin SKIP; Electron 1/1 PASS y al menos 30 checks; build Editor y Player satisfactorio. La suite histórica ampliada conserva los 11 fallos descritos; no esperes un PASS total hasta auditar sus harnesses en otro alcance.

1. Abrir Consola vacía, guardar e importar un recurso: deben aparecer sus notificaciones, sin entradas en Consola.
2. Ejecutar un script global con console.log/info/warn/error/debug y game.log: una entrada por llamada, nivel correcto y contexto cuando está disponible.
3. Adjuntar dos Scripts de Nodo. Verificar _ready, callbacks Signals, errores y salida _exit_tree; repetir Play/Stop y cambiar de escena, sin salidas obsoletas o duplicadas.
4. Ejecutar código de un evento y de una ruta. Probar un error controlado y conservar funciones del juego.
5. En una interfaz .ui propia, escribir desde setup y un botón. Provocar una excepción en su evento: diagnóstico único en Consola. Cerrar la interfaz y repetir Play sin mensajes tardíos de esa instancia.
6. Comprobar texto multilínea, contexto, warn/error/debug, límite de 300, desplazamiento automático al llenarse y Limpiar con contador sincronizado.
7. Guardar/reabrir el proyecto y exportar Player. Ejecutar scripts exportados con console y game.log; deben funcionar con el host del Player y su consola técnica.
8. Probar un script con const console propio: su comportamiento privado debe mantenerse.

Devuelve resultado local y salida del runner Electron. Si hay un fallo, incluye mensaje exacto y pasos de reproducción. No necesitas repetir QA de Terreno aprobado. La aprobación posterior debe registrarse como QA LOCAL PASS declarado; no atribuirle logs automatizados no aportados.

## Evidencia local posterior y CORR-001 — 2026-11-02

El usuario declaró **«Aprobado. Aunque los test fallaron.»**. Se reconoce aprobación funcional/QA manual declarado, con cierre técnico pendiente. Su salida verifica Node 30 PASS y builds Editor/Player; CON-E01 de Electron sí ejecutó la fixture y falló después de 13 comprobaciones PASS en «Dos scripts de nodo, dos salidas». No se ejecutaron los checks posteriores.

La causa fue confirmada en la fixture: `_lfNodeOwner` raw no coincide con el proxy reactivo de `store.project`. La corrección autorizada se documenta en `LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001-CORR-001_QA.md`. Conserva producción y corrige el montaje de QA. Suite actual: 33 PASS; focal: 319 PASS; Electron corregido todavía NO VERIFICADO en autoría. No es uno de los 11 fallos históricos y no se cierra G001 hasta verificar la corrección.
