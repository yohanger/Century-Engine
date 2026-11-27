# LevelForge · S13-G008-G001 · CORR-003 — Continuación 008: NavGrid y auditoría CSG

**Fecha:** 2026-11-11. **Gate vigente y ya autorizado:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`. **Contract Amendment ratificado:** `UPA-CA-002`. **Estado:** IMPLEMENTACIÓN PARCIAL · TEST AUTOMATIZADO NODE PASS · BUILD/ELECTRON/PLAYER NO VERIFICADOS · GATE ABIERTO.

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_007_TERRAIN_PIECE_POSITION_SOURCE_BASELINE.zip`, **3.105 archivos**. ZIP CRC PASS; comparación SHA-256 contra `LF_CORR003_CONT007_WORK`: 0 nuevos, 0 eliminados y 0 modificados antes de intervenir.

## 1. OBSERVADO — contrato de navegación

- `navigation` contiene seis parámetros de `NAV_DEFAULTS`: `cell`, `agentRadius`, `agentHeight`, `maxSlope`, `stepHeight` y `layers`, además del color visual. El Inspector ofrece sus controles y los botones de horneado. Un recurso se guarda en `obj.props.asset` y se decodifica en `navCache`.
- `nav/bake.js` calcula y erosiona celdas; `NavGrid` en `nav/grid.js` contiene las matrices `h`/`ok` y consulta **`this.step`** para aceptar o rechazar vecinos. `NavWorld` en `nav/world.js` lo utiliza desde `game.nav.path`, `canWalk`, `nearest` y otras rutas del Player.
- Un cambio de `stepHeight` puede ajustar **las conexiones entre celdas que ya sobrevivieron al horneado**. No puede restaurar celdas eliminadas por erosión ni regenerar alturas. Los otros cinco parámetros de bake requieren una operación de horneado con autoridad transaccional, caché y cancelación; cambiar solo `props` o `Grid.cell` no equivaldría a ello.

## 2. IMPLEMENTADO — canal real `navigation.stepHeight`

| Propietario original | Cambio |
|---|---|
| `src/engine/runtime/nodes/navigation.js` | Descriptor de `navigation.stepHeight` (`number`, 0–3). Solo disponible cuando el nodo apunta a un NavGrid cargado en `navCache`. Lectura autoral, aplicación temporal en `root.userData`, snapshot y restauración. No escribe en `obj.props` ni en Assets. La llave no se ofrece a un nodo sin mapa horneado. |
| `src/engine/runtime/nav/world.js` | `NavWorld.gridAt()` retorna la malla original cuando no hay override. Si existe una muestra, crea una **vista efímera mediante `Object.create(grid)`** y ajusta solo `step`: métodos A*/canWalk usan el mismo `h` y `ok`, sin copiar los arrays ni mutar `navCache`. La región seleccionada conserva identidad y su nodo propio. |
| `src/engine/runtime/events/play.js` | Al crear el `NavWorld` original, cada región recibe la referencia al nodo del SceneGraph que ya existe; no se añade otro servicio ni loop. Funciona en Editor PlayMode y Player con la misma ruta de `game.nav`. |
| `src/components/Inspector.vue` | `PropertyKey` junto a **Escalón máx.**, enlazada a `inspectorKeyable`, `inspectorKeyMarked` e `inspectorInsertKey`. Tooltip advierte que no se hornean nuevas celdas durante Timeline. |
| `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-continuation.mjs` | Se completó el fixture histórico de NAV_DEFAULTS (`stepHeight:0.55`), requerido tras registrar el canal; no se eliminaron aserciones. |

No se crea otro editor, navegador de recursos, sistema de rutas ni un archivo `utils/core` genérico. STOP/release elimina el override mediante el mismo descriptor; la siguiente llamada a NavWorld usa inmediatamente el grid horneado original.

## 3. EVIDENCIA EN ESTE ENTORNO

- Nueva suite `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont008-navigation.mjs`: **11 PASS / 0 FAIL**. Valida elegibilidad (asset cargado), tipos, keyframes, valores y rangos, `canWalk()` y `findPath()` A* con dos celdas a diferente altura, independencia entre regiones, restauración sin otro frame y no alteración de arrays ni caché.
- Regresión seleccionada (19 suites, incluyendo CORR-003 previous, física, CollisionShape3D, Audio, Water, Road, Critters, Terrain, Camera, métodos y UX): **264 PASS / 0 FAIL / 0 SKIP**.
- `node --check` sobre los JS modificados y la suite nueva: PASS.
- `npm run build`: **NO COMPILADO** en este entorno: `sh: 1: vite: not found` por falta de dependencias locales (`node_modules`). No es evidencia de fallo de código productivo.
- **Electron embebido, Jolt WASM, integración visual y Player exportado: NO VERIFICADOS** para esta continuación. La prueba A* es real de `NavGrid`, pero no se ha demostrado todavía que un agente del juego solicite una nueva ruta mientras se evalúa una Timeline.

## 4. Subtract / CSG–Jolt — bloqueo identificado, no maquillado

**OBSERVADO:** `src/engine/runtime/nodes/subtract.js` es un volumen cortador editorial. `src/engine/runtime/scene/brushes.js` calcula las geometrías de sus **receptores** leyendo `project.objects`, `worldMatrix()` y `carveGeometries()`, normalmente al sincronizar objetos con `_scheduleBrushes()`. `PlayMode._setupScene()` llama `ed.refreshBrushes()` antes de construir colisiones; los cuerpos Jolt posteriormente conservan su propia `Shape`/`BodyID`.

**INTEGRACIÓN INCOMPLETA:** el evaluador de Timeline puede modificar transformaciones comunes del `Object3D` de Subtract, **pero actualmente no programa un nuevo carve CSG y su reemplazo correspondiente de formas físicas**. Eso puede dejar el hueco visual o físico fuera de sincronía. El campo especializado **Volumen** (`obj.kind`: Caja/Cilindro/Escalera) continúa **SIN DESCRIPTOR**; agregar la llave ahora como actualización exclusivamente visual violaría la autoridad y el contrato.

**CAUSA DEL BLOQUEO TÉCNICO:** para animar correctamente Subtract se necesita una transacción por receptor que integre `refreshBrushes`, presupuestos de coste, mallas de paredes, `TriMesh`/`BodyInterface.SetShape` sobre cuerpos Jolt existentes, recálculo de colisiones de receptores y restauración sin sobrescribir la geometría autoral. Deben distinguirse receptores con cuerpo físico explícito de mallas decorativas. No se ejecuta esa sustitución en esta continuación; **no afirmar que Subtract esté animado**. Igualmente quedan pendientes otras propiedades de Navigation Bake que precisan recocinar la malla.

## 5. COBERTURA Y SIGUIENTE ACCIÓN

- Tipos de nodo registrados: 34.
- Con al menos un descriptor especializado en el baseline 007: 31/34; esta continuación añade un canal al tipo **Navigation ya parcialmente cubierto**, por lo que el conteo **permanece 31/34**.
- Tipos sin descriptor propio: `node`, `group` (estructurales con comunes) y `subtract` (control de volumen estructural pendiente). **0/34 tipos certificados universalmente al 100 %**. Esta cifra no mide porcentaje de propiedades.
- `Navigation` recibe **solo conexión de escalones entre celdas horneadas**: `cell`, `agentRadius`, `agentHeight`, `maxSlope`, `layers`, y la repercusión de `stepHeight` en la erosión siguen sin bake temporal válido. También hay campos generales y especializados restantes en otras familias.
- **G007, Camera Orchestration y paridad Player siguen vinculantes**. El usuario aprobó continuar CORR-003; no ha autorizado declarar PASS/CERRADO ni adelantarse a G009–G014.

## 6. QA LOCAL — ejecutar en la raíz con `package.json`

Comparar CHANGE con SOURCE_BASELINE 007 y respaldar cambios locales antes de extraer. Mantener los ZIP previos, escena y Assets.

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont008-navigation.mjs
npm run build
npm run electron
```

**Esperado de la suite nueva:** 11 PASS.

En Editor, hornear un mapa con dos plataformas/celdas de alturas distintas, asignar el nodo Navigation a la escena y animar `Escalón máx.` entre un valor inferior a la diferencia de altura y otro superior. Verificar `game.nav.canWalk` y `game.nav.path` durante Timeline y al detener (el agente debe **solicitar una ruta nueva**; una ruta calculada anteriormente no cambia retrospectivamente). Confirmar que el mapa binario y otra región que use el mismo recurso no se alteran. Verificar que la llave NO aparece si no hay mapa cargado y que el editor avisa del alcance limitado. Realizar la misma prueba en Player exportado.

Devolver salida Node, build, Electron y capturas o vídeo; distinguir explícitamente consultas de rutas, resultado visual y persistencia. **No cerrar CORR-003 sin QA y evidencia de las propiedades restantes.**
