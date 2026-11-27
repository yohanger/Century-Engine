# LF-NODE-SIGNALS-EDITOR-S06-G001 — Auditoría de autoría visual

**Proyecto:** LevelForge 0.26.13 · **Fecha:** 2026-11-01  
**Autorización:** `Listo. LF-NODE-SIGNALS-EDITOR-S06-G001 autoriza comenzar`  
**SOURCE_BASELINE:** `LevelForge_NODE_AREA_SIGNAL_BRIDGE_S05_G001_SOURCE_BASELINE.zip` (1.511 entradas; ZIP íntegro)  
**Naturaleza:** auditoría documental. No modifica producción, formatos, UI, persistencia ni scripts auxiliares.

## 1. Inventario observado en código real

| Identificador | Evidencia revisada | Observado / Consecuencia contractual |
|---|---|---|
| OBS-01 | `src/components/InspectorDock.vue` | Dock derecho ya existe, con pestañas Inspector/Terreno y Malla/Pintura contextuales; `store.prefs.rightTab` guarda la selección. La pestaña Señales deberá reutilizarlo, no abrir otro editor. |
| OBS-02 | `src/components/Inspector.vue`; `src/components/SceneTree.vue`; `src/core/state/state.js` | Selección central mediante `store.selectedId`, recursos vía `store.projSel`. Solo un nodo válido tendrá señales editables; en recursos o selección vacía se mostrará estado informativo. |
| OBS-03 | `src/engine/runtime/scene/node-scripts.js` | `node.define_signal()` y `node.expose()` registran nombres durante evaluación del script **por instancia**. No existe catálogo estático exhaustivo del Editor. `connectSignal`/`disconnectSignal` y despachador ya existen. |
| OBS-04 | `src/engine/runtime/physics/node-spatial.js` + contrato S05 | Area3D ofrece `body_entered`, `body_exited`, `area_entered`, `area_exited` mediante Jolt. No necesita script en emisor. |
| OBS-05 | `src/core/project.js`: `SCENE_KEYS`, `splitProject()`, `createSceneContent()`, `migrateScene()` | La escena persistente actual tiene `objects`, `environment` y `terrain`; no serializa conexiones de escena. Campo adicional necesita integración explícita en los productores/consumidores, no solo asignarlo al store. |
| OBS-06 | `src/core/state/project.js`: `serializeProject()`, `readProject()`, `switchScene()`, `collectScenes()`, duplicación de escena | Save/Load y los cambios de escena reconstruyen la escena con tres campos; deben incluir las conexiones tanto en escena activa como en las almacenadas en IndexedDB. |
| OBS-07 | `src/core/lfproj.js` y `src/core/levelpackage.js` | `.lfproj` guarda escena por JSON y prefab como `{objects}`; `.levelpackage` también extrae objetos de Prefabs. Un esquema nuevo exige preservar conexiones en serialización/lectura/paquetes, no filtrarlas. |
| OBS-08 | `src/core/state/history.js` | Undo/Redo captura y restaura `objects` y otras colecciones, no conexiones; una edición visual de señales quedaría fuera del historial sin ampliar el snapshot. |
| OBS-09 | `src/core/state/prefabs.js` | `materialize()` y `refreshInstance()` regeneran IDs de hijos. `applyToPrefab()` sustituye `pf.objects`; se necesita remapeo interno explícito de extremos de conexiones. |
| OBS-10 | `src/core/state/objects.js` | Duplicación y pegado crean nuevos IDs. La duplicación recursiva de subárbol y el clipboard tienen trayectorias distintas; debe declararse política de copiar enlaces internos/externos. |
| OBS-11 | `src/engine/runtime/scene/node-lifecycle.js` y `src/engine/runtime/events/play.js` | Los scripts se instancian en entrada al árbol; `_ready` se despacha posteriormente, de hijos a padres. Los métodos y señales podrían registrarse durante `_enter_tree` o `_ready`. No se puede asumir que todos existan antes de `_ready`. |
| OBS-12 | `src/core/exporter.js` y flujo de exportación de juego | Existen exportadores de naturaleza diferente (incluido Godot). Debe probarse la ruta Player/Electron y definir explícitamente la semántica de exportación Godot; no atribuir equivalencia automática de señales JS a GDScript. |
| OBS-13 | `src/engine/runtime/events/play-signals.js` | `game.emit()`/páginas narrativas utilizan un canal separado: la autoría visual de señales de nodo no debe cambiarlo. |
| OBS-14 | `src/core/project.js`: `migrateScene()` | La incidencia histórica NP-29 (`migrateObjectGroups is not defined`) fue reproducida previamente sobre baseline S04; no pertenece a S06-G001 y permanece pendiente fuera de alcance. |

## 2. Diferenciar hechos, inferencia y causa estructural

**OBSERVADO:** la API local de S04/S05 administra conexiones únicamente en runtime y las libera al abandonar el árbol. **INFERENCIA:** una pestaña que llame directamente a `connect()` durante Edit Mode no tendrá persistencia y ofrecerá expectativas falsas. **CAUSA ESTRUCTURAL:** falta un contrato de autoría serializada de conexiones y una fase definida de activación sobre las instancias vigentes.

**OBSERVADO:** `define_signal()` y `expose()` reciben expresiones JavaScript y se ejecutan en la instancia. **INFERENCIA:** analizar texto o detectar llamadas literales solo proporciona pistas, no un inventario exhaustivo. **CAUSA ESTRUCTURAL:** no hay metadatos de autoría estables ni una interfaz de introspección segura en Edit Mode; ejecutar scripts para descubrir API introduciría efectos colaterales.

## 3. Dependencias y riesgos por orden

1. **G002 — modelo y activación:** conservar datos por escena en todos los caminos, normalización/migración sin pérdida, runtime de conexiones visuales anclado al registro actual; pruebas de orden `_enter_tree`/`_ready`.
2. **G003 — interfaz:** pestaña Señales del dock, diálogo compacto de destinos, métodos y validaciones; acceso por teclado y pantalla estrecha; no ejecución de JS de usuario en Edit Mode.
3. **G004 — integración:** Prefabs con IDs regenerados, duplicación/clipboard, Undo/Redo y paquetes/export; QA end-to-end de Editor y Player. Las rutas no cubiertas deben permanecer deshabilitadas o advertidas explícitamente hasta ser compatibles.

**Importante:** `G002/G003/G004` son propuestas de Gates futuros, NO autorizaciones. La definición exacta de medios de prueba y archivos a modificar se declarará en cada Gate. No aprobar extensiones implícitas de producción.

## 4. Contradicciones y bloqueos

No se identificó un contrato aprobado que prohíba documentar la autoría visual persistente. La limitación de S04/S05 sobre serialización era una exclusión de su propio alcance, no una prohibición general futura. No obstante, no está resuelta en producción la persistencia ni la detección dinámica de métodos: **bloquean G003 y G004 hasta que sus propios contratos y prerequisitos se satisfagan**, no la auditoría documental G001.

La exportación Godot es un destino distinto del Player LevelForge: se deberá establecer un criterio independiente. No se presupone interoperabilidad. El estado de NP-29 permanece histórico, sin cambios.

## 5. Revisión de alcance

**Permitido en G001:** este informe, contrato UX, QA contractual, ledger de seis hojas y registro de aprobación de S05. **Prohibido:** tocar componentes `.vue`, runtime, modelos, migradores, exports, fixtures Node/Electron o archivos de formato. La declaración no requiere runner ni build: es una auditoría documental comprobable mediante referencias y comparación binaria de ZIP.
