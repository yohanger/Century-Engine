# LevelForge · S16-G007-G002-G003-G002 · Auditoría de bloqueo y continuidad

**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-NATIVE-SPAWN-PLAYER-API`. Autorizado literalmente el 2026-11-12.  
**Estado:** AUDITORÍA EJECUTADA · CAMBIO DE RUNTIME BLOQUEADO POR CA-001 NO RATIFICADA.  
**SOURCE_BASELINE:** continuación acumulada G007-G002-G003-G001, 3.219 entradas, CRC PASS.

## Evidencia OBSERVADA

1. `src/engine/runtime/events/play.js`, `_scenePlayerDecision()`: sin `playerNodeId` retorna `legacy`, incluso cuando el usuario pretenda aparición diferida. El GameManager `none` no habilita un personaje.
2. `src/engine/runtime/events/play.js`, `start()` y `_setupScene()`: la selección `legacy` mantiene la creación de `FpsPlayer`. El camino nativo solo arranca con `playerNodeId` válido, que implica un jugador **ya presente**.
3. `src/engine/runtime/events/play-nodes.js`, `_prefabInstantiate()`: materializa Prefabs, registra cuerpos Jolt y devuelve handle ordinario; no altera `_nativePlayerId` ni `playerNodeId`. `_prefabDestroy()` limpia pertenencia sin política de jugador dinámico.
4. `src/engine/runtime/events/interpreter.js`, `_host()` y `src/core/events/game-api.d.ts`: existe `game.prefabs`, pero no `game.spawnPlayer`.
5. `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G002-IDENTITY-API-CONTRACT_PROPOSED.md`, ID16-02, más el contrato implementado de G007-G002-G002: el modo sin vínculo conserva legacy o `Sin jugador`. No hay modalidad `api`.

## Clasificación

- **CAUSA RAÍZ CONTRACTUAL:** ausencia de estado autoral explícito para la creación diferida del jugador, incompatible con la decisión vinculante de no fabricar un FPS paralelo.
- **INFERENCIA:** iniciar con la rama `legacy` y reemplazarla tras instanciar el Prefab introduciría un camino de transición ambiguo y erosionaría la garantía de una sola autoridad.
- **NO DEMOSTRADO:** paridad del futuro Spawn Player en Jolt WASM real / Editor / NGM Runtime.

## Verificaciones ejecutadas

`node --test scripts/test-fps-native-player-s16-g007-g002-g002-game-player-binding.mjs scripts/test-fps-native-player-s16-g007-g002-g003-g001-runtime-prefab.mjs`

**Resultado:** 30 PASS, 0 FAIL, 0 SKIP. Este PASS es de funcionalidades anteriores, **no** de Spawn Player. Log: `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-baseline-regression.log`.

No se han ejecutado build, Electron, Jolt WASM o NGM Runtime. NO VERIFICADOS.

## Cambio propuesto y acción real

Contrato propuesto `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-CA-001-DEFERRED-SPAWN_PROPOSED.md`, **NO RATIFICADO**.

Siguiente acción: ratificación expresa de CA-001 o resolución diferente del conflicto. Mientras tanto, el Gate sigue abierto y no debe implementarse la API pública, una selección implícita, ni reescribirse el contrato existente para justificar el fallo. Conservar G007-G002-G003-G001 como baseline acumulativo y añadir solo documentación/ledger hasta ratificación.
