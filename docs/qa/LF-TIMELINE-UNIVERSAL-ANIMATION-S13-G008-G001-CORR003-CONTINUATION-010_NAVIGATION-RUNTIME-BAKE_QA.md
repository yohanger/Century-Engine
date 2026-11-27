# LevelForge · Timeline CORR-003 · Continuación 010 — Navigation Bake temporal

**Fecha:** 2026-11-11. **Gate ya autorizado:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`. **Amendment vinculante:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-002`. Esta entrega es una continuación del mismo Gate; no inicia G009–G014.

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_009_SUBTRACT_CSG_JOLT_SOURCE_BASELINE.zip`: 3.109 archivos, CRC ZIP PASS, comparación SHA-256 contra árbol original sin diferencias antes de intervenir. No se mezclaron otras ramas ni archivos externos.

**Estado:** IMPLEMENTADO EN FUENTES (parcial) · NODE TEST AUTOMATIZADO PASS · COMPILACIÓN Y QA LOCAL EDITOR/PLAYER NO VERIFICADOS · CORR-003 ABIERTO.

## 1. Diagnóstico de código observado

- El `core/nav/editorBake.js` del Editor creaba un `JoltWorld` temporal, utilizaba el algoritmo físico `bakeNav(bounds,{raycast,params})` y guardaba el resultado en un `.navmesh` de Assets. Ese flujo es correcto para la autoría, **pero no** sirve como aplicación temporal de Timeline porque escribe el recurso/persistencia.
- `nav/bake.js` ya contenía la generación de celdas, muestras verticales, verificaciones de altura/pendiente y erosión; el `NavGrid` generado es usado por A* en `NavWorld`.
- La continuación 008 solo conectó `navigation.stepHeight` a las conexiones de las **celdas ya horneadas**. No regeneraba las celdas perdidas al variar la erosión ni admitía animar `cell`, `agentRadius`, `agentHeight`, `maxSlope` o `layers`.
- `PlayMode` y el Player exportado comparten la creación del `NavWorld` dentro de `_setupScene`, con nodos de escena identificados por ID. Stop y cambio de escena llaman `_teardownScene`.

**Causa raíz:** faltaba separar la generación física (`bakeNavRegion`) de la **publicación autoral** del `.navmesh` e instalar el resultado en `NavWorld` exclusivamente durante la sesión de Timeline. Además, una clave en cada fotograma no puede disparar simultáneamente docenas de horneados Jolt en un PC de 4 GB.

## 2. Mecanismo implementado sin gestores paralelos

| Archivo original | Función extendida |
|---|---|
| `src/engine/runtime/nav/bake.js` | Mantiene el algoritmo `bakeNav` original; mueve a este propietario el constructor `bakeNavRegion` antes exclusivo del Editor. Importaciones Jolt/cortadores diferidas. Prevalida presupuesto de celdas **antes** de crear el mundo físico, permite abortar y garantiza `world.dispose()` en `finally`. |
| `src/core/nav/editorBake.js` | Se convierte en un adaptador fino al **mismo** `bakeNavRegion`, pasando `navBounds(obj)` como en la autoría original. Mantiene la ruta pública `bakeNavRegion()` del Editor sin código de horneado duplicado. |
| `src/engine/runtime/nodes/navigation.js` | Cinco descriptores `navigation.cell`, `.agentRadius`, `.agentHeight`, `.maxSlope`, `.layers` con validación, lectura, snapshot/aplicación/restauración; solo elegibles cuando el nodo tiene un recurso de navegación cargado. Las capas se redondean al entero más cercano durante la aplicación. `stepHeight` continúa usando consultas rápidas; si coexiste con otros parámetros, se incorpora al nuevo horneado. |
| `src/engine/runtime/nav/world.js` | El propietario de rutas dispone de `requestBake`, `_runBake`, `restoreBake` y `dispose`. Por región guarda el puntero del Grid autoral, **no copia arrays ni muta navCache**. Programa peticiones de una sola ejecución, agrupa cambios por firma, cancela tareas obsoletas, limita a **un solo horneado físico concurrente por NavWorld** y publica solamente la malla válida de la sesión. STOP devuelve inmediatamente la referencia original. |
| `src/engine/runtime/events/play.js` | Al crear el NavWorld real, registra el vínculo temporal del nodo con su **región original**. Las cinco propiedades forman un `obj` efectivo que solo se entrega a `bakeNavRegion`; `project.objects` permanece intacto. El bake runtime omite `refreshBrushes` editorial y utiliza la geometría/CSG de sesión ya sincronizada. Límite: **100.000 muestras multicapa** por trabajo en Runtime. |
| `src/engine/runtime/events/play-level.js` | `teardown` cancela los trabajos de navegación y limpia los enlaces/overrides temporales del nodo antes de destruir Jolt. Los `Promise` tardíos quedan invalidados. |
| `src/components/Inspector.vue` | Incorpora las cinco llaves a las filas existentes, sin rediseñar los controles ni montar otra UI. |
| `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont008-navigation.mjs` | Se adapta la comprobación del catálogo previo, manteniendo aserciones de conservación del proyecto y assets. |
| `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-continuation.mjs` | El harness histórico declara ahora el catálogo completo real de `NAV_DEFAULTS`; no elimina tests previos. |

**Reversibilidad:** la muestra temporal existe únicamente en `root.userData.timelineNavBake` y el Grid asociado a la región de `NavWorld`; al devolver el último canal, `restoreBake` restaura inmediatamente el puntero del `NavGrid` autoral. Ningún `.navmesh`, ID de asset, tabla de navegación compartida, `project.objects`, mapa de alturas o dato de persistencia es reemplazado. Las promesas que terminan después del STOP no pueden instalar una malla nueva.

## 3. QA automatizado ejecutado

- Suite nueva `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont010-nav-rebake.mjs`: **23/23 PASS**. Registros, elegibilidad y keyframes de 5 parámetros; rango; layers discretos; interacción con stepHeight; horneador real con raycast analítico para tamaño, erosión, altura libre, pendiente y multicapa; presupuesto previo; publicación por región; cancelación antes/después del inicio; retorno a caché original; serialización no modificada; un solo trabajo en concurrencia; errores y teardown.
- Regresión seleccionada **21 archivos / 308 PASS / 0 FAIL / 0 SKIP**. Incluye Subtract 009, Navigation 008, Terrain 007, Water/Model 006, CollisionShape3D 005, física, Camera/Timeline, audio/métodos y UX.
- `node --check` de módulos JavaScript modificados: **PASS**.
- `npm run build`: **NO COMPILADO** en este entorno; `vite: not found` porque `node_modules` no está presente. No extrapolar build previo de un baseline diferente.
- **NO VERIFICADO**: compilación real Vite de Editor y Player 010, enlace Jolt WASM en Electron, renderización/feedback del editor, A* de agentes durante Timeline, rendimiento y exportación. Las pruebas del horneador usan raycast analítico y `NavWorld` real, pero la construcción de escena Jolt se inspecciona sin ejecutarse nativamente.

## 4. Límites contractuales todavía abiertos

- **Horneado temporal no es instantáneo por fotograma**: las solicitudes se agrupan durante ~180 ms y los mapas nuevos se publican cuando termina una operación completa. Mientras se calcula, los agentes consultan la última malla válida. Una interpolación continua puede producir retraso y requiere medir rendimiento y ergonomía en el PC real. Si se quiere una actualización determinista en el fotograma exacto con muchos miles de celdas, se necesita otra decisión contractual basada en presupuesto de CPU; no afirmar que ya existe.
- El Editor Preview fuera de PlayMode todavía no ejecuta el mundo físico temporal; se puede crear la llave pero la previsualización física del NavGrid no está acreditada. El comportamiento funcional disponible está conectado al `PlayMode`, que comparte código con el Player. Falta QA de esa distinción.
- Para un mapa de región grande, `maxCells:100000` rechaza el rebuild y comunica error; se mantiene el mapa original. No se hace degradación silenciosa de resolución.
- Las rutas ya calculadas y almacenadas por scripts/agentes no se reemplazan automáticamente: las nuevas llamadas a `game.nav.path`/`canWalk` ven la nueva malla. El usuario debe comprobar agentes que solicitan rutas nuevas.
- Mover o escalar la **región Navigation** mediante pistas comunes no dispara por sí solo un rebake de los bounds: el nuevo mecanismo cubre los cinco parámetros de horneado y `stepHeight`, no la reubicación dinámica de la región. Este vínculo sigue pendiente de la matriz universal.
- Las operaciones **Hornear, Cancelar y Quitar mapa** del Inspector siguen siendo comandos de autoría, no canales numéricos de Timeline. La corrección no permite escribir assets mediante reproducción.
- `Subtract CSG–Jolt` 009, propiedades de agua/combustión, GI, Terrain/topología, campos generales (Tag, Groups, Layers, DontDestroyOnLoad), AutoFit editorial y Camera Orchestration necesitan las verificaciones restantes. Prefab excluido y postprocesado de cámara diferido por decisión explícita.

## 5. QA local obligatorio

Desde el SOURCE_BASELINE 009, comparar archivos afectados/resguardar cambios locales y aplicar CHANGE únicamente si no hay conflictos. Ejecutar desde la carpeta con `package.json`:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont010-nav-rebake.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont008-navigation.mjs
npm run build
npm run electron
```

**Esperado Node:** 23 PASS nuevos, 11 PASS de Navigation 008. Build Editor y Player solo serán PASS si Vite termina ambos.

En Electron: crear una región Navigation y hornear el `.navmesh` autoral. Diseñar un suelo con un puente, un paso estrecho, una pendiente y un techo bajo; animar individualmente los cinco campos más `stepHeight`. Esperar que termine cada horneado y solicitar una **ruta nueva** mediante `game.nav`. Comprobar cambios de accesibilidad, múltiples regiones que usan el mismo asset, pausa, seek, loop, STOP, salida de PlayMode y cambio de escena mientras existe trabajo asíncrono. Verificar que los archivos de Assets no cambian ni se añaden, y que reabrir recupera el mapa original. Repetir en Player exportado y medir FPS/uso de RAM durante los recálculos; comprobar fallo controlado por tamaño mayor al límite.

**Evidencia a devolver:** salida completa Node, build, consola Electron/Player, vídeo de caminos/obstáculos/cancelación y métricas FPS/RAM con región pequeña y región más pesada. Verificar también Subtract/Terrain/Camera en una escena integrada. **No cerrar CORR-003 con Node PASS o BUILD PASS exclusivamente.**

## 6. Inventario diferencial (sin incluir builds/node_modules/cachés)

Añadidos: documento QA 010 y suite nueva 010. Modificados: `Inspector.vue`, `core/nav/editorBake.js`, `runtime/nav/bake.js`, `runtime/nav/world.js`, `nodes/navigation.js`, `events/play.js`, `events/play-level.js`, harness históricos de Navigation 008 y Continuation 001, y `LevelForge_DB_Ledger.xlsx`. Sin eliminaciones.

**Estado de salida:** IMPLEMENTADO EN FUENTES · NODE AUTOMATIZADO PASS · BUILD/ELECTRON/PLAYER NO VERIFICADOS · CORR-003 ABIERTO.
