# LF-NODE-SCRIPT-METHOD-CALL-S02-G001 — QA

**Estado:** IMPLEMENTADO · NODE TEST FOCAL PASS · ELECTRON/BUILD/PLAYER NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## QA automatizado

- Nuevo contrato: `node --test scripts/test-node-script-method-call-s02-g001.mjs` — **16/16 PASS**; métodos públicos, privados, args, callbacks, errores, Promises, identidad, cambio de script, Stop/Play, reparentado y ausencia de callbacks periódicos.
- Regresión focal S01/S05-CORR/Lifecycle/Groups/SceneFade + nuevo S02: **114/114 PASS**; ejecutar con la orden siguiente.
- Regresión antigua S05 original: **NS-13 FAIL por expectativa incompatible con identidad de instancia**. En SOURCE_BASELINE S01 la misma suite original obtenía **24/24 PASS**. Con la corrección S02 de identidad, el test fabrica un nuevo registro de nodo `b` con el mismo ID y todavía espera continuidad de la instancia anterior: **regresión de expectativa introducida por el cambio contractual**, no fallo preexistente. El contrato S02 ordena desmontar y montar con nuevo registro. Se mantiene test original sin alterar; resto de esa batería PASS.
- Documentación API: `node scripts/gen-docs.mjs --check` — PASS.
- Runner Electron + fixture Three.js real entregados; no se adjudica PASS sin ejecución.

```bash
node --test scripts/test-node-script-method-call-s02-g001.mjs scripts/test-node-script-s05-corr001.mjs scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs scripts/test-node-reference-resolution-s01-g001.mjs scripts/test-groups-api-s03-g001.mjs scripts/test-scene-fade-transitions-s01-g001.mjs
```

## Verificación local del usuario

1. Extraer SOURCE_BASELINE S02 en carpeta nueva, sin superponer S01 ni Terrain Extents. Ejecutar `npm ci` en la raíz.
2. Ejecutar el comando focal, `node --test scripts/test-node-script-s05-g001.mjs` (se espera la incidencia NS-13 documentada), y `node --test scripts/test-node-script-method-call-electron-s02-g001.mjs`. Registrar salida íntegra y capturas si hay errores.
3. Ejecutar `node scripts/gen-docs.mjs --check` y `npm run build` (guardar salida; NO equivale a QA local).
4. Abrir Editor mediante `npm run electron`. Crear recurso JS de tipo Nodo de una Puerta y otro de un Interruptor; usar el ejemplo del contrato. Verificar Play/Stop repetido, llamada por nombre/ID/ruta, argumento y retorno, método no expuesto, error controlado, cambio de `scriptId`, destrucción/recreación, reparentado y cambio de escena; comprobar que no hay fugas de listeners. No usar la consola de Editor para validar logs `console.log()` hasta su Gate independiente.
5. Repetir lo crítico en Player exportado y Prefab. Entregar logs Node/Electron/build, capturas o vídeo cuando aplique y dictamen de QA local.

**Cierre pendiente:** resolver o aceptar expresamente la discrepancia NS-13, Electron WebGL PASS real, build verificado, QA local Editor/Player y aprobación expresa. S03 no está implementado ni autorizado.

## Conciliación de regresión histórica mediante QA-CORR-001 (2026-11-01)

El usuario aprobó S02 y autorizó el Gate correctivo `LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA-CORR-001`. Bajo dicho Gate se corrigió **solamente la fixture** `NS-13` para conservar el registro original de `b` al eliminar `a`, y se añadió `NS-25` para comprobar por separado la sustitución deliberada de registro con idéntico ID.

**Evidencia posterior:** S05 histórico ampliado 25/25 PASS; suite focal S01/S02/S05/Lifecycle/Groups/Scene Fade 139/139 PASS (0 FAIL, 0 SKIP). La discrepancia específica `NS-13` queda conciliada en pruebas automatizadas; se conserva el registro de su fallo anterior para trazabilidad. Sin modificación de producción. Véase `docs/qa/LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA-CORR-001_QA.md`.

**Continúa pendiente:** Electron/WebGL, `npm run build`, QA local Editor/Player y confirmación de cierre. Ninguna afirmación histórica de FAIL se borra: describe la evidencia previa al correctivo. S03 autorizado está condicionado a estos prerrequisitos.

## Actualización de la aprobación local (2026-11-01)

El usuario ha aclarado expresamente que sus respuestas «Aprobado» se emiten **después de ejecutar QA local exhaustivo**, incluidos intentos de provocar fallos. La aprobación previamente comunicada para este Gate se registra por ello como **QA LOCAL PASS DECLARADO POR USUARIO · APROBADO**. No se recibieron logs adicionales de compilación o de Electron en esta conversación; esos resultados permanecen **NO VERIFICADOS AQUÍ**. Esta actualización no elimina la evidencia ni los errores documentados anteriormente y no equivale automáticamente a declarar el Gate CERRADO. La dependencia funcional de S03 queda desbloqueada por esta confirmación.
