# LevelForge · S13-G008-G001 CORR-003 — Continuación de cobertura especializada

**Gate vigente y autorizado:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`.

**Estado:** IMPLEMENTADO PARCIAL · TEST AUTOMATIZADO SELECCIONADO PASS · **NO CERRADO** · QA LOCAL PENDIENTE.

**Baseline de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_ALL_NODES_INSPECTOR_COVERAGE_SOURCE_BASELINE.zip` (3.089 archivos; CORR-003 ya incorporado). Esta entrega es **un avance acumulativo del mismo Gate**, no una nueva unidad ni autorización distinta. UPA-CA-002 sigue vigente.

## 1. Cambios en propietarios existentes

| Propietario | Nuevos canales | Aplicación y restauración |
|---|---|---|
| `gameplayObject` | `reach`, `showIndicator` | `visualAnimationFields` → `update()` del nodo y `gameplayRuntimeProps()` del propietario interactivo; selección de objetivo y mensaje de interacción consumen los valores temporales. Snapshot por canal. |
| `spawn` | `tag` | `timelineSpawnTag` en la raíz; `_spawnFor()` consulta la etiqueta efectiva sin escribir `props.tag`. Snapshot por canal. |
| `event` | `color` | Actualización por `update()` original; no modifica páginas, condiciones, scripts ni datos autorales. |
| `navigation` | `color` | Solo material editorial por `update()`. La malla nav horneada **NO** se reconstruye silenciosamente. |
| `primitive` | `color`, `roughness`, `metallic`, `opacity` | `syncPbrMaterial` sobre instancia visual existente. Si usa `materialId`, los valores base se leen del recurso, pero la animación modifica **solo esa instancia**, no `Assets/Materials`. Snapshot por canal. |
| `mesh` | `color`, `roughness`, `metallic`, `opacity` | Mismo propietario PBR de Mesh, conservando pose temporal, geometría y recurso compartido. |
| `critters` | 11 parámetros de la especie `firefly`: `count`, `radius`, `minHeight`, `maxHeight`, `speed`, `blink`, `sync`, `brightness`, `size`, `color`, `windLimit` | Descriptor generado desde el catálogo de especie **existente**; `ParamForm` añade llaves solo en Inspector Critters; `CritterSystem` consume overrides por instancia, recalcula por fotograma únicamente cuando hay pistas animadas, mantiene el intervalo original de 0,4 s en clusters estáticos y reconcilia al restaurar. Sin segundo sistema de IA ni mutación de `props`. |

**Total de esta continuación: 24 canales nuevos** (2 + 1 + 1 + 1 + 4 + 4 + 11). Se utilizan `registerNode`/`visualAnimationFields` y las pistas originales. No se duplicaron máquinas de estado, calculadores de materiales ni recursos de Assets.

## 2. Matriz de los 34 tipos registrados (estado acumulado)

**Criterio:** `PARCIAL` = existe al menos un canal propio animable con ruta de aplicación demostrada en pruebas focales, **NO** implica que el 100 % de los campos del Inspector estén cubiertos. `SOLO COMÚN` = sin descriptor especializado, aunque puede admitir `active`, visibilidad y transformaciones cuando procedan. `100 % CERTIFICADO` exige inventario de campos y pruebas integrales Editor/Player con aprobación local.

| Tipo | Descriptores propios acumulados | Estado |
|---|---|---|
| `node` | Ninguno | SOLO COMÚN |
| `node3d` | Ninguno | SOLO COMÚN |
| `camera` | FOV; cámara principal temporal | PARCIAL |
| `cameraShake` | 16 canales | PARCIAL; prioridad con Timeline/FilmMaker pendiente |
| `light` | Iluminación especializada | PARCIAL |
| `trigger` | 8 canales | PARCIAL |
| `atmovolume` | 2 canales | PARCIAL |
| `postvolume` | 8 canales (sin nueva expansión) | PARCIAL; postprocesamiento reservado |
| `audio` | 17 canales | PARCIAL |
| `canvas` | 9 canales, incluido alfa `.ui` | PARCIAL |
| `decal` | 4 canales | PARCIAL |
| `nature` | 3 canales | PARCIAL |
| `sprite2d` | Campos visuales y overlay 2D | PARCIAL |
| `sprite3d` | Campos visuales | PARCIAL |
| `text` | 15 canales | PARCIAL |
| `vfx` | 3 canales | PARCIAL |
| `characterbody3d` | Gravedad, altura de escalón, suelo | PARCIAL |
| `area3d` | Monitoring, monitorable | PARCIAL |
| `staticbody3d` | Ninguno | SOLO COMÚN |
| `rigidbody3d` | Ninguno | SOLO COMÚN |
| `collisionshape3d` | Ninguno | SOLO COMÚN |
| `primitive` | Color, roughness, metallic, opacity | PARCIAL |
| `mesh` | Color, roughness, metallic, opacity | PARCIAL |
| `model` | Ninguno especializado | SOLO COMÚN |
| `group` | Ninguno especializado | SOLO COMÚN |
| `subtract` | Ninguno especializado | SOLO COMÚN |
| `road` | Ninguno especializado | SOLO COMÚN |
| `water` | Ninguno especializado | SOLO COMÚN |
| `terrain` | Ninguno especializado | SOLO COMÚN |
| `spawn` | Etiqueta | PARCIAL |
| `event` | Color | PARCIAL |
| `gameplayObject` | Alcance e indicador | PARCIAL |
| `critters` | 11 parámetros de `firefly` | PARCIAL |
| `navigation` | Color editorial | PARCIAL; horneado NO animable aún |

**Resultado:** 34 tipos, **23 con algún descriptor propio**, **11 SOLO COMÚN**, **0 certificados al 100 %**. Esta matriz es un checkpoint de cobertura, no evidencia de implementación universal.

## 3. QA ejecutado y límites

- `node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-continuation.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr003-critters.mjs` → **18 PASS / 0 FAIL**.
- Regresión seleccionada acumulativa (11 suites, incluidos CORR-003 previos, CORR-002, CORR-001, G001, scripts, geometría y UX) → **164 PASS / 0 FAIL / 0 SKIP**.
- `node --check` sobre todos los módulos JavaScript productivos modificados → PASS.
- `npm run build` → **NO COMPILADO**: falta la instalación de Vite (`sh: 1: vite: not found`). No se registró PASS/FAIL de build del proyecto; Electron/Player/PlayMode visual y QA de usuario **NO VERIFICADOS**.
- Se mantienen los fallos históricos previamente aislados en suites no incluidas; no se interpretan estas 164 pruebas como regresión exhaustiva.

## 4. Dependencias y bloqueos de cierre

La declaración original exige **todos** los campos funcionales de los **34** nodos con evaluación y restauración correctas. Aún no está satisfecha. No se añaden iconos que no tengan un aplicador propietario:

1. **Jolt:** masa, fricción, damping, formas/recetas de colisión y cuerpos requieren reconstrucción o setters físicos validados; evitar `object3D` directo. G007 sigue sin certificación integral.
2. **Navigation:** parámetros de horneado no modifican el mapa activo sin operación transaccional y ruta de reconstrucción. No hornear por fotograma ni fingir actualización de AI.
3. **Geometry/World:** Model, Group, Subtract, Road, Water, Terrain y topología/materiales avanzados siguen requiriendo propietario, presupuesto de reconstrucción y snapshots.
4. **Gameplay:** páginas de Event, referencias y bases de datos de GameplayObject, Spawn y recursos tienen implicaciones semánticas que no se equiparan a un color animable.
5. **Inspector común:** Layer, Groups, DontDestroyOnLoad y otros metadatos requieren autoridad temporal y contrato de restauración. Botones de acciones editoriales, como Prefab, están excluidos; postprocesamiento de cámara también queda fuera por decisión del usuario.
6. **Camera Orchestration S15:** Camera Shake bajo la autoridad film/timeline/pose continúa sin efecto visual certificado; no alterar esa prioridad para marcar cobertura.
7. **Paridad visual:** Canvas, MaterialSection, AudioSource, Critters, VFX y cámara deben validarse en Editor/Player reales, no solo con módulos Node.

**Conclusión vinculante:** IMPLEMENTACIÓN PARCIAL, **CORR-003 ABIERTO**, NO declarar `READY`, `CERRADO` ni `100 %` hasta completar propietarios, compilación, QA visual y aprobación del usuario. No anticipar G009–G014.

## 5. QA del usuario en Linux

Desde la raíz actual con `package.json`, comparar y respaldar modificaciones locales antes de aplicar CHANGE. No extraer SOURCE_BASELINE encima de datos propios sin comparación.

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-continuation.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr003-critters.mjs
npm run build
npm run electron
```

**Esperado del primer comando:** 18 pruebas PASS. Compilación/Electron aún no están verificados aquí.

En Electron: animar Alcance e Indicador de GameplayObject; cambiar temporalmente etiqueta Spawn; color Event y Navigation; albedo y rugosidad de dos mallas que usan un mismo material de Assets (verificar que una no modifique la otra); parámetros `radius`/`count`/`brightness` de Critters durante la reproducción y después de STOP; guardar/reabrir; comprobar Player, audio, Canvas y Camera Preview sin regresiones. Devolver salida de tests/build, vídeo o capturas de propiedades animadas y reporte de errores locales. Preservar los ZIP anteriores para continuidad.

## 6. Manifiesto de diferencias verificado

**3 nuevos, 18 modificados, 0 eliminados y 0 cambios inesperados** frente al último SOURCE_BASELINE CORR-003 autorizado.

**Nuevos:**

- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-CONTINUATION_QA.md`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-continuation.mjs`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-critters.mjs`

**Modificados:**

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `src/components/Inspector.vue`
- `src/components/MaterialSection.vue`
- `src/components/ParamForm.vue`
- `src/engine/runtime/critters/system.js`
- `src/engine/runtime/events/play-events.js`
- `src/engine/runtime/events/play-interaction-indicator.js`
- `src/engine/runtime/events/play-level.js`
- `src/engine/runtime/gameplay/object-state.js`
- `src/engine/runtime/nodes/critters.js`
- `src/engine/runtime/nodes/event.js`
- `src/engine/runtime/nodes/gameplay-object.js`
- `src/engine/runtime/nodes/mesh.js`
- `src/engine/runtime/nodes/navigation.js`
- `src/engine/runtime/nodes/primitive.js`
- `src/engine/runtime/nodes/registry.js`
- `src/engine/runtime/nodes/spawn.js`
- `src/engine/runtime/scene-graph.js`

No se reemplazaron escenas, bases de datos de proyectos, recursos de Assets ni dependencias externas. Excluir distribuciones, cachés y node_modules de ambos ZIP.
