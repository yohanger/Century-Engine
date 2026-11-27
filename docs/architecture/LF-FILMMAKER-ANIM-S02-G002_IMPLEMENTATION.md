# LevelForge · LF-FILMMAKER-ANIM-S02-G002

## Estado

**Autorizado e implementado; NO CERRADO.** QA físico real de Jolt WASM, compilación Vite, ZIP JSZip y revisión Electron pendientes. Fuente: `LevelForge_FILMMAKER_ANIM_S02_G001_SOURCE_BASELINE.zip`. No se ha creado un motor de Timeline ni de física paralelo. Arquitectura **de nodos**, no ECS.

## Auditoría y hallazgos

- `filmmaker/montage.js` convertía cámara, comandos y audio, pero no `nodeTracks` ni `physicsBakes`.
- `core/timeline/model.js` admitía claves de propiedades vec3 y cámara; no admitía trayectoria quaternion de físicas.
- `TimelineRunner` evaluaba propiedades de nodos; el host del Player utilizaba fallback por nombre. Eso no es aceptable para referencias importadas por `nodeId`.
- `PlayMode` ejecuta Jolt en sus pasos físicos y escribe la pose de `RigidBody3D` en `_bodiesTick`; un bake no debe competir con ese escritor.
- `core/state/film.js` bloqueaba de forma preventiva la importación de películas con movimiento; su importación previa no guardaba en una transacción todo el estado mutado.
- `core/state/history.js` no incluía timelines y capturas en la instantánea; Undo no podía revertir correctamente una importación de película.

## Implementación

1. `filmmaker/montage-motion.js`: validación previa por ID, tipo y firma de colisiones tras overrides. Rechaza referencias huérfanas, cambios físicos no horneados y doble control de un nodo. Convierte pistas vec3 manteniendo las interpolaciones del sistema existente; etiqueta como `byId` las importadas.
2. `core/timeline/physics.js`: pista nativa `bake` por RigidBody3D, con `start`, `duration`, `hz:60`, muestras locales `{pos:[3],quat:[4]}`, límite de 30 s y evaluación por tiempo absoluto. SLERP de hemisferio corto con normalización; `undefined` antes del inicio y última pose después del fin.
3. `core/timeline/model.js` + `engine/runtime/timeline/eval.js`: normalización de pistas físicas y de interpolaciones manuales del AnimRunner, así como cálculo de duración de la cinemática y límite de dieciséis bakes.
4. `filmmaker/montage.js`: incorpora estas pistas en el Timeline de cámara, comandos y sonido, inclusive películas sin plano de cámara.
5. `engine/runtime/timeline/player.js`: aplica pistas manuales primero y bakes después con precedencia física. Solo evalúa muestras; no invoca Jolt para simular un instante.
6. `engine/runtime/events/play-timeline.js`: identidad estricta por `nodeId`, propiedad exclusiva de cuerpo horneado por cinemática, cambio de motion type a cinemático, teletransporte de la muestra en Jolt y restauración de pose/velocidades y motion type dinámico al finalizar, parar, omitir o resetear.
7. `engine/runtime/events/play-bodies.js` / `play-controls.js`: el cuerpo cuyo bake está activo no recibe fuerzas de flotación ni vuelve a sincronizarse desde Jolt; al final del fotograma la pose de la película se reafirma frente a scripts ajenos.
8. `core/state/film.js`: preflight de película y conversión antes de tocar objetos; rollback de metadatos y assets añadidos si falla la importación; un único commit al terminar correctamente. Las pistas no se reasignan por nombre.
9. `core/state/history.js`: Undo/Redo de Timeline, capturas, modelos, assets y ajustes de sonido/render/profiles asociados al proyecto, además de sus objetos anteriores.
10. `components/TimelinePanel.vue`: bakes importados visibles como regiones no editables, preview por muestras sin simular Jolt, preservación de la pose base y edición explícita de pistas vinculadas por ID.

## Política de controlador

- Durante una cinemática con bake, la misma instancia `RigidBody3D` existe en Jolt pero pasa a **kinematic**. Jolt no integra su movimiento como cuerpo dinámico; se actualizan sus posiciones mediante muestras horneadas y se mantienen las colisiones del juego.
- No puede haber dos cinemáticas activas que posean el mismo ID de bake al mismo tiempo.
- Al terminar o cancelar, se devuelve a **dynamic**, restaurando la pose base y velocidades anteriores. El alcance no incluye generar nuevas simulaciones de impacto en ese momento.
- Las pistas manuales importadas utilizan IDs estrictos; las pistas históricas editadas por nombre mantienen el comportamiento anterior para no romper proyectos existentes.
- La evaluación del bake puede recorrerse hacia delante o atrás sin regenerar simulación física. No se disparan eventos nuevos por el propio bake.

## Persistencia y compatibilidad

- El archivo `.nfm` **sigue siendo versión 4**. No se cambia el contrato del editor de cine.
- El proyecto LevelForge guarda los bakes convertidos mediante las pistas del mismo Timeline nativo. Su normalizador conserva `samples`, `hz`, `start`, `duration` y `node` al guardar y abrir el proyecto.
- En el inspector de Timeline los bloques horneados son de solo lectura; para modificar la simulación hay que cambiar las condiciones en FilmMaker y volver a hornear.
- Para conservar consistencia, una firma física desactualizada **bloquea la importación** y exige rehorneado, sin aplicar cambios parciales.
- No se alteran VFX3D, recursos `.vfx`, Event Order Flow ni el sistema de nodos.

## Límites conocidos

- `LF-FILMMAKER-ANIM-S02-G001` ya había restringido el bake a formas físicas explícitas, 16 cuerpos dinámicos y 30 segundos; esos límites se conservan.
- En contenedor no hay `node_modules`: `vite: not found`. No es evidencia de compilación PASS, ni de Jolt WASM real ni de importación `.nfm` con JSZip.
- El rollback de assets elimina los blobs nuevos al fallar la importación; el Undo normal conserva el blob del asset para permitir Redo y puede dejar blobs no referenciados hasta mantenimiento posterior.
- La importación de capturas de actor conserva sus contratos anteriores y no convierte físicas a keyframes del esqueleto.
- Si el Player no inicia su mundo Jolt/cuerpo físico, una cinemática horneada informa error de cuerpo ausente; no simula una física alternativa.

## QA

Consultar `docs/qa/LF-FILMMAKER-ANIM-S02-G002_QA.md`. El Gate no se cerrará hasta que el usuario valide importación y ejecución reales.
