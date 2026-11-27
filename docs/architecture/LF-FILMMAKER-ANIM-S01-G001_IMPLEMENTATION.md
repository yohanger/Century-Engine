# LF-FILMMAKER-ANIM-S01-G001 — Modelo .nfm y previsualización reversible

Fecha: 2026-10-29 · Autoridad: «Aprobado el contrato S00. Listo. LF-FILMMAKER-ANIM-S01-G001 autoriza comenzar» · SOURCE_BASELINE de continuidad: `LevelForge_FILMMAKER_ANIM_S00_G001_SOURCE_BASELINE.zip`.

**Estado: IMPLEMENTADO; QA local, build y aprobación pendientes.** Contrato S00 expresamente aprobado por el usuario. El proyecto continúa basado en **nodos**, no ECS.

## Auditoría y causa raíz

- `montage.js/normalizeEdit` reconstruía `film.edit` sin ningún campo `nodeTracks`. Toda pista nueva habría sido eliminada al guardar.
- `.nfm` se encontraba en versión 2. `session.js` aplicaba overrides estáticos a la copia de trabajo, pero no disponía de evaluación reversible por ID ni de un snapshot de pose.
- `sampleTrack()` de `engine/runtime/anim/eval.js` es puro y admite curvas y easing. Se reutiliza ese evaluador sin implementar otro.
- `montageTimeline()` genera cámara, comandos y audio, pero su conversión de animaciones de nodos hacia Timeline/Player pertenece a S02-G002. La importación se bloquea si detecta nodeTracks para evitar pérdida silenciosa.

## Código modificado

1. `src/filmmaker/node-tracks.js` — nuevo modelo y evaluador editorial de tracks por ID. `normalizeNodeTracks` valida la identidad estable, props `position`, `rotation`, `scale`, IDs únicos, vec3 finitos, tiempos absolutos ordenados, claves en un mismo instante y ease/Bézier compatible con AnimModel. `sampleNodeTracks()` reutiliza el `sampleTrack()` real. No lanza eventos ni escribe en estado serializado.
2. `src/filmmaker/montage.js` — `normalizeEdit()` conserva `nodeTracks` al editar planos, capas, audio o transiciones; `filmEnd()` incorpora claves finales en el tiempo del montaje.
3. `src/filmmaker/film.js` — evolución `.nfm` **2 → 3**, conservando los demás campos y migrando v1/v2 sin `nodeTracks` a lista vacía. Las versiones futuras siguen rechazándose. `packNfm`/`unpackNfm` heredan normalización y serialización de `film.edit`.
4. `src/filmmaker/session.js` — `FilmNodePose` captura los transforms Three.js en memoria, los aplica desde un tiempo absoluto en cada `show(T)` del montaje y los restaura al parar, sustituir escena o montar un archivo. `FilmNodePose` no escribe `store.project.objects` ni llama a `updateObject`. Un nodo renombrado mantiene su vínculo por ID; un ID ausente o excluido informa y se omite, sin reasignación por nombre.
5. `src/core/state/film.js` — rechaza la importación de películas con `nodeTracks` hacia Cinemáticas LevelForge antes de que S02-G002 incorpore una conversión sin pérdida. Conserva el archivo `.nfm` como fuente de verdad y no exporta animaciones como overrides estáticos.
6. Pruebas de versionado heredado actualizadas a `.nfm` v3, verificando que la evolución es intencional y la compatibilidad de encuadres no se pierde.

## Política de Transform y física

- Local al padre; rotación en grados del esquema y Euler `YXZ` en Three.js. Posición y rotación de la raíz; escala de `visual` para primitivas y de raíz para Node3D/Grupo.
- El actor filmado y los nodos físicos `RigidBody3D`, `CharacterBody3D`, `StaticBody3D`, `CollisionShape3D`, `Area3D` y `gameplayObject` quedan excluidos de escritura temporal para evitar doble control con rigs, Jolt o el runtime. Se notifican como no compatibles en este Gate.
- No se cambia la simulación de Jolt; no hay bake ni física reversible hasta S02-G001.
- No se crean nodos, assets, café/vaso, presets, placeholders, ECS, nuevos renderers o comandos de Event Order Flow.

## Persistencia y alcance

Los tracks se guardan dentro de `film.edit.nodeTracks`, nunca dentro de `scene.lfproj`, `overrides`, Assets ni el Transform de la escena. El tiempo `T` se mide en segundos absolutos del montaje y puede abarcar varios cortes de cámara. Las pistas huérfanas se conservan en el `.nfm`; UI de reasignación explícita y Auto-key quedan para S01-G002.

S01-G001 **no** implementa botones «Animar», pistas visuales dinámicas ni Undo/Redo de película, que pertenecen a S01-G002. La conversión a Cinemáticas/Player pertenece a S02-G002; hasta entonces el código la bloquea con mensaje explícito.

## Evidencia

- Node: **129/129 PASS**, 10 pruebas nuevas de esquema/seek/transform + 119 de regresión.
- `scripts/test-filmmaker-anim-zip-s01-g001.mjs`: test de `packNfm`/`unpackNfm` con JSZip real añadido, **NO EJECUTADO** porque la dependencia no está instalada en el contenedor.
- Compilación Vite/Electron, reproducción 3D real, performance, QA del usuario: **NO VERIFICADOS**. No se declara Gate aprobado ni cerrado.
