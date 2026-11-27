# LF-NODE-CUSTOM-SIGNALS-S04-G001 — QA

**Fecha de intervención:** 2026-11-01 (continuidad del Gate).  
**Estado:** IMPLEMENTADO · NODE TEST PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PASS DECLARADO POR USUARIO · APROBADO.

## Evidencia ejecutada

| Control | Resultado |
|---|---|
| `scripts/test-node-custom-signals-s04-g001.mjs` | **19/19 PASS** |
| Suite focal S01/S02/S03/S04/S05/Lifecycle/Groups/Scene Fade | **163/163 PASS** |
| `node scripts/gen-docs.mjs --check` | **PASS** |
| Electron/Three.js WebGL2 | **NO VERIFICADO**, preflight falla por ausencia de Vite |
| `npm run build` | **NO VERIFICADO**, `vite: not found` |
| QA local del usuario Editor/Player | **PASS declarado por el usuario · APROBADO** |

## Ejecución local

Extraer el SOURCE_BASELINE S04 en carpeta nueva, sin mezclar otros baselines ni aplicar CHANGE encima. Desde la raíz:

```bash
node --test scripts/test-node-custom-signals-s04-g001.mjs
node --test scripts/test-node-custom-signals-s04-g001.mjs scripts/test-node-group-call-s03-g001.mjs scripts/test-node-script-method-call-s02-g001.mjs scripts/test-node-reference-resolution-s01-g001.mjs scripts/test-node-script-s05-g001.mjs scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs scripts/test-groups-api-s03-g001.mjs scripts/test-scene-fade-transitions-s01-g001.mjs
node scripts/gen-docs.mjs --check
npm ci
node --test scripts/test-node-custom-signals-electron-s04-g001.mjs
npm run build
npm run electron
```

Resultados Node esperados: **19/19**, **163/163**, sin fallos. Verificar Player cuando esté disponible. El runner Electron embebido usa `scripts/fixtures/nodes/node-custom-signals-s04-g001.html` con Three.js real, sin navegador externo.

## QA funcional recomendado

1. Crear emisor con Script de Nodo que declare `vida_baja` y publique un método que la emita; receptor que publique `avisar` y conectar `game.node('emisor').connect('vida_baja', game.node('receptor'), 'avisar')`.
2. Emitir con argumentos y verificar exactamente una llamada por receptor, orden de conexión y registro distinto para señales de diferentes emisores.
3. Repetir conexión y desconexión; no debe haber notificaciones duplicadas ni referencias retenidas.
4. Destruir y recrear emisor y receptor con mismo ID; no deben revivir conexiones anteriores. Probar cambio de escena, reparentado, Stop/Play y Prefabs.
5. Probar receptor que lanza excepción y que devuelve una Promise rechazada; los demás receptores deben seguir recibiendo y los errores reales reportarse.
6. Confirmar que el bus `game.emit/on` sigue independiente y que scripts sin callbacks periódicos no se procesan por fotograma.

La aprobación posterior del usuario implica QA local realizado en su flujo de trabajo. No registrar Electron ni compilación como PASS por esa aprobación genérica salvo evidencia explícita. El Gate solo podrá cerrarse cuando QA local esté aprobado y la documentación/ledger reflejen la evidencia.

## Continuidad aprobada por el usuario

El usuario aprobó S04 después de probarlo localmente, incluidos intentos de provocar fallos. Queda registrado como **QA LOCAL PASS declarado por el usuario · APROBADO**. Los resultados Electron/compilación que no fueron ejecutados en el entorno de implementación permanecen **NO VERIFICADOS**. El puente Area3D se aborda en S05 sin reescribir este historial.
