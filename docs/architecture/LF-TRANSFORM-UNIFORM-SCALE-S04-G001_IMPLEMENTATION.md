# LF-TRANSFORM-UNIFORM-SCALE-S04-G001 — Contrato e implementación

**Autorización:** `Listo. LF-TRANSFORM-UNIFORM-SCALE-S04-G001 autoriza comenzar`.  
**Fuente:** archivo adjunto `LevelForge_UI_DESIGNER_UX_S03_G001_SOURCE_BASELINE(1).zip`.  
**Modalidad:** Sprint S04, Gate único con QA y documentación.

## Auditoría inicial

**OBSERVADO:** `Inspector.vue` editaba XYZ absolutos con `Vec3Field`; `src/core/state/objects.js::updateObject` aplica `enforceLink()` a primitivas y `validateNodeTree()` a cuerpos físicos. `keys.js` reservaba R para gizmo de escala, mientras que S estaba libre en Object Mode. `gizmo.js` emplea raíces seleccionadas y un pivote en coordenadas mundiales. `MeshPanel.vue` y `session-xform.js` ya permiten escala por eje mediante `_xform()` y `numericDraft`. `session-modal.js` ya ofrece `S` para geometría.

**INFERENCIA:** falta un control numérico uniforme de objeto y de malla; una ruta que establezca `[factor,factor,factor]` como escala absoluta no cumple el contrato.

**CAUSA RAÍZ:** ausencia de una operación multiplicativa con estado inicial congelado, no falta de un nuevo sistema de gizmos o un motor de malla.

## Mecanismo integrado

- `src/core/state/objects.js` extiende el módulo original con `beginUniformScale`, `applyUniformScale`, `finishUniformScale` y `cancelUniformScale`. La base conserva las escalas y posiciones locales, el pivote mundial inicial y las raíces seleccionadas. Cada preview recalcula desde ese estado, nunca multiplica el resultado del preview anterior. La prueba de toda la jerarquía se ejecuta antes del primer `updateObject`, y después se usan los mismos métodos de edición; no se reescribe el formato del proyecto.
- En selección múltiple, el centro de las raíces determina el pivote. Se calcula la nueva posición mundial y se convierte a local contra la matriz del padre; se omiten hijos de un ancestro ya seleccionado. La selección individual conserva su posición local. Se rechazan nodos sin escala, bloqueados, con ancestro bloqueado, escalas menores a 0.01, excesivas o no finitas y árboles físicos inválidos.
- `Inspector.vue`: campo **Escala ×** junto a los tres valores absolutos de Escala/Tamaño. `NumberField` emite vista previa sin historial y `commit` confirma una única operación. El cambio de selección revierte un gesto pendiente.
- `keys.js`: `S` en Object Mode inicia draft numérico. Enter confirma; Escape y pérdida de foco cancelan. Ctrl+S conserva guardado. Se mantiene `R` como selección del gizmo de escala. Un HUD temporal, no persistido, informa el factor activo mediante Toolbar.
- `session-xform.js` acepta `uniformScale` en `numericTransform`: reutiliza `_prepXform`, `_restoreBase`, `_xform` y `numericCommit`; no crea un segundo estado de vértices. `MeshPanel.vue` añade el control multiplicativo para selecciones de al menos dos vértices.
- `session-modal.js`: rechaza factor modal no finito, nulo o negativo; no modifica el algoritmo de geometría.

## Compatibilidad y límites

La escala de primitivas es tamaño geométrico, no un componente Transform paralelo. `enforceLink` mantiene círculos/sferas vinculados como antes. No se cambia `TransformControls`, la física Jolt, ni el runtime del Player. La validación con física se efectúa mediante el contrato existente; no se garantizan condiciones de escena no probadas localmente.

Las pruebas Node con `vm` ejecutan el cuerpo real de las funciones de estado y teclado frente a un pequeño entorno de matrices controlado. No son sustituto del montaje Vue, Three.js real, persistencia `.lfproj` ni Jolt. Las comprobaciones de compilación y QA local se indican separadamente en `docs/qa/LF-TRANSFORM-UNIFORM-SCALE-S04-G001_QA.md`.

**Siguiente Sprint planificado:** S05, realismo visual del agua. No se ha iniciado ni modificado en este Gate.
