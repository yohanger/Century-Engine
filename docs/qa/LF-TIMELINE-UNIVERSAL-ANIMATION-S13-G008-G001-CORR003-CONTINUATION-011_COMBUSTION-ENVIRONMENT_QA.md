# LevelForge · S13-G008-G001 CORR-003 — Continuación 011 · Humedad y temperatura de ignición

**Fecha:** 2026-11-11. **Estado:** IMPLEMENTADO EN FUENTES; 17/17 Node focal PASS; 420/420 Node regresión ampliada seleccionada PASS; **COMPILACIÓN / Electron / Player / QA VISUAL NO VERIFICADOS**; CORR-003 ABIERTO.

**Autoridad:** Gate `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE` ya autorizado y Amendment `UPA-CA-002` ratificado. No constituye un nuevo Gate, no habilita G009–G014 y no cambia el contrato de Cámara/Player. **SOURCE_BASELINE original de esta intervención:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_010_NAVIGATION_RUNTIME_BAKE_SOURCE_BASELINE.zip` (3.111 archivos, ZIP CRC PASS y comparación completa con árbol fuente: 0 diferencias antes de modificar).

## Auditoría — OBSERVADO / INFERENCIA / CAUSA RAÍZ

**OBSERVADO:** el Inspector muestra «Combustible», «Ignición inicial», «Humedad» y «Temperatura de ignición (K)» para `Node3D`, `RigidBody3D` y `StaticBody3D`. `play-tornado-destruction.js` ya construye una instancia `TornadoCombustion` con hasta 64 fuentes cuando están habilitados el tornado y `weather.tornadoFire`. Cada fuente posee un ID de objeto, `moisture` y `ignitionK`; `ignite`, `wet`, `step`, `snapshot` y `restore` pertenecen al mismo modelo térmico. Durante PlayMode la fuente puede desaparecer de una instancia térmica y reconstituirse desde snapshot al cargar partida.

**INFERENCIA:** un canal de Timeline que cambiase solo `obj.props.combustion` no afectaría al fuego real. La propiedad `ignited` representa **ignición inicial** (configuración de entrada, disparo térmico) y no un booleano reversible arbitrario; animarla como `true/false` no devolvería combustible, temperatura o brasas previas. Cambiar `enabled` exige altas/bajas de fuente, capacidad y sincronización de VFX; no es una simple propiedad numérica.

**CAUSA RAÍZ:** no existía un enlace temporal entre el registro de propiedades animables y las fuentes térmicas del propietario `TornadoCombustion`. Los valores autorales se consumían solo durante `_destructionInit`.

## IMPLEMENTADO — canales tipados y propietario real

| Nodo | IDs nuevos | Efecto |
|---|---|---|
| Node3D | `node3d.moisture`, `node3d.ignitionK` | Fuente térmica existente, sin malla/VFX adicional |
| StaticBody3D | `staticbody3d.moisture`, `staticbody3d.ignitionK` | Fuente térmica del mismo objeto físico, sin cuerpo nuevo |
| RigidBody3D | `rigidbody3d.moisture`, `rigidbody3d.ignitionK` | Misma fuente térmica que recibe fuerzas y físicas originales |

- Un único constructor de descriptores `combustionEnvironmentAnimation(ownerType)` en `nodes/base.js` es reutilizado por `node3d` y los dos tipos físicos mediante `nodes/physics.js`, sin registros globales duplicados. IDs exclusivos por tipo, rangos humedad 0–1 y temperatura 300–2000 K, `read`, `runtimeRead`, `capture`, `apply`, `restore`; llaves `PropertyKey` en las **mismas dos filas del Inspector**.
- `TornadoCombustion.configure(id, params)` valida **todos** los nuevos valores antes de actualizar, mantiene fuel/embers/serial y el mismo ID y fuente, y apaga una fuente que dejó de superar el umbral térmico. **No la reenciende automáticamente** al bajar el umbral; esa acción sigue perteneciendo a `ignite`, rayo u otro evento físico.
- La aplicación transitoria escribe a `root.userData.timelineCombustion` y, cuando existe la fuente, llama `TornadoCombustion.configure` sobre el **modelo real**. La lectura y restauración en vivo capturan el estado físico efectivo, no suponen que el valor del Inspector sea igual al estado resultante de `wet` y otros efectos naturales.
- `play-tornado-destruction.js` enlaza cada nodo de fuente existente a su PlayMode propietario mediante `node.userData.combustionRuntime={owner:this,id}`. No retiene un puntero a una fuente que podría volverse obsoleto cuando `_destructionRestore` sustituye el modelo térmico. `_destructionReset` limpia el enlace. Durante una inicialización posterior se respetan las claves temporales ya aplicadas. Si el enlace existe, pero el modelo desapareció, el aplicador **lanza error** en vez de dar un falso éxito.
- El proyecto, los recursos compartidos `.vfx` y los parámetros guardados de combustión nunca se reescriben por Timeline. La prioridad de la simulación real (fuego, agua, lluvia, relámpagos y brasas) permanece en los métodos preexistentes.

## QA ejecutado — EVIDENCIA

- Suite nueva `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont011-combustion.mjs`: **17 PASS / 0 FAIL / 0 SKIP**. Incluye tres tipos de nodo, catálogo y elegibilidad, persistencia y propiedad autoral, humedad/ignición en modelo real, snapshot/restauración aun con modelo sustituido, fuente independiente, rangos, transacciones sin cambios parciales, preservación de fuel/embers, vínculo y teardown de PlayMode y pérdida explícita de autoridad.
- Regresión acumulada ampliada **25 suites, 420 PASS / 0 FAIL / 0 SKIP**. Se incluyen las rutas anteriores de Timeline, CSG–Jolt, Navigation Bake, Terrain, Physics, agua y las suites de tornado meteorológico. Los cuatro harness heredados de física y Model/WaterWorld solo recibieron el argumento necesario de owner de combustión o ajuste de conteo; mantienen sus aserciones físicas existentes.
- `node --check` de los JS productivos y tests modificados: PASS.
- `npm run build`: **NO COMPILADO** en este entorno (`sh: 1: vite: not found`; el árbol fuente excluye `node_modules`). La salida no representa fallo de LevelForge ni PASS de build.
- **NO VERIFICADOS:** Jolt WASM, Electron embebido, simulación GPU real, Player exportado, QA visual y FPS en hardware local.

## Bloqueos de cobertura pendientes (no afirmar 100 %)

1. Los campos «Combustible» (`enabled`) e «Ignición inicial» (`ignited`) **no son canales animados** aquí. Requieren altas/bajas de fuente, control de capacidad, captura/restitución de temperatura, combustible, brasas y semántica de eventos; no se simulan con claves puramente visuales.
2. Los recipientes de Node3D/RigidBody3D siguen pendientes en `enabled`, `shape`, `size`, `liquidId` e `initialM3`. Cada transición debe conservar masa por sustancia, volumen dinámico, su superficie visual y el vínculo del mundo físico. Solo `pourRate` estaba integrado anteriormente.
3. Si la escena no activa Tornado → Combustión o no existe fuente térmica para el nodo, el Inspector conserva el canal autoral disponible para su previsualización en Timeline, pero **no se debe declarar que existe una llama física o VFX en PlayMode**. La ruta térmica real se verifica únicamente cuando el propietario está presente.
4. Mantener las reservas y consecuencias de Camera Orchestration, navegación horneada y cambios Subtract/Terrain, además de las propiedades comunes que aún no cuentan con aplicadores y QA final de 34 tipos. **CORR-003 sigue abierto.** El porcentaje de tipos con algún canal propio no mide propiedades completas.

## QA local del usuario — raíz con `package.json`

Partir del SOURCE_BASELINE 010 aprobado y comparar cambios locales antes de aplicar CHANGE; conservar todos los ZIP previos.

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont011-combustion.mjs
node --test scripts/test-weather-tornado-destructive-s12a-g001.mjs scripts/test-weather-unification-s03-g001.mjs
npm run build
npm run electron
```

**Esperado Node:** 17 PASS nuevos. Habilitar Tornado y Combustión en clima, usar una escena con `Node3D`, `StaticBody3D`, `RigidBody3D` marcados como Combustible y configurar un VFX3D válido si se desea ver las brasas. Introducir cambios de Humedad 0.1→0.9 y Temperatura de ignición 500→1200 K en Timeline, buscar tiempo, reproducir, pausar, detener y confirmar estado térmico/ignición con `game.log` y VFX; verificar además que no se alteró el combustible inicial ni el de otros nodos. Repetir tras snapshot de partida y con Player exportado. Con clima de combustión deshabilitado, comprobar que no aparezcan llamas ficticias.

**Evidencia a devolver:** salidas completas Node/Vite/Electron/Player; capturas o vídeo del Inspector y la simulación; logs de eventos de fuego y restauración; FPS/RAM observados durante la secuencia. El usuario ejecuta QA local y aprueba/cierra cuando corresponda.
