# Arquitectura general y límites

Century es una aplicación editorial Vue/Electron y un núcleo JavaScript de escenas y ejecución que consume Three.js y Jolt WASM. El runtime empaquetado utiliza un host distinto al editorial; FilmMaker tiene su propia entrada.

## Contexto de aplicaciones

<pre>Editor Vue + Electron ── EDITOR_HOST ──┐
FilmMaker ── Editor / herramientas ────┤
Runtime autónomo ── PackageHost ────────┴─ SceneGraph / PlayMode
                                           ├─ Viewport / Three.js
                                           ├─ Jolt / física
                                           └─ Audio, UI, eventos, mundo</pre>

| Propietario | Ruta | Responsabilidad |
| --- | --- | --- |
| Entrada editorial | `src/main.js`, `src/App.vue` | Montaje Vue y composición de herramientas |
| Editor | `src/core/editor.js` | Extiende SceneGraph, añade autoría |
| Núcleo | `src/engine/runtime/scene-graph.js` | Escena viva y métodos de subsistemas |
| Sesión | `src/engine/runtime/events/play.js` | PlayMode y ciclo de juego |
| Distribución | `src/runtime-app/RuntimeApp.vue` | Apertura del paquete y UI de ejecución |

La herencia nominal no sustituye la composición de mixins. El objeto `Editor.player` es la sesión PlayMode, no el nodo CharacterBody3D. No trasladar dependencias de Vue, store o Electron al núcleo compartido para resolver una necesidad del host.

**Impacto:** contrastar Editor, GameGraph, FilmMaker y sus consumidores antes de modificar métodos compartidos. Pruebas: apertura de proyecto, start/stop, cambio de escena, exportación y dispose. No ejecutadas en esta edición.

