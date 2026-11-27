# LevelForge — CORR-003 · Continuación 007: posición real de piezas Terrain

**Gate:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`, autorizado previamente; UPA-CA-002 ratificada. **Continuación del MISMO Gate; no abre G009–G014.**

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_006_MODEL_LIQUID_OWNERS_SOURCE_BASELINE.zip` (3.103 archivos, CRC y comparación con árbol de trabajo PASS antes de intervenir). **Estado:** IMPLEMENTADO EN FUENTES · NODE TEST SELECTED PASS · BUILD/ELECTRON/PLAYER NO VERIFICADOS · GATE ABIERTO.

## 1. Auditoría y criterio arquitectónico

**OBSERVADO:** `Terrain` está declarado como nodo `base: 'Node'` con ID idéntico al de la pieza (`core/project.js`). El relieve, la pintura, las capas, la vegetación y la posición viven en **una instancia** `Terrain` del `SceneGraph.terrains`, no en `obj.props` ni en un `Object3D` duplicado. Los controles `Posición X/Y/Z` están en `TerrainPanel.vue`; el cuerpo Jolt del terreno se crea desde esta misma pieza y se registra con `pieceId` en `JoltWorld.terrain`. Existen `serializeTerrain()`, `Terrain.serialize()` y `Terrain.snapshot()` que toman la posición directamente de la pieza. El `TerrainPanel` seleccionaba una pieza activa potencialmente distinta del nodo seleccionado en Jerarquía.

**INFERENCIA:** animar una copia de `obj.position` o una malla editorial no movería ni el relieve ni las colisiones. Reemplazar el relieve por frame crearía deuda técnica y problemas de memoria. Para permitir movimiento de la pieza sin modificar sus datos guardados se requiere un override transitorio, conservación de la posición autoral y actualización del **mismo BodyID**.

## 2. Implementación en propietarios originales

| Archivo | Cambio |
|---|---|
| `src/engine/runtime/nodes/terrain.js` | Único canal tipado `terrain.piecePosition` (`vec3`). Lee X/Y/Z de la pieza real, verifica vínculo nodo-pieza-escena, captura la posición vigente, aplica/restaura valores temporales, no escribe `props` |
| `src/engine/runtime/scene/objects.js` | Al sincronizar el nodo Terrain, vincula ID de pieza al objeto en una propiedad **no enumerable y transitoria**, y al root existente; no crea otra pieza ni duplica alturas/pintura |
| `src/engine/runtime/scene/terrain.js` | Al desmontar la pieza limpia el vínculo y restaura su posición autoral antes de liberarla |
| `src/engine/runtime/physics/jolt.js` | `moveTerrainPiece(pieceId, position)` reutiliza `BodyInterface.SetPositionAndRotation` del cuerpo Jolt original (mismo BodyID; sin rehacer Shape ni world) |
| `src/engine/runtime/geometry/terrain-io.js` | `serialize()` y `snapshot()` usan la posición autoral capturada mientras existe una animación: ni guardado ni Undo almacenan una muestra temporal |
| `src/engine/runtime/events/play-level.js` | Restauración defensiva al abandonar PlayMode incluso si Timeline no alcanzó STOP convencional; llama el descriptor existente, no duplica su setter |
| `src/components/TerrainPanel.vue`, `src/components/Inspector.vue` | Llave contextual para posición XYZ, ligada al ID del nodo Terrain seleccionado; al seleccionar Terrain por Jerarquía se sincroniza la pieza activa original del panel |

**Sincronización efectiva:** `piece.ox/oy/oz`, `piece.mesh.position`, `piece.foliage.group.position` y el BodyID Jolt de esa misma pieza. Las alturas y la pintura permanecen intactas. Una muestra sin cambios no emite setters nativos adicionales. El guardado/Undo conserva la posición original; al terminar se limpia el override.

## 3. QA automatizado ejecutado

- Nueva suite `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont007-terrain.mjs`: **17/17 PASS**. Valida registro único, elegibilidad, lectura de pieza real, keyframes, independencia de piezas, uso de BodyID existente, preservación de alturas/vegetación/pintura, errores antes de mutar, ausencia de body, restauración, autoguardado, Undo, control de aplicación redundante y teardown abrupto.
- Regresión seleccionada acumulativa (18 suites): **253/253 PASS · 0 FAIL · 0 SKIP** (incluye G001, CORR-001/002/003, CollisionShape3D, Motion/Jolt, Audio, Water, Road, Critters, Camera/Inspector y UX).
- `node --check` de módulos JS modificados y de suite nueva: **PASS**.
- `npm run build`: se intentó, no inició porque falta `node_modules`/Vite: `sh: 1: vite: not found`; **COMPILACIÓN NO VERIFICADA**. Electron y Player NO EJECUTADOS en este entorno.
- Estas pruebas utilizan simulaciones de BodyInterface y piezas, **no validan Jolt WASM real ni comportamiento visual GPU**.

## 4. Alcance pendiente y bloqueos reales

**Terrain** recibe **un canal especializado**, pero NO está al 100 %: TerrainPanel contiene operaciones editoriales y datos de las piezas (horneado, remuestreo, bordes, generación, relieve, pintura, texturas, hidrología/WaterWorld) que no constituyen valores temporales independientes sin una transacción especializada. Se mantiene una pieza de verdad, no una segunda jerarquía de terrenos.

**Subtract:** el control `Volumen` cambia la geometría CSG de los **receptores** de `scene/brushes.js`, y Jolt PlayMode conserva el MeshShape precomputado. Animar exclusivamente `obj.kind` produciría un hueco visual sin colisión concordante. Requiere refresco CSG transaccional por receptor y sustitución segura de su MeshShape, preservando BodyID, polígonos originales y presupuesto de CPU. No se añadió llave falsa.

**Navigation:** `cell`, `agentRadius`, `agentHeight`, `maxSlope`, `stepHeight` y `layers` definen el **horneado de NavGrid**. Los agentes usan el recurso ya horneado de `NavWorld`; mutar números sin reconstruir el mapa no es animación funcional. Requiere bake controlado, cancelación/latencia, snapshots de región y paridad Player. No se añaden llaves para estas propiedades sin ese mecanismo.

**Cobertura de tipos:** antes de esta entrega se registraron 30/34 tipos con algún descriptor especializado; Terrain incrementa a **31/34**, mientras `Node` y `Group` son estructurales y `Subtract` sigue sin canal propio. **0/34 están certificados universalmente al 100 %**, porque persisten campos no cubiertos y no hay QA integral Editor/Player. El 31/34 mide **tipos con al menos un canal**, no porcentaje de propiedades. Propiedades estructurales generales (Groups/Layers/DontDestroyOnLoad), Camera Shake/Camera Orchestration y otras de Owner siguen requiriendo cobertura/QA.

## 5. QA local obligatorio — Editor y Player

Partir del SOURCE_BASELINE 006, comparar los cambios locales y aplicar CHANGE solo si no hay conflictos. Ejecutar desde la carpeta con `package.json`:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont007-terrain.mjs
npm run build
npm run electron
```

**Node esperado:** 17 PASS. En Electron, crear **dos piezas Terrain** de alturas/pintura distintas, seleccionar la segunda por Jerarquía, comprobar que el `TerrainPanel` selecciona esa misma pieza y que la llave XYZ se inserta en ese nodo, no en la pieza antes activa. Reproducir una secuencia que mueve solo una pieza, verificar su malla, vegetación, altura de suelo, colisión del jugador y BodyID persistente. Hacer seek, pausa, loop y STOP; comprobar restauración y que la otra pieza no cambió. **Guardar DURANTE una previsualización**, reabrir y confirmar que la posición guardada es la autoral. Repetir con Player exportado.

**Evidencias a devolver:** logs Node/build/Electron, captura del Inspector/TerrainPanel, vídeo PlayMode/Player de movimiento/colisión/restauración y verificación de guardado. No certificar esta funcionalidad visualmente sin evidencia del usuario.

**Estado de salida:** IMPLEMENTADO EN FUENTES · NODE PASS · **QA LOCAL NO VERIFICADO · GATE CORR-003 ABIERTO**.
