# S13-G008-G006 — Catálogo tipado y persistencia de Timeline

**Gate autorizado:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G006-CATALOG-PERSISTENCE-INTEGRAL`.
**Contrato marco:** G005 RATIFICADO por el usuario; decisiones TB-01 y TB-03..07 permanecen abiertas. **TB-02: resuelta para almacenamiento, NO para evaluación temporal de canales nuevos.**
**Base de cambios:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G005_AUDIT_CONTRACT_SOURCE_BASELINE.zip` (2994 archivos; ZIP íntegro).
**Estado:** IMPLEMENTADO EN FUENTES; Node específico PASS; build, Electron, QA visual y Player independiente NO VERIFICADOS.

## 1. Código real auditado

- `src/engine/runtime/anim/model.js` ya define el único catálogo común `PROPS` de Animation Clips, con `vec3`, `bool`, `number`, `color`. No se crea otro catálogo de tipos o duplicado de Clip/Timeline.
- `src/core/timeline/model.js` contiene `NODE_PROPS`, `newKey`, `newTrack`, `normalizeKey`, `normalizeTrack`, `normalizeTimeline`, y metadatos de organización, clips, persistencia. La ruta de recursos `src/core/levelpackage.js`, `src/core/levelpackage-import.js` y `src/core/project.js` llama a `normalizeTimeline`; se reutiliza esa ruta.
- `src/components/TimelinePanel.vue` ofrece creación de pistas por arrastre desde Jerarquía. Se sustituye solo su decisión de existencia/creación por funciones del modelo; conserva UX de cuatro propiedades.
- `src/engine/runtime/timeline/eval.js` solo sabe evaluar `position`, `rotation`, `scale` y `visible`. Intentar interpolar `number` o `color` como `vec3` produciría un fallo `.map`. G006 se limita a neutralizar esa aplicación prematura devolviendo `undefined`; la evaluación real es G007.

## 2. Contrato técnico aplicado

### TA-01 — Metadatos compartidos y valores tipados

`PROPS` sigue siendo la referencia única de tipos/valores comunes; `timelinePropertySpec(prop)` devuelve la misma definición o `null`. No se fusionan formatos ni se activa un canal en Timeline por aparecer en Animation Clips. `timelineRuntime:true` identifica exclusivamente las cuatro propiedades que el evaluador actual entiende. No se introduce ninguna comprobación de Gates, Sprints o aprobaciones en producción.

`validatePropertyValue(prop,value)` exige `number` finito (y mínimos/máximos explícitos si existen), `vec3` de tres números finitos, `bool` estrictamente booleano y `color` hexadecimal `#rrggbb` (conversión a minúsculas). `light.energy` no admite valores negativos para claves tipadas nuevas. El normalizador de Clips no cambia, y no hay coerción silenciosa de datos nuevos inválidos a otro tipo. No se autoriza ruta arbitraria sobre `props` ni `.ui`.

### TA-02 — Canal único y persistencia

`ensureTimelineNodePropertyTrack(timeline,node,prop,sceneId,objects)` identifica la pista nueva por (`sceneId`,`nodeId`,`propertyId`) y devuelve una existente si coincide. Se acepta una pista antigua por nombre **únicamente si el nombre es inequívoco en la escena**; no se modifica su identidad, formato o `sceneId`. `newTimelinePropertyKey` crea una clave tipada validada con UID, tiempo finito no negativo y valor serializable.

`normalizeTrack` preserva `sceneId` solo cuando está declarado; exige ID de nodo y escena para propiedades nuevas no reproducibles aún. Conserva las pistas existentes sin `sceneId`. `normalizeTimeline` rechaza duplicaciones inequívocas de la triple identidad para pistas nuevas con escena; no fusiona pistas, claves, ni recursos históricos. Si `prop` está ausente, conserva el default antiguo `position`; un ID explícito no reconocido produce error en lugar de convertirse silenciosamente en otra propiedad.

`light.energy` y `light.color` pueden normalizarse, serializarse, duplicarse y guardarse como datos, pero **no se reproducen** ni aparecen como opciones nuevas de arrastre antes de su integración aprobada G007/G012. Tampoco se admiten `clips` sobre estos canales sin evaluador. Las pistas de transformaciones y visibilidad mantienen sus curvas e interpolaciones históricas; los tipos nuevos rechazan claves con tiempo o ID explícito inválidos.

## 3. Cambios específicos y no cambios

Modificados: `src/engine/runtime/anim/model.js`, `src/core/timeline/model.js`, `src/engine/runtime/timeline/eval.js`, `src/components/TimelinePanel.vue`, ledger de seis hojas.

Nuevos: test G006, este documento, QA e inventario de entrega.

**No modificados:** archivos `.ui`, proyectos y escenas, Camera Orchestration, Player FPS, FilmMaker/Cinematics, modelo/persistencia de Animation Clips, evaluadores de color/número y componentes Inspector del nodo. No se generan keyframes automáticamente, no se reescriben proyectos ni se incorporan migraciones retrospectivas.

## 4. Contratos pendientes para G007 y posteriores

- **TB-01 (bloqueante G007):** prioridad entre Timeline, scripts, Clips y Jolt; snapshots temporales; restauración/Stop/Skip/loop; invalidación y reentrada. No puede implementarse con último escritor gana.
- La lectura/aplicación temporal de `number`, `bool` genérico y `color`, sus interpolaciones y crossfades deben implementarse en G007 solo tras TB-01; la autorización G006 no las incluye.
- **TB-03 (G009):** Canvas.alpha e input/modal/script; **TB-04 (G010):** CAM-05; **TB-05 (G011):** ratio/barra/HUD; **TB-06 (G013):** preferencia tercios; **TB-07:** ownership de FilmMaker.
- La verificación de recursos ZIP reales depende de `jszip` instalado, Vite del proyecto y las pruebas de QA local; el contenedor actual carece de dependencias, y el AppImage exportado permanece NO VERIFICADO.

## 5. Continuidad

Tras QA local y aprobación del usuario, preparar la declaración G007. No autorizar G007 por anticipado ni cerrar G006 por compilación exclusivamente. Mantener código limpio, comentarios de Gate solo como trazabilidad y compatibilidad con proyectos vigentes.
