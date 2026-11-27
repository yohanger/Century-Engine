# LevelForge — S16 G001 · Acta de auditoría y QA documental

**SOURCE_BASELINE:** `LF_LEDGER_CONTINUITY_S00_G001_INTEGRAL_RECONCILIATION_SOURCE_BASELINE.zip` (3.145 entradas, testzip CRC sin errores).  
**Autorización:** `Listo. LF-FPS-NATIVE-PLAYER-S16-G001-AUDIT-CONTRACT autoriza comenzar`.  
**Ámbito:** solo diagnóstico, contrato arquitectónico propuesto y ledger; ninguna modificación del runtime, escenas, prefabs, plantillas o pruebas existentes.

## Evidencia OBSERVADA

| ID | Hallazgo verificable | Fuente |
|---|---|---|
| FPS-01 | `DEFAULT_PLAYER` es FpsPlayer y PlayMode crea controlador especializado | `src/engine/runtime/player/index.js`; `src/engine/runtime/events/play.js` |
| FPS-02 | Personaje FPS administra locomoción/agua y pose de cámara | `src/engine/runtime/player/fps/{movement,water,camera,look}.js` |
| FPS-03 | `NodeSpatialRuntime` crea CharacterVirtual por CharacterBody3D además de la instancia física FPS | `src/engine/runtime/physics/{node-spatial,jolt-character}.js` |
| FPS-04 | PlayMode delega `game.player`, VM, spawn, interacción al controlador | `src/engine/runtime/events/play-player.js`; `src/engine/runtime/player/fps/api.js` |
| FPS-05 | Prefabs ya son subárboles de nodos con instancias vinculadas | `src/core/state/prefabs.js` |
| FPS-06 | Los scripts del nodo comparten el lifecycle del SceneGraph | `src/engine/runtime/scene/node-scripts.js` |
| FPS-07 | Parent Contract S15 U-04/05/06 exige modernización posterior y conservación de APIs | `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001.md` |

## Evidencia automatizada ejecutada en esta intervención

- `node --check` sobre 16 archivos JS de FPS, PlayMode, Jolt y scripts de nodo: **16/16 PASS sintáctico**. Log: `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G001/syntax-check.log`.
- `node --test scripts/test-player-camera-motion-s01-g001.mjs scripts/test-player-camera-motion-s01-corr001.mjs`: **25 PASS / 2 FAIL**. La suite histórica espera una salida de shake que no aparece en el harness (PCM-16) y el doble de `_shakePlay` carece de `_nodeEnabled` (PCM-17). No se ha demostrado defecto de producción por estos fallos. Log de origen preservado: `historic-camera-motion.log`.
- `node --test scripts/test-node-character-area-s04-g001.mjs scripts/test-node-character-area-s04-corr001.mjs`: **20 PASS / 11 FAIL**. Un harness invoca `_simStep` sin `_tlSyncBrushes`; otro importa un stub sin `createVirtualCharacterShape`, entre otras expectativas históricas. **No se atribuyen sin investigación a defectos de producción**. Log de origen preservado: `historic-node-character.log`.
- Build Vite, Electron, Jolt WASM en hardware real, Player AppImage y QA de usuario: **NO VERIFICADOS EN G001**. G001 documental no autoriza cambios correctivos en harnesses ni runtime.

## Riesgos y bloqueo de implementación

1. La existencia de `CharacterBody3D` nativo **no demuestra** la superficie completa de scripting de FPS ni equivalencia de cápsula física.
2. Trasladar `game.player` sin decidir identidad y ciclo de vida puede romper interacciones, guardados, cámaras, GameManager y Database. La ausencia o multiplicidad de personajes requiere contrato.
3. El render ViewModel usa VM_LAYER y una cámara auxiliar; no puede convertirse a nodos visuales ordinarios solo por renombrar estructuras.
4. Las pruebas históricas deben caracterizarse y actualizarse con evidencia contractual antes de usarlas como criterio de paridad.
5. El histórico S15 y CA pre-LTS no facultan a borrar datos actuales ni migrar de forma destructiva.

## Resultado

**G001: DOCUMENTACIÓN IMPLEMENTADA / QA DOCUMENTAL PARCIAL.** Se entrega contrato y arquitectura propuesta con dependencias; la topología y Gates G002–G008 requieren aceptación del usuario y posteriores autorizaciones literales. **NO CERRADO**, **SIN MODIFICACIONES DE RUNTIME**. Actualizadas las seis hojas del ledger preservando historial.

## Comparación contra SOURCE_BASELINE reconciliado

**5 nuevos, 1 modificado, 0 eliminados, 0 inesperados; 3.144 archivos originales sin cambios.**

**Nuevos:**
- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G001-AUDIT-CONTRACT_PROPOSED.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G001-AUDIT-QA.md`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G001/syntax-check.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G001/historic-camera-motion.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G001/historic-node-character.log`

**Modificado:** `docs/qa/LevelForge_DB_Ledger.xlsx` (6 hojas; 32 filas nuevas, ninguna previa alterada en valores, verificado con importación comparativa). 

**Eliminados:** ninguno. **Cambios de producción:** ninguno. 

Esta auditoría no altera los demás estados ni cierra el Sprint S16.
