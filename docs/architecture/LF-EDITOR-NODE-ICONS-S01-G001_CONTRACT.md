# LF-EDITOR-NODE-ICONS-S01-G001 — Iconografía de nodos

**Fecha:** 2026-10-28  
**Gate:** autorizado; implementación terminada; QA local pendiente.  
**SOURCE_BASELINE de entrada:** `LevelForge_NODE_SCRIPT_S05_G001_CORR-001_SOURCE_BASELINE.zip` (977 archivos).

## Objetivo

Cada tipo de nodo del registro de LevelForge, y sus variantes visualmente relevantes, debe disponer de un icono SVG semántico en el Scene Tree, el Inspector y el menú Añadir. El cubo representa una primitiva cúbica, no un símbolo universal para cualquier nodo. La referencia conceptual es Godot; los trazos son propios del proyecto.

## Mecanismo existente reutilizado

- `src/components/Icon.vue`: paths SVG inline de 24 × 24, con `currentColor`, grosor uniforme y tamaños que decide cada consumidor. Se definen iconos para Node/Node3D, cuerpos Jolt, sus tres formas, Sprite2D/3D, CameraShake, Gameplay Object, Substract y variantes de malla, luz, audio y agua. Dos claves SVG `ramp/tree` previamente duplicadas se consolidan sin cambiar el dibujo anterior que realmente utilizaba la UI; el antiguo árbol vegetal pasa a `foliage-tree`, sin reemplazar el icono jerárquico `tree`.
- `src/engine/runtime/nodes/registry.js`: se conserva como única fuente de metadatos `icon` y `kinds[].icon`; no se altera su implementación ni se añade otro catálogo.
- `src/engine/runtime/nodes/index.js`: `kindIcon()` sigue resolviendo tipos/variantes con la ruta vigente.
- `src/components/SceneTree.vue`, `Inspector.vue` y `AddModal.vue`: continúan utilizando el mismo registro. Solo se actualiza presentación de iconos y colores semánticos en el árbol, sin cambiar su altura, virtualización, selección, reparenting ni las acciones.
- `src/engine/runtime/mesh/generators.js`: únicamente se distinguen metadatos de iconografía (`grid`, `circle`, `torus`); los generadores de geometría permanecen idénticos.
- `src/engine/runtime/nodes/physics.js`, `sprite.js`, `light.js`, `water.js`, `audio.js`, `decal.js`, `gameplay-object.js`, `subtract.js`, `camera-shake.js`: cambios exclusivamente de metadatos visuales de tipos y variantes; sin modificar sus funciones de creación, construcción, sincronización ni física.

## Variantes con icono individual

| Familia | Iconos |
|---|---|
| Base | `network`, `move-3d` |
| Física | `static-body`, `rigid-body`, `character-body`, `area3d` |
| CollisionShape | `shape-box`, `shape-sphere`, `shape-capsule` |
| Especializados | `subtract`, `gameplay-object`, `camera-shake`, `decal` |
| Sprite | `sprite2d`, `sprite3d`, `pixel`, `pixel3d` |
| Mallas | `mesh-grid`, `mesh-circle`, `mesh-torus`, más los iconos geométricos existentes |
| Iluminación | `light-area`, `light-candle`, `light-torch`, `light-neon`, `light-strobe`, `sun`, `spot`, `light` |
| Agua | `water-ocean`, `water-river`, `water-circle`, `water` |
| Audio | `audio`, `audio-ui` |

## Invariantes y restricciones

No se introduce otra biblioteca de iconos, iconos binarios, dependencias, duplicación de registros ni clases ECS. No se modifica Jolt, el Player, el Game Loop, la jerarquía, el sistema de scripts o Event Order Flow. Los 49 archivos protegidos de eventos se conservan byte a byte. El HUB y Assets Browser **no forman parte** de S01 y quedan para S02/S03.

## Aceptación

Pruebas `NI-01..NI-15`, 107 suites de regresión, comparación binaria contra el baseline y QA de iconos en Scene Tree/Inspector/menú Añadir por el usuario. Se podrá cerrar solo con QA local satisfactorio y aprobación del usuario.
