# LF-NODE-GROUP-CALL-S03-G001 — QA

**Fecha:** 2026-11-01  
**Gate:** IMPLEMENTADO · TEST NODE PASS · Electron/build/Editor/Player NO VERIFICADOS EN ESTE ENTORNO · QA LOCAL S03 PENDIENTE · NO CERRADO.

## Evidencia ya ejecutada

| Control | Resultado |
|---|---|
| Casos S03 GC-01 a GC-16 | **16/16 PASS** |
| Regresión conjunta S01, S02, S05, Lifecycle, Groups, Scene Fade y S03 | **144/144 PASS** |
| Regenerar/validar API | **PASS** (`node scripts/gen-docs.mjs --check`) |
| Electron WebGL Three.js real | **NO VERIFICADO** (falta Vite) |
| Compilación Vite | **NO VERIFICADO** (falta `node_modules`) |
| QA local Editor/Player S03 | **PENDIENTE** |

La prueba automatizada S03 ejercita el mismo `NodeScriptRuntime`, `NodeLifecycle`, `NodeHandle` y `stepMethods` de producción, con SceneGraph simulado para Node. La prueba Electron incluida utiliza WebGL2 real, pero aquí no llegó a ejecutarse.

## Ejecutar Node y documentación

Desde la raíz del SOURCE_BASELINE S03 extraído en una carpeta **nueva**, sin superponer S02 ni Terrain Extents:

```bash
node --test scripts/test-node-group-call-s03-g001.mjs
node --test scripts/test-node-group-call-s03-g001.mjs scripts/test-node-script-method-call-s02-g001.mjs scripts/test-node-reference-resolution-s01-g001.mjs scripts/test-node-script-s05-g001.mjs scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs scripts/test-groups-api-s03-g001.mjs scripts/test-scene-fade-transitions-s01-g001.mjs
node scripts/gen-docs.mjs --check
```

Resultados esperados para esta fuente: 16/16 y 144/144, 0 FAIL, y referencia al día.

## Ejecutar Electron, compilación y Editor

```bash
npm ci
node --test scripts/test-node-group-call-electron-s03-g001.mjs
npm run build
npm run electron
```

El runner Electron embebido usa el fixture `scripts/fixtures/nodes/node-group-call-s03-g001.html`, basado en Three.js real y los módulos de producción. No instalar otro navegador. Ejecutar Player exportado cuando esté disponible.

## QA funcional local del usuario

1. Crear dos nodos activos en el Group `enemigos`; asignarles Scripts de Nodo que publiquen `recibirDanio` con `node.expose`.
2. Desde un tercer Script de Nodo, ejecutar `game.call_group('enemigos', 'recibirDanio', 10)`: ambos deben actualizar su estado, una vez, en orden de escena.
3. Comprobar grupo vacío y miembro sin método publicado: no deben provocar errores. Añadir y retirar pertenencia durante Play; no debe persistir tras volver al Editor.
4. Destruir un miembro durante la llamada. Comprobar que el siguiente no recibe llamada si ya no es válido, y que recrearlo con igual ID no reorienta el handle de la instantánea.
5. Probar un método que lanza error y otro que rechaza Promise: los errores deben reportarse y los otros miembros recibir su llamada.
6. Detener Play o cambiar escena durante una llamada: los destinatarios pendientes no deben ejecutarse. Repetir con Prefab, nodos persistentes y Player.
7. Confirmar que scripts sin `_process` ni `_physics_process` no producen un nuevo trabajo por fotograma.

**Evidencia a devolver:** aprobación del usuario tras sus pruebas locales, y errores/reproducciones si detecta algún fallo. No exigir logs de nuevo si el usuario declara «Aprobado», porque en su flujo implica QA local exhaustivo. Los resultados de Electron/build solo podrán marcarse PASS si se dispone de esa evidencia concreta.

## Pendientes posteriores

S04 Custom Signals requiere declaración y autorización propia; `LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001` continúa separado y pendiente. El ledger de seis hojas registra la implementación, las pruebas verificadas y los pendientes sin inventar PASS.

## Actualización de continuidad — aprobación del usuario

El usuario confirmó posteriormente «Aprobado. Sigamos» para S03 y aclaró que su aprobación significa QA local exhaustivo (incluidos intentos de provocar fallos). Se registra **QA LOCAL PASS DECLARADO POR USUARIO · APROBADO**. No se inventan resultados Electron, build o Player detallados que no se aportaron de forma separada; se conservan las evidencias originales y el historial.
