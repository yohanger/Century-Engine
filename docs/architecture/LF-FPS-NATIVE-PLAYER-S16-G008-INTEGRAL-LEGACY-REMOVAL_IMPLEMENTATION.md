# G008 — Retirada integral del FPS heredado

**Estado de entrega:** IMPLEMENTADO EN FUENTES; TEST AUTOMATIZADO PASS; COMPILACIÓN/QA LOCAL PENDIENTES.

**SOURCE_BASELINE de origen:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G004_SAVE_LOAD_INTEGRAL_SOURCE_BASELINE.zip`.

**Autorización exacta:** `Listo. LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL autoriza comenzar`.
**Contract Amendment:** `LF-FPS-NATIVE-PLAYER-S16-G008-CA-001-LEGACY-RETIREMENT`, RATIFICADO.

## OBSERVADO EN CÓDIGO DE ORIGEN

- `events/play.js` seleccionaba `FpsPlayer` cuando faltaba `playerNodeId`, aunque ya existían cuerpos nativos y `game.spawnPlayer()`.
- `core/templates/index.js` generaba Spawn en la plantilla First Person, junto al Prefab nativo de Assets.
- `player/fps/hands*.js` era dueño de las operaciones de manos que el Player nativo ya utilizaba a través de `PlayerController`.
- `events/play-level.js` y el registro de nodos empleaban el tipo Spawn como marcador de llegada para proyectos históricos.
- `events/play-input.js` delegaba la orientación del mando en un tipo FPS retirado, en lugar de la Camera3D nativa.
- Viewport/Inspector, perfiles, menú Añadir, teletransporte y rutas consumían algunas de estas semánticas. Su ajuste se limita a este Gate.

## Implementación ejecutada

| Propietario | Cambio | Intención |
|---|---|---|
| `player/index.js` | Elimina registro/instanciación de FpsPlayer; opciones GameManager `native`/`none`. | Un jugador físico nativo; NoPlayer conserva solo interfaz compartida. |
| `player/fps/` y `player/viewmodel/` | Retira los ocho módulos exclusivos FPS y mueve los cuatro `hands*.js` sin duplicar implementación. | Preservar ViewModel, stash, Drop/Throw y slots Database. |
| `events/play.js`, `play-player.js` y `play-route.js` | Ausencia de identidad implica sin jugador; ruta y teleport requieren cuerpo nativo. | Ningún fallback implícito. |
| `events/play-input.js` | Rotación del mando se aplica al CharacterBody3D y Camera3D seleccionados. | Un solo dueño de orientación. |
| `events/play-saves.js` | Los snapshots nuevos sin Player son `mode: none`; lectura histórica legacy no crea controlador FPS. | Preservar campos de save y política ratificada. |
| `core/templates/index.js` y `core/project.js` | Plantilla FPS crea sol y Prefab en Assets, sin Spawn automático. | El usuario construye el jugador desde el Editor. |
| `nodes/spawn.js`, catálogo y comandos | Spawn no es creable; mantiene registro/lectura y animación para proyectos existentes. | No borrar nodos guardados ni dejar importadores huérfanos. |
| `events/play-level.js` y `play-nodes.js` | Marcadores de llegada pueden ser nodos comunes por nombre/tag; Spawn antiguos se reconocen. | Mantener teletransporte/cambio de escena sin exigir un nodo temporal. |
| `components` y `core/state` | Inspector, GameManager, exportación y textos ajustados a identidad nativa. | UI y avisos coherentes, sin modificar autoría. |
| `vscode-extension` | Declaraciones sincronizadas y VSIX offline 0.1.12 validada por CRC. | Correspondencia Editor/VS Code; empaquetado oficial no ejecutable aquí. |

## Compatibilidad de proyectos preexistentes

Se preservan objetos de tipo `spawn`, marcadores y etiquetas, sus propiedades, escenas, referencias y archivos. No hay migración ni borrado automático. Sin embargo, las escenas antiguas que dependían de un `FpsPlayer` implícito **ya no tendrán jugador al ejecutarse hasta que se configure uno nativo**. Esto no debe describirse como compatibilidad funcional retrospectiva total; el Amendment eliminó expresamente el fallback. Las partidas antiguas conservan su estado lógico sin recrear un controlador prohibido.

## Contradicciones y límites

- ID16-02 y SPN-01: regla transitoria de fallback **SUPERSEDIDA SOLO EN ESE PUNTO** por G008 CA-001.
- El tipo de nodo Spawn permanece registrado para compatibilidad de datos, pero no se ofrece para añadir ni se crea en nuevos proyectos. No debe borrarse de import/export sin otro mecanismo ratificado.
- El proyecto tiene múltiples pruebas históricas ajenas al Player: la selección ampliada mantiene 20 FAIL existentes (19 nombres distintos). No se retocó código ajeno para hacerlos desaparecer.
- `npm run build` no pudo compilar: falta Vite (`vite: not found`); empaquetado oficial VS Code no pudo verificarse (`ERR_MODULE_NOT_FOUND` de jszip). VSIX offline pasó CRC y se comprobó su contenido.
- No hay evidencia de QA visual, WASM Jolt real, FPS, exportación ni NGM Runtime independiente. No se declara CERRADO.

## Siguiente acción

QA local del usuario según `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL_QA.md`. Corregir en este mismo Gate cualquier falla atribuible; no iniciar G009 antes de la aprobación y pruebas de integración pertinentes.
