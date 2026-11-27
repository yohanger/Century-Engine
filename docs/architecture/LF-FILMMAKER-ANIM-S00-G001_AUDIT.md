# LevelForge — LF-FILMMAKER-ANIM-S00-G001 · Auditoría de animación

**Fecha:** 2026-10-29  
**Baseline verificado:** `LevelForge_FILMMAKER_UX_S01_G002_CORR-001_SOURCE_BASELINE.zip`  
**Autorización:** `Listo. LF-FILMMAKER-ANIM-S00-G001 autoriza comenzar`  
**Alcance:** auditoría y contrato **exclusivamente**; no hay cambios de producto ni de motor.

## 1. Evidencia inspeccionada

| Evidencia | Código real | Hallazgo verificable |
|---|---|---|
| NLE de Filmmaker | `src/filmmaker/NleTimeline.vue` | Filas fijas de Planos, Actor, Texto y Efectos; las filas de audio sí se agregan dinámicamente. No existe una pista de Transform vinculada a un nodo de escena. |
| Normalización del montaje | `src/filmmaker/montage.js`, `normalizeEdit()` | Conserva `shots`, `layers`, `filters`, `audio` y `outro`, pero devuelve exclusivamente esos campos. Cualquier pista nueva en `film.edit` **se perdería** al normalizar si no se amplía allí. |
| Formato de película | `src/filmmaker/film.js`, `normalizeFilm()` | `.nfm` versión 2; guarda `frame`, escena, tomas, pasadas, cambios estáticos `overrides` y `edit`. `overrides` son diferencias entre estados de objetos, **no keyframes en el tiempo**. |
| Origen de las poses | `src/filmmaker/session.js`, `mount()`, `currentFilm()` | La base de objetos se captura al montar escena; las diferencias estáticas se devuelven como overrides. Las poses de previsualización temporales no pueden contaminar ese diff. |
| Reproducción de montaje | `src/filmmaker/session.js`, `playMontage()`, `seekMontage()` | Reproduce pasadas de cámara, actor, entorno, color y audio; `seekMontage(T)` llama a `playMontage()` para recomenzar en T. La animación debe soportar sampling absoluto, no depender de avanzos acumulados. |
| Evaluador de Timeline | `src/core/timeline/model.js`, `src/engine/runtime/timeline/eval.js` | Ya admite pistas `node` para posición, rotación, escala y visibilidad; evalúa claves con `evalNode()`. |
| Runner cinematográfico | `src/engine/runtime/timeline/player.js` | `TimelineRunner` aplica pistas de cámara y nodos y dispara comandos/audio por avance; `seek()` cambia tiempo y aplica pose. No hay en Filmmaker integración directa de sus pistas de objeto al montaje. |
| Referencias de Timeline existentes | `src/components/TimelinePanel.vue`, `src/engine/runtime/events/play-timeline.js` | Las pistas `node` históricas referencian por **nombre** (`tr.node`), resolviendo con búsqueda; nombres repetidos y renombrados son un riesgo de identidad. |
| Editor de Animaciones | `src/components/AnimationPanel.vue` | **Existe auto-key**: al activar grabación, mover nodos con el gizmo/Inspector crea claves de posición/rotación/escala y restaura la pose base. No debe duplicarse esta UX. |
| Animación reutilizable | `src/engine/runtime/anim/model.js`, `eval.js` | `PROPS`, `newTrack`, `newKey`, `normalizeClip`, `sampleTrack`, curvas linear/inOut/bezier/bounce/etc. Sin embargo las rutas de clips se basan en trayectos de nombres; requerirá un adaptador por ID para Filmmaker. |
| Undo/Redo | `src/core/state/history.js`, `src/filmmaker/session.js` | El historial principal registra objetos, materiales y configuración del editor; **no incluye `session.film.edit`**. `setEdit()` sustituye `edit` sin crear una entrada específica de Undo para la película. |
| Física explícita | `src/engine/runtime/nodes/physics.js`, `src/engine/runtime/physics/node-body-plan.js`, `node-bodies.js` | Existen `RigidBody3D`, `StaticBody3D`, `CollisionShape3D` y Jolt. Un cuerpo dinámico solo se crea si dispone de forma de colisión válida. |
| Puente de exportación | `src/filmmaker/montage.js`, `montageTimeline()` | Ya transforma montaje en una cinemática LevelForge con pistas de cámara y comandos. Es el lugar de integración a evaluar para las nuevas pistas de nodos y su exportación. |
| VFX | Arquitectura vigente: `VFX3D` y recurso `.vfx` | Las animaciones pueden posicionar el **nodo** VFX3D mediante Transform; los emisores y simulaciones siguen dentro de su nodo, sin nuevo motor VFX. |

## 2. Diagnóstico de raíz

1. **NLE orientado a montaje:** las filas visuales de Filmmaker no representan nodos arbitrarios, aunque LevelForge sí tenga editores/evaluadores de animación por nodos.
2. **Brecha de persistencia:** `normalizeEdit()` descartaría nuevas pistas y `normalizeFilm()` no conserva una colección de animaciones de nodos definida fuera del esquema actual.
3. **Brecha de identidad:** algunas pistas cinematográficas antiguas usan nombres de nodos y pueden resultar ambiguas; las nuevas deben utilizar IDs persistentes sin romper las existentes.
4. **Brecha de temporalidad:** `overrides` significa configuración fija de escena; no debe utilizarse para almacenar estados dependientes del cabezal.
5. **Brecha de aislamiento:** los previews pueden modificar momentáneamente `SceneGraph`, pero deben restaurar la pose base al parar o salir, sin guardar esa pose como override.
6. **Brecha de control físico:** una simulación Jolt no es reversible por simple `seek(t)` y no debe competir por el Transform con una pista de animación.
7. **Brecha de Undo:** la edición de secuencias de Filmmaker requiere historial de película por operación/gesto; el historial del Editor no cubre automáticamente `film.edit`.

## 3. Elementos que NO deben interpretarse como implementados

- Pistas dinámicas por cada nodo dentro de NLE.
- Animación de Transform del vaso desde Filmmaker.
- Grabación automática de keyframes de Filmmaker desde el gizmo.
- Simulación física horneada, reproducible y reversible en el timeline de Film Maker.
- Persistencia del nuevo formato de pistas en `.nfm`.
- Exportación de estas nuevas pistas a runtime, Godot u otro formato.

## 4. Verificación del baseline

- ZIP de origen: **1.058 entradas**, lectura CRC sin errores.
- Código modificado por este Gate: **0 archivos**.
- Evidencia de ejecución nueva: **auditoría estática de código**, sin batería de animación ejecutada ni compilación.
- Los resultados anteriores de otros Gates no se reetiquetan como resultados nuevos de S00.
