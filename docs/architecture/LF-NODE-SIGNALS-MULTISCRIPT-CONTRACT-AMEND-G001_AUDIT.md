# LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001 — Auditoría vinculante

**Proyecto:** LevelForge 0.26.13  
**Fecha de auditoría:** 2026-11-02  
**Autorización exacta:** `Listo. LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001 autoriza comenzar`  
**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_EDITOR_S06_G004_QA_APPROVAL_SOURCE_BASELINE(1).zip` (1.533 archivos; ZIP íntegro).  
**Otra referencia adjunta:** `LevelForge_NODE_REFERENCES_SIGNALS_AUDIT_G001_SOURCE_BASELINE(1).zip` (1.479 archivos); anterior, NO se fusiona ni sustituye a G004.  
**Tipo:** auditoría y Contract Amendment; ningún archivo de producción editado.  
**Evidencia de usuario:** captura `image(20261102-130322).png` y solicitud de corrección UX, señales por tipo de nodo, retirada de pestaña Terreno y varios Scripts de Nodo.

## 1. Observaciones comprobadas directamente

| ID | Estado | Archivo / evidencia | Resultado y alcance |
|---|---|---|---|
| OBS-01 | OBSERVADO | `src/components/SignalConnectionsPanel.vue` | El catálogo `nativeSignals` solo devuelve `body_entered`, `body_exited`, `area_entered` y `area_exited` para `type === 'area3d'`. Un StaticBody3D no recibe entradas nativas en el panel. |
| OBS-02 | OBSERVADO | `SignalConnectionsPanel.vue` | `customSignals` procede únicamente de `outgoing`, es decir, conexiones persistentes existentes. Una señal custom declarada en el script, sin conexiones, no aparece. |
| OBS-03 | OBSERVADO | Captura de usuario | El panel de `SM_Acera` muestra cajas de cabecera, búsqueda, una sección `PERSONALIZADAS` vacía y botón «Conectar señal», sin catálogo de señales del nodo. La valoración «poco profesional» es una valoración de UX del usuario, no un error de runtime acreditado. |
| OBS-04 | OBSERVADO | `src/components/InspectorDock.vue` | Las pestañas actuales son Inspector, Señales y Terreno; las herramientas Malla y Pintura aparecen en modos contextuales. `TerrainPanel.vue` tiene controles de terreno, generación, materiales, vegetación e hidrología que no se deben eliminar. |
| OBS-05 | OBSERVADO | `src/components/Inspector.vue` | La sección Script tiene un `select` vinculado a `obj.scriptId`, un único `assignedScript` y Drop/Agregar/Quitar/Editar de un único recurso. |
| OBS-06 | OBSERVADO | `src/components/SceneTree.vue` | El indicador y el doble clic sobre script utilizan únicamente `o.scriptId`. La integración DnD de Script asigna un solo ID. |
| OBS-07 | OBSERVADO | `src/engine/runtime/scene/node-scripts.js` | `instances` es un mapa por ID de nodo; `enter()` resuelve `obj.scriptId` y crea una sola instancia, métodos, callbacks, señales y suscripciones para ese nodo. No hay ejecución de múltiples scripts. |
| OBS-08 | OBSERVADO | `src/engine/runtime/scene/node-lifecycle.js` | Los cambios se detectan comparando `scriptId` y la identidad del nodo. Los callbacks periódicos usan el registro optimizado de nodos con función presente. |
| OBS-09 | OBSERVADO | `src/engine/runtime/nodes/index.js`, `src/core/levelpackage.js` | Los nodos nuevos incluyen `scriptId: ''`; la importación remapea `scriptId` como referencia escalar, no una lista. |
| OBS-10 | OBSERVADO | `src/engine/runtime/nodes/registry.js`, `nodes/base.js`, `nodes/physics.js` | `registerNode` solo reconoce bases `Node` o `Node3D`; los nodos físicos se registran con base `Node3D`, no con la herencia de clases de Godot. No existe aún un árbol de herencia de señales por tipo que pueda simplemente activarse visualmente. |
| OBS-11 | OBSERVADO | `docs/architecture/LF-NODE-SIGNALS-EDITOR-S06-G001_CONTRACT.md`, G003 | Los contratos previos aceptan expresamente una presentación por secciones Nativas/Personalizadas y entrada manual como caso principal. La nueva decisión de UX los supera parcialmente. |
| OBS-12 | OBSERVADO | `docs/architecture/LF-NODE-SCRIPT-S05-G001_CONTRACT.md`, `LF-NODE-SCRIPT-METHOD-CALL-S02-G001_CONTRACT.md` | Los contratos vinculan instancia a un `scriptId` y describen un método público por instancia. Ampliarlo a varios scripts cambia cardinalidad, identidad y resolución de nombres; requiere Amendment. |
| OBS-13 | OBSERVADO | `src/engine/runtime/scene/node-scripts.js`, `LF-NODE-CUSTOM-SIGNALS-S04-G001_CONTRACT.md` | `node.expose()` y `node.define_signal()` son dinámicos. No se puede obtener un catálogo estático completo sin metadata adicional o verificación runtime. |
| OBS-14 | OBSERVADO | SOURCE_BASELINE G004, ledger | S06-G004 está aprobado por el usuario con QA local declarado. Electron/build automatizados siguen NO VERIFICADOS en el entorno anterior; la aprobación histórica no se borra ni se convierte en evidencia de estas nuevas funcionalidades. |

## 2. Diagnóstico diferenciado

- **CAUSA RAÍZ de la lista vacía de `SM_Acera`:** el filtro `nativeSignals` es exclusivo de Area3D y `customSignals` se deriva solo de enlaces existentes; no hay inventario editorial de señales nativas por tipo/categoría ni inventario de las señales custom no conectadas.
- **CAUSA RAÍZ del slot único:** el modelo de nodo persiste un solo `scriptId`, `NodeLifecycle` compara solo esa propiedad y `NodeScriptRuntime` instancia uno por nodo. No es un simple límite CSS.
- **INFERENCIA a validar en QA visual:** el predominio de tarjetas, mensajes y formulario tiene peor densidad y navegación que un árbol de señales estilo Godot. Es una nueva prioridad UX explícita del usuario, no justificación para reescribir todos los docks.
- **CONTRADICCIÓN CONTRACTUAL:** el acuerdo visual G001/G003 es menos estricto que el nuevo diseño requerido, y el modelo S05/S02 presupone cardinalidad única. Este Amendment **supersede las cláusulas precisas** especificadas en el documento de enmienda; no anula las pruebas, los hitos ni las funciones aprobadas anteriormente.

## 3. Referencia oficial contrastada (no copiar código ni recursos)

- Godot 4.x, uso de señales (panel, doble clic y diálogo): https://docs.godotengine.org/es/4.x/getting_started/step_by_step/signals.html
- Godot 4.x, señales comunes de Node: https://docs.godotengine.org/es/4.x/classes/class_node.html
- Godot 4.x, StaticBody3D y su cadena de herencia: https://docs.godotengine.org/es/4.x/classes/class_staticbody3d.html
- Godot 4.x, CollisionObject3D: https://docs.godotengine.org/es/4.x/classes/class_collisionobject3d.html

**Diferencia relevante:** la herencia documentada de Godot no es la implementación real de LevelForge. Los nombres de señales Godot son referencia UX/API, no pruebas de que LevelForge los emita. Por ejemplo, las señales de `Node` y `CollisionObject3D` requieren puentes explícitos y sus correspondientes emisores reales antes de mostrarse como funcionales.

## 4. Inventario de dependencias de implementación futura (NO AUTORIZADA)

- **Datos y compatibilidad:** `src/engine/runtime/nodes/index.js`, `src/core/project.js`, `src/core/state/{project,objects,prefabs,history}.js`, `src/core/lfproj.js`, `src/core/levelpackage*.js`, Player y exportación.
- **Runtime:** `src/engine/runtime/scene/{node-scripts,node-lifecycle}.js`, `src/engine/runtime/events/{play,play-nodes}.js`, S01 referencia, S02 call, S03 Group, S04 Signals, S05 Area3D, S06 conexiones persistidas.
- **UI:** `src/components/{InspectorDock,Inspector,SceneTree,SignalConnectionsPanel,TerrainPanel}.vue`; selección y preferencias existentes del Editor, sin duplicación.
- **API/documentación:** `src/core/events/game-api.d.ts`, `vscode-extension/media/game-api.d.ts`, `docs/referencia/api.md` y contratos de QA.
- **Rendimiento:** hardware N5030 / 4 GB; prohibido introducir un recorrido de todos los scripts en cada fotograma para comprobar callbacks ausentes.

## 5. Resultado

**AUDITORÍA DOCUMENTAL COMPLETADA.** Cambios de producción: 0. Pruebas Node/Electron/build nuevas: **NO EJECUTADAS (no necesarias para este Gate exclusivamente documental)**. El Amendment define un contrato, no una implementación validada. QA contractual del usuario y cierre formal de este Gate: pendientes.
