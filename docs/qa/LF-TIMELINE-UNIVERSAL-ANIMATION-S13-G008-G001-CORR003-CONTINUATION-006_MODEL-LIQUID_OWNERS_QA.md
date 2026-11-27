# LevelForge — CORR-003 · Continuación 006 — Model y recipientes de líquido

**Gate vigente:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`, UPA-CA-002 ratificada. No es un Gate nuevo ni se inicia G009–G014.

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_005_COLLISION_SHAPE_SOURCE_BASELINE.zip` (3.101 archivos, comparación sin cambios en el árbol previo). **Estado:** IMPLEMENTADO EN FUENTES · REGRESIÓN NODE PASS · BUILD/QA LOCAL DE ESTA CONTINUACIÓN NO VERIFICADOS · CORR-003 ABIERTO.

## 1. Auditoría de los seis tipos señalados por el usuario

| Tipo | Propiedades especializadas del Inspector | Situación contractual al terminar este corte |
|---|---|---|
| `node` | Ninguna; campos generales (Activo, Visible, DontDestroyOnLoad, Tag/Groups/Layers) | Solo canales generales; la semántica de persistencia/grupos/capas sigue sin animación certificada. No añadir canales propios ficticios |
| `node3d` | Recipiente (habilitado, forma, interior, recurso líquido, volumen inicial y caudal), combustión (habilitado, ignición, humedad, temperatura), transformaciones | Se añadió **caudal en vivo**; sigue PARCIAL. Transformaciones ya existían |
| `group` | Posición/rotación y campos generales; no tiene escala propia ni controles de subpropiedades | Solo común por diseño; las acciones editoriales de agrupación no son canales de Timeline |
| `model` | Sombra, GI y campos generales; recurso de modelo se elige en Assets/Hierarchy, no en Inspector como dato numérico | Se añadió **Sombra en vivo** sobre la instancia. GI/baking y propiedades comunes especiales siguen sin certificar |
| `subtract` | Forma del volumen (Caja/Cilindro/Escalera) y transformaciones | Falta conectar reconstrucción CSG a colisiones Jolt en Player. No publicar llave de forma que solo cambie un gizmo |
| `terrain` | TerrainPanel administra PIEZAS y recursos de Terrain (fuente externa al objeto nodo), no `obj.props` | Pendiente relación contractual nodo→pieza, alturas/pintura y remuestreo seguros. No crear un segundo Terrain ni animar globales como si pertenecieran al nodo |

**Navigation** continúa pendiente en sus seis parámetros de horneado. Cambiar únicamente la interfaz o `obj.props` sin actualizar `NavGrid` no sería soporte real.

## 2. Cambios implementados y propietarios

- `model.castShadow` es un `visualAnimationField` con `scope: object`, bool, de `nodes/model.js`; el mismo `update()` del nodo recorre **únicamente el `modelRoot` clonado** y cambia `castShadow` en sus mallas. La geometría GLTF original y otras instancias no se modifican. `Node3D`, `Group` y `Terrain` no reciben un nuevo componente visual.
- `node3d.pourRate` y `rigidbody3d.pourRate` son dos IDs tipados **distintos**, cada uno pertenece a su nodo y son elegibles solo cuando el recipiente autoral está habilitado. Se reutiliza un único helper en `nodes/base.js` (extendido por `physics.js`), sin duplicar runtime ni estado físico.
- `WaterWorld.setContainerPourRate(id, value)` modifica solo `pourRate` en el recipiente físico existente y valida con `containerSpec` original (0..5), **sin inyectar ni destruir líquido y sin tocar capacidad/masa contabilizada**.
- `play-liquid.js` ancla el WaterWorld vigente a `root.userData.liquidRuntime` durante `_liquidInit`, lo retira en `_liquidReset`; la clave aplica el nuevo caudal de inmediato, y el snapshot de la sesión devuelve el caudal vivo anterior al STOP incluso en pausa. Los demás parámetros del recipiente (shape, size, liquidId, initialM3, enabled) NO están animados aún por este mecanismo.
- La llave se integra en las filas existentes de Inspector (Sombra para Model y Caudal de salida para Node3D/RigidBody3D) mediante `PropertyKey`. No se crea reproductor, sistema de assets ni editor paralelo.

## 3. Evidencia y limitaciones

- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont006-owners.mjs`: **11/11 PASS**. Verifica registro sin duplicación, elegibilidad por tipo, claves/persistencia, aplicación/restauración con WaterWorld, snapshot nativo, aislamiento de instancia GLTF, validación de datos, sincronización y limpieza PlayMode con el propietario original.
- Regresión seleccionada **17 suites / 234 PASS / 0 FAIL / 0 SKIP**; incluye física Jolt, CollisionShape3D, WaterWorld, Model/Inspector, audio y Timeline.
- Tres harness históricos de física (`physics-live`, `physics-motion`, `collision-shapes`) se actualizaron **solo para inyectar un stub vacío del nuevo owner líquido durante sus pruebas de física puras**; el owner líquido real se verifica en la suite nueva.
- `node --check` de todos los JS modificados: **PASS**.
- `npm run build`: `sh: 1: vite: not found` en este entorno sin `node_modules`. **NO VERIFICADO** Editor/Player del cambio 006; no es evidencia de regresión de compilación.
- La compilación de la entrega **anterior 005** sí fue ejecutada por el usuario: Editor 851 módulos, Player 415 módulos PASS. Electron quedó descargando su binario y no acredita QA de ejecución. No atribuir esas compilaciones previas a la versión 006.

## 4. Bloqueos reales del Gate universal

1. `node3d`/`rigidbody3d`: recipientes habilitación, interior, recurso e initialM3 requieren transacciones sobre WaterWorld y preservación de masa. Combustión dispone de otro propietario térmico; no se mezcla con el inventario de agua.
2. `subtract`: el BSP se regenera en `scene/brushes.js`; los cuerpos Jolt de los receptores y sus vistas en Player se construyen con geometría ya recortada. Hace falta actualización transaccional de CSG + colisiones y presupuesto de reconstrucción. No ofrecer selector de Forma con claves de solo UI.
3. `terrain`: `TerrainPanel.vue` modifica piezas `store.pieces` y `Terrain` (alturas, pintura y topología). Los nodos Terrain solo referencian esas piezas. Se exige la relación de identidad y snapshots; no actualizar todas las piezas al cambiar el nodo seleccionado.
4. `navigation`: `NavGrid` horneado y assets físicos requieren autoridad del bake, no cambios superficiales del gizmo.
5. `gi` de Model y otras familias: la iluminación horneada no se intercambia en caliente sin un propietario real de iluminación. Propiedades estructurales comunes como `DontDestroyOnLoad`, Tags, Groups y Layers requieren semántica de escena/sistemas; no se declaran animables en esta entrega.
6. Camera Orchestration S15 (selección de cámara principal, preview, Camera Shake, Player) mantiene su QA visual pendiente. Compilar y pasar tests Node no sustituye verificar la cámara en ejecución.

**Cobertura informativa:** antes de este corte 28/34 tipos tenían al menos un canal especializado. Con `node3d` y `model`, pasa a **30/34**; `node`/`group` son estructurales, y `subtract`/`terrain` todavía carecen de un canal especializado seguro. **Ninguno de los 34 tipos está certificado íntegramente al 100 %**, y el criterio universal de CORR-003 aún no se cumple.

## 5. QA local del usuario

Aplicar CHANGE solamente sobre la carpeta con SOURCE_BASELINE 005, previa comparación/respaldo de cambios locales. Mantener nuevo SOURCE_BASELINE en ZIP separado para la siguiente continuación.

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont006-owners.mjs
npm run build
npm run electron
```

**Esperado:** 11 PASS en la primera suite. Build y Electron deben terminar con sus propios resultados para declarar COMPILADO y QA LOCAL PASS.

En el Editor, poner dos Model que utilicen el mismo archivo GLB, insertar claves de Sombra `true→false→true` para uno y confirmar que el otro no cambia. Con Node3D y RigidBody3D configurados como recipientes abiertos, insertar claves de Caudal 0→2→0 en PlayMode, inclinar el recipiente, inspeccionar el agua y comprobar restauración de caudal al detener; repetir tras guardar/reabrir y en Player. Confirmar que los recursos .liquid y el inventario de agua permanecen intactos y que Camera Preview sigue usando la cámara seleccionada. Si Electron continúa en `Downloading Electron binary...`, entregar el registro exacto antes de declarar QA visual.

**Estado de salida:** IMPLEMENTADO EN FUENTES · TEST NODE PASS · BUILD/ELECTRON/PLAYER DE 006 NO VERIFICADOS · GATE CORR-003 ABIERTO. No avanzar a G009–G014.

## 6. Manifiesto diferencial frente a SOURCE_BASELINE 005

**2 archivos nuevos, 10 modificados, 0 eliminados, 0 inesperados.** Se excluyen builds, `node_modules`, cachés y archivos temporales.

**Nuevos**
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-CONTINUATION-006_MODEL-LIQUID_OWNERS_QA.md`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont006-owners.mjs`

**Modificados**
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-collision-shapes.mjs` (inyección de dependencia QA)
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-live.mjs` (inyección de dependencia QA)
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-motion.mjs` (inyección de dependencia QA)
- `src/components/Inspector.vue`
- `src/engine/runtime/events/play-liquid.js`
- `src/engine/runtime/geometry/waterworld.js`
- `src/engine/runtime/nodes/base.js`
- `src/engine/runtime/nodes/model.js`
- `src/engine/runtime/nodes/physics.js`

Las celdas y fórmulas históricas de las seis hojas fueron comparadas y preservadas.
