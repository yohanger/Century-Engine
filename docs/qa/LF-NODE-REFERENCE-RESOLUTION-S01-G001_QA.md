# LF-NODE-REFERENCE-RESOLUTION-S01-G001 — QA

**Estado:** IMPLEMENTADO · NODE REGRESIÓN PASS · Electron NO VERIFICADO · Vite/Player/QA LOCAL NO VERIFICADOS · NO CERRADO.

## QA ejecutado en entorno de entrega

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| `node --test scripts/test-node-reference-resolution-s01-g001.mjs` | **14/14 PASS** | Test del cuerpo de mixins + helper real, sin dependencias instaladas |
| S01 + NodeScript S05 + S05 CORR + Lifecycle CORR + Groups S03 + Scene Fade | **122/122 PASS** | Comando completo en sección siguiente |
| `node scripts/gen-docs.mjs --check` | **PASS** | Referencia generada desde `game-api.d.ts` |
| `node --test scripts/test-node-reference-resolution-electron-s01-g001.mjs` | **NO VERIFICADO** | Runner interrumpido al faltar `node_modules/vite/bin/vite.js`; no alcanzó WebGL |
| Build Vite Editor/Player | **NO VERIFICADO** | Dependencias ausentes y npm registry no accesible (`EAI_AGAIN`) |
| QA local Editor/Player | **PENDIENTE** | Solo el usuario puede aportar evidencia |

```bash
node --test scripts/test-node-reference-resolution-s01-g001.mjs scripts/test-node-script-s05-g001.mjs scripts/test-node-script-s05-corr001.mjs scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs scripts/test-groups-api-s03-g001.mjs scripts/test-scene-fade-transitions-s01-g001.mjs
```

Comprobación ampliada: se ejecutaron también 134 tests al incluir Node Core; el resultado inicial fue 132 PASS, 2 FAIL. Uno se debió a que la fixture legada Groups omite `play.on`, corregido en S01 sin cambiar esa fixture. El otro es `NC-25`, fallo `migrateObjectGroups is not defined` en la fixture VM de `scripts/test-node-core-s01-g001.mjs`, no modificado por S01. **Se reprodujo el mismo NC-25 en una extracción independiente del ZIP previo**, con el mismo `ReferenceError`; no contar ese barrido como PASS integral.

## QA local obligatorio

1. Extraer únicamente el SOURCE_BASELINE final en una carpeta nueva. Desde esa carpeta: `npm ci`, después `node --test scripts/test-node-reference-resolution-s01-g001.mjs` y `node --test scripts/test-node-reference-resolution-electron-s01-g001.mjs`. Usar el Electron embebido sin abrir otro navegador.
2. `node scripts/gen-docs.mjs --check` y `npm run build` (si el `package.json` vigente expone ese comando); conservar toda la salida y la identificación de los módulos compilados. No confundir build con Player exportado.
3. En Editor, preparar una escena que tenga raíz e hijos, un par de nombres duplicados, un Script de Nodo y una escena destino. Comprobar por consola de errores o diagnóstico disponible: lookup por ID, rutas, renombrado, reparentado, invalidación después de destruir y recrear con el mismo ID, reconstrucción de representación 3D y navegación parent/children. No depender del `console.log()` en consola de Editor: esa corrección está pendiente de Gate separado.
4. Comprobar `dontDestroyOnLoad` sobre el mismo nodo lógico al cambiar de escena; capturar evidencia de Play/Stop repetidos, Groups/animaciones, luces y movimientos interrumpidos por cambio de escena.
5. Repetir caso crítico en Player exportado y confirmar que el proyecto original sigue cargando, que no aparecen errores en Jolt ni regresiones de Lifecycle. Enviar salida completa de tests y build, capturas/vídeo de casos visuales, log de errores y dictamen de QA local.

**Pendiente de cierre:** Electron PASS, Build PASS, QA LOCAL PASS y aceptación expresa. No se registra APROBADO/CERRADO anticipadamente.

## Actualización de la aprobación local (2026-11-01)

El usuario ha aclarado expresamente que sus respuestas «Aprobado» se emiten **después de ejecutar QA local exhaustivo**, incluidos intentos de provocar fallos. La aprobación previamente comunicada para este Gate se registra por ello como **QA LOCAL PASS DECLARADO POR USUARIO · APROBADO**. No se recibieron logs adicionales de compilación o de Electron en esta conversación; esos resultados permanecen **NO VERIFICADOS AQUÍ**. Esta actualización no elimina la evidencia ni los errores documentados anteriormente y no equivale automáticamente a declarar el Gate CERRADO. La dependencia funcional de S03 queda desbloqueada por esta confirmación.
