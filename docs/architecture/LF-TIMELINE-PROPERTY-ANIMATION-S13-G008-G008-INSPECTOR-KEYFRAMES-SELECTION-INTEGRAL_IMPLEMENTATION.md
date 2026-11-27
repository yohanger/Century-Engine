# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-INSPECTOR-KEYFRAMES-SELECTION-INTEGRAL — Auditoría e implementación

Fecha: 2026-11-10. Estado: **IMPLEMENTADO EN FUENTES, NODE PASS, QA LOCAL PENDIENTE, NO APROBADO, NO CERRADO**.
Fuente base: `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G007_TEMPORAL_EVALUATION_INTEGRAL_SOURCE_BASELINE.zip`.
Contrato vinculante: G005 ratificado, CA-TB01-001 ratificado, G006 aprobado; G007 implementado pero pendiente de aprobación final, incluida su reserva ante acceso directo por `object3D`.

## OBSERVADO — evidencia de causa raíz

- Jerarquía (`src/components/SceneTree.vue`) llama `selectObject` incluso al pulsar el nodo ya seleccionado.
- El Inspector de recursos tiene prioridad sobre el de nodo en `InspectorDock.vue`. Esas prioridades responden a `store.temporalSelection` y `store.projSel`.
- En el SOURCE_BASELINE anterior, `selectObject` no limpiaba todos esos contextos; el watcher de `selectedId` solo corría si cambiaba el ID y además cubría algunos `projSel`.
- Cuando un recurso estaba seleccionado y se pulsaba el MISMO nodo, `selectedId` no cambiaba: el Inspector seguía mostrando el recurso. Es la causa raíz del caso reportado. La reproducción visual del Editor real queda para QA local.
- `src/core/timeline/model.js` ya aporta identidad escena+nodo+propiedad, creación de pista y validación de claves. `src/core/state/history.js` registra snapshots con Timelines.

## MODIFICACIONES IMPLEMENTADAS

1. `src/core/state/objects.js`: `selectObject` invalida inmediatamente `audioInspector`, `temporalSelection` y `projSel` al cambiar a Jerarquía, incluso cuando el ID es idéntico; devuelve el tab Inspector si procedía desde recurso. No crea estado de selección nuevo.
2. `src/core/state/state.js`: watcher de selección por viewport limpia también otros recursos persistentes al cambiar ID, sin crear reacción circular.
3. `src/core/timeline/model.js`: `upsertTimelineNodePropertyKey` reusa funciones G006; valida tiempo, tipo, nodo, escena, pista bloqueada y valor ANTES de alterar pistas; clave en mismo tiempo actualiza valor y conserva ID; sin duplicar.
4. `src/components/Inspector.vue`: usa `timelinePlaybackKey` inyectado para tiempo único y autoría manual junto a position, rotation, scale, light.energy, light.color. Sin Auto-Key. Recupera valor autoral, no valor temporal de render. Registra una transacción `commit` y notifica actualización del preview.
5. `src/components/Icon.vue`: amplía el catálogo visual existente con una llave; no introduce librería o gestor paralelo.
6. Pruebas: `scripts/test-timeline-property-animation-s13-g008-g008.mjs` (24 pruebas ejecutadas PASS); `scripts/test-timeline-property-animation-s13-g008-g008-electron.mjs` y fixture real Vue de InspectorDock (20 verificaciones declaradas, NO EJECUTADAS en contenedor).

## LÍMITES Y DEPENDENCIAS

- El Inspector muestra llave solo con Timeline editable activo, sin reproducción ni FilmMaker. Acceso a Light requiere el evaluador G007; G007 no está cerrado ni certifica todavía todos los escritores `object3D`.
- Transformaciones de rigidbody3d y characterbody3d no exponen llave; no se autoriza alterar Jolt.
- Las tres transformaciones se insertan como `vec3` completo para la fila Inspector; no se introduce autoría por eje individual dentro de este Gate.
- Visibility no se reintroduce como casilla redundante en el Inspector. Camera3D avanzada, Canvas, reglas cinematográficas, aspect ratio, Auto-Key y gizmo grabación pertenecen a Gates posteriores.
- La selección temporal sigue siendo válida cuando el usuario la invoca desde Timeline; solo el clic explícito en Jerarquía sustituye ese contexto.

## PRUEBAS Y EVIDENCIA REAL

- `node --test scripts/test-timeline-property-animation-s13-g008-g008.mjs`: 24/24 PASS.
- Batería seleccionada G008+G007+G006+GEO: 89/89 PASS.
- Syntax JS de módulos y fixture: PASS.
- Build Editor / Player: NO VERIFICADO (dependencias Vite/Three no instaladas en contenedor).
- Electron WebGL / interacción real: NO VERIFICADO; test preparado para 20 checks, no declarar PASS.
- QA local del usuario: PENDIENTE. Aprobación y cierre: PENDIENTES. No usar la ratificación documental G007 como aprobación funcional de G007.

## ACEPTACIÓN

Véase `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-INSPECTOR-KEYFRAMES-SELECTION-INTEGRAL_QA.md`: SEL-01..08, KEY-01..12; build y Electron visual obligatorios. Regresión de G007, incluida su exposición directa `object3D`, permanece pendiente por separado.
