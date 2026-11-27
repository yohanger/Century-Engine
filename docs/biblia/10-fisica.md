# Física, jugador, entrada y cámaras

`src/engine/runtime/physics/jolt.js` carga WASM y posee `JoltWorld`; `jolt-character.js`, `jolt-sensors.js`, `node-bodies.js`, `node-spatial.js`, `shapes.js` y `trimesh-source.js` distribuyen cuerpos, sensores, formas y fuentes geométricas. `nodes/physics.js` registra tipos físicos. El collider editorial (`src/core/editor/collider.js`) es una herramienta de autoría y no un segundo mundo físico.

## Gameplay

`events/play.js` posee sesión, `play-player.js` el handle del jugador nativo y `play-nodes.js` los handles de nodos. `src/core/project.js` resuelve la identidad de CharacterBody3D de escena. `input/inputmap.js`, `events/play-input.js` y `InputMapPanel.vue` enlazan acciones con entrada. `events/play-camera.js` orquesta solicitudes de cámara; `timeline/eval.js` consume el mecanismo en vez de reemplazarlo. `interaction/` y `events/play-held-actions.js` contienen rutas de interacción.

<pre>InputMap → PlayMode → CharacterBody3D / Jolt
                   → autoridad de cámara → Viewport
                   → señales / interacción</pre>

El antiguo handle FPS mantiene discrepancias de declaración: `jumpNow`, `swimming`, `underwater`, `camera` y otras propiedades no se identificaron en el handle nativo anterior auditado; `pitch` y retornos de Input también requieren contrastar contratos. Consultar `docs/architecture/CENTURY-DOCUMENTATION-API-S01-G001-INTEGRAL-DOCUMENTATION-AND-SCRIPT-INTELLIGENCE_EDITORIAL_CONTINUATION.md`. No se resuelven mediante documentación.

**Impacto:** probar movimiento, formas, sensores, scripts, cambio de escena, cámara y ejecución empaquetada. Spawn diferido y cámara efectiva tienen reglas contractuales propias.

