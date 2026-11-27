# LF-RUNTIME-S00-G001 — Manifest y continuidad

**Objetivo:** erradicar la *aplicación/lanzador* denominado Player del baseline de LevelForge, sustituyendo sus **rutas** por las del Runtime autónomo y conservando los comportamientos que ejecutan juegos exportados.

## Cambios de identidad comprobables

| Antes | Después | Tratamiento |
|---|---|---|
| `src/player:deprecated/main.js` | `src/runtime-app/main.js` | Mover y actualizar import del componente |
| `src/player:deprecated/PlayerApp.vue` | `src/runtime-app/RuntimeApp.vue` | Mover, bridge de Runtime |
| `src/player:deprecated/storage.js` | `src/runtime-app/storage.js` | Mover, bridge de Runtime |
| `electron/player/main.cjs` | `electron/runtime/main.cjs` | Mover y actualizar navegación y canales IPC |
| `electron/player/preload.cjs` | `electron/runtime/preload.cjs` | Mover, `window.lfRuntime` |
| `electron/player/saves.cjs` | `electron/runtime/saves.cjs` | Mover, guardados conservados |
| `player.html` | `runtime.html` | Entrada Vite autónoma |
| `dist-player/` | salida derivada `dist-runtime/` | Eliminar artefactos anteriores, no empacar distribución precompilada |
| `vite build --mode player` | `vite build --mode runtime` | Configuración y scripts |

## Autoridades y exclusiones

- `src/engine/runtime/` se conserva como núcleo. `src/engine/runtime/player/` **no** es el shell heredado; aloja APIs y controladores de personaje, y permanece intacto.
- No hay refactor de SceneGraph, rendering, Timeline, cámara, Jolt, scripts, empaquetado `game.rtpkg`, guardados ni proyectos del usuario.
- La documentación histórica/contratos de los Gates anteriores se preserva. El README marca sus rutas obsoletas como históricas.
- `SOURCE_BASELINE` íntegro y `CHANGE ZIP` incremental se generan con manifest de altas, modificaciones y bajas y controles SHA-256; no se entregan builds ni cachés.

## Criterios de cierre aún no acreditados

- `npm ci` y `npm run build` con todas las dependencias y recursos de distribución presentes.
- Arranque `npm run electron` para validar el Editor y la exportación de un juego real a AppImage, incluida ejecución del paquete.
- QA de guardado/carga y bloqueo de red del AppImage resultante.
- Aprobación explícita del usuario tras QA local.
