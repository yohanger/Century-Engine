# Trazabilidad LF-CLOUD-STORM-S00-G001

| Requisito | Evidencia en código | QA | Estado |
|---|---|---|---|
| R1: Mundo único gobierna la aproximación | `world.js: World.frame().stormFront` y `_fade` | CS-01/02/03 | NODE PASS; gráfico pendiente |
| R2: No duplicar nubes | `skylib.js: stormFrontMask()` actúa en `cloudLayer()` | CS-07/08 | NODE PASS; gráfico pendiente |
| R3: Nube iluminada por la descarga que realmente sucede | `World._startStrike().cloud`, `frame().cloudLightning`, uniforms de `viewport-env.js` | CS-04/05/06/07 | NODE PASS; gráfico pendiente |
| R4: Conservar el canal y eventos LightningFX/Thunder | `lightning-fx.js` SIN CAMBIOS, `World._emitBolt` SIN CAMBIOS | 75 tests Node focales | NODE PASS |
| R5: No congelar el destello en el IBL | `viewport-env.js: _bakeEnv` excluye flash | CS-07 | NODE PASS |
| R6: Edit estático, Play/Runtime evolutivo | `viewport.js` y `scene-graph.js` SIN CAMBIOS de temporalidad | CS-08 + S01 suite | NODE PASS; visual pendiente |
| R7: Sin nuevas texturas/materiales con licencias dudosas | diff sin assets de referencia ni dependencias | revisión ZIP | PASS fuente |
| R8: No afectar agua | sin cambios `src/engine/runtime/geometry/waterworld.js`, ni WaterLab | manifiesto CHANGE | PASS fuente |

Ledger actualizado sin eliminar filas históricas: `docs/qa/LevelForge_DB_Ledger.xlsx` (ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY). El nuevo Gate sigue pendiente de aprobación y cierre.
