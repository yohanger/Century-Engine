# LevelForge — CORR-003 · Continuación 002: Agua y materiales de Carretera

**Gate técnico:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`.

**Contrato vigente:** UPA-CA-002 ratificado; autoriza consolidar la ejecución sin omitir TB01, G007, autoridad Jolt ni QA Editor/Player. No existe autorización para iniciar G009–G014.

**Fecha:** 2026-11-11. **ESTADO:** IMPLEMENTADO EN FUENTES / TEST NODE FOCAL PASS / BUILD Y QA VISUAL **NO VERIFICADOS** / GATE **NO CERRADO**.

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_SOURCE_BASELINE.zip`, 3.092 archivos. Se comparó su contenido con el directorio de trabajo; al inicio había 0 diferencias, 0 nuevos y 0 eliminados.

## 1. Objetivo técnico y mecanismos reutilizados

### Water — 21 canales

Se registran en `src/engine/runtime/nodes/water.js` como `visualAnimationFields` sobre el `registerNode()` existente. La forma en que el shader recibe uniformes **no cambia**: el mismo `update(root,obj)` sigue ejecutando `normalizeWaterNode()`, `setWaterUniforms()` y la selección original de textura. El adaptador visual común conserva posición, rotación, escala y visibilidad que otra pista haya modificado.

- **Apariencia (9):** `color`, `deepColor`, `opacity`, `roughness`, `foam`, `clarity`, `shoreFoam`, `shoreWidth`, `faceted`.
- **Olas/viento (7):** `waveHeight`, `waveLength`, `waveSpeed`, `wind`, `windDir`, `ripples`, `rippleScale`.
- **Texturas (5):** `texture`, `textureMode`, `textureScale`, `textureSpeed`, `textureStrength`.

Cada fila correspondiente de `WaterPanel.vue` muestra una llave contextual si existe un Timeline editable y el nodo es elegible. Las llaves usan las mismas funciones de Inspector `inspectorKeyable`, `inspectorKeyMarked` e `inspectorInsertKey`; no crean reproductor, reloj ni menú paralelo.

**Sin certificación:** forma oceánica/lago/río, dimensiones, puntos del río, resolución de malla, `flowSpeed`, `flowDir`, región física y shader de Godot oculto. La animación de esas propiedades requiere autoridad de geometría, WaterWorld y acoplamiento físico; mostrarlas con un aplicador solo GLSL sería incorrecto. Los botones de importación y restablecimiento son operaciones editoriales, no claves.

### Road — 10 canales

La propia definición `road.js` conserva en `userData.timelineRoadMaterial` los overrides de **instancia**, independientes del material compartido en `Assets/Materials`.

- Asfalto, carriles, línea central y acera: `Color` y `Rugosidad` (**8**).
- Línea central y carriles: `Brillo propio` (**2**), únicos slots que exponen ese control en el Inspector.

El valor temporal se incorpora al resultado original de `roadSlotMaterial()` antes de `syncPbrMaterial()`. Así no se escribe sobre `PBR_ENV.materials` ni se modifica un recurso compartido. El canal `emissive` reutiliza el emisor de luz material existente. El aplicador conserva pose/escala/visibilidad actual, además de los snapshots por canal. `RoadPanel.vue` utiliza su bucle de los cuatro slots, sin duplicar controles.

**Sin certificación:** puntos y anchos, suavizado/curvatura, volumen y aceras estructurales, definición de líneas, repetición de UV (`tile`), pintura, cambio de recursos y shader PBR avanzado. Estos pueden obligar a reconstruir geometría o cambiar recursos compartidos: no se añadió una falsa llave. En slots que usan un recurso compartido, el Inspector no permite edición de los controles locales, aunque el descriptor puede aplicar una sobrescritura por instancia; su UX final requiere QA local.

## 2. Evidencia automatizada real

- Nueva batería Water: **9 PASS / 0 FAIL**. Verifica 21 descriptores, todas sus llaves, tipos y persistencia, uniformes originales, textura en instancia, independencia de canales y restauración sin modificar `props`.
- Nueva batería Road: **8 PASS / 0 FAIL**. Verifica 10 descriptores, repetición por slot, IDs persistidos, aplicación PBR, material compartido inalterado, snapshots independientes y preservación de pose.
- Regresión ampliada seleccionada (12 suites): **169 PASS / 0 FAIL / 0 SKIP**. Incluye 17 nuevas más 152 anteriores de CORR-003, CORR-002, CORR-001, G001, métodos, geometría y UX.
- `node --check` en `water.js`, `road.js` y las suites nuevas: **PASS**.
- `npm run build`: se intentó y devolvió `sh: 1: vite: not found` porque este contenedor no incluye `node_modules`. **COMPILACIÓN NO VERIFICADA**, no es FAIL funcional del proyecto.
- **Electron, PlayMode, Player y QA visual local: NO VERIFICADOS**.

Estas baterías usan dobles de los colaboradores de render para comprobar los contratos; **no equivalen a ver la animación GLSL/PBR en GPU**.

## 3. Cobertura acumulada y bloqueos de cierre

La matriz anterior registraba **23 de 34 tipos** con al menos un descriptor especializado y **11 SOLO COMÚN**. Después de esta intervención Water y Road cuentan con descriptores propios: **25 de 34 con cobertura parcial y 9 SOLO COMÚN**. **0 de 34 certificados al 100 %**, dado que faltan campos o la evidencia Editor/Player.

Bloqueos principales:
- Jolt: `StaticBody3D`, `RigidBody3D`, `CollisionShape3D` (masa, shapes, parámetros físicos), actualización/reconstrucción segura en runtime.
- Geometría y mundo: `Subtract`, Road estructural, Water geométrica y corriente WaterWorld, Terrain, Model, Group y navegación horneada.
- Campos comunes no equivalentes a animación: grupos, capas, `DontDestroyOnLoad`, referencias de recursos y acciones; requieren semántica, autoridad y restauración.
- Paridad real Editor / Player, materiales compartidos, selección de cámara y prioridad Camera Shake bajo FilmMaker/Timeline.
- Postprocesamiento de cámara excluido del alcance nuevo por instrucción expresa del usuario; no se amplió.

**No declarar el Gate CORR-003 APROBADO o CERRADO.** Continuar sobre este SOURCE_BASELINE hasta completar cobertura y obtener QA local con evidencia. No reinterpretar 25/34 como porcentaje de propiedades implementadas.

## 4. QA del usuario — Linux, raíz con `package.json`

Después de comparar y respaldar cambios locales, aplicar **CHANGE** sobre la base CORR-003-CONTINUATION; conservar el SOURCE_BASELINE acumulativo sin extraer sobre proyectos activos.

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-water.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr003-road.mjs
npm run build
npm run electron
```

Esperado de la primera ejecución: **17 pruebas PASS**. En Electron: crear Water y Road; animar opacidad, oleaje, intensidad de textura, color y rugosidad; comprobar el resultado visual y su restauración en stop/seek/loop. En Road, emplear dos nodos con el mismo recurso .material y comprobar que las claves de uno **no** modifican el otro ni el material de Assets. Reabrir el proyecto, probar Player y devolver consola, capturas/vídeo y resultados de build.

**Entrega obligatoria de LevelForge:** exactamente dos ZIP, CHANGE y SOURCE_BASELINE completo, excluyendo dependencias, builds y temporales, con el ledger de seis hojas actualizado sin borrar historial.
