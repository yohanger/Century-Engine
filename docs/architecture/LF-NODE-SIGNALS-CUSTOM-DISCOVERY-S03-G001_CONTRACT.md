# LF-NODE-SIGNALS-CUSTOM-DISCOVERY-S03-G001 — Contrato técnico

**Fecha:** 2026-11-02. **Autorización literal:** `Listo. LF-NODE-SIGNALS-CUSTOM-DISCOVERY-S03-G001 autoriza comenzar`.

**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_ANIMATION_S02_G002_SOURCE_BASELINE.zip` (1587 archivos, ZIP verificado). Se preservan los contratos del catálogo S01, `ready`, árbol, Audio `finished`, Animation `animation_finished(clipName)`, Multiscript y el Amendment vinculante. La última aprobación de Animation S02-G002 fue declarada por el usuario, sin logs específicos Electron/Build disponibles; se registra sin inventar comprobaciones.

## Problema observado

`SignalConnectionsPanel.vue` obtenía Custom Signals únicamente de los nombres presentes en `project.signalConnections`. `NodeScriptRuntime` registra `node.define_signal(name)` durante la evaluación activa de cada Script de Nodo, pero el Editor no puede ejecutar scripts del usuario para leer su autoría. Por ello una Custom Signal sin conexiones permanecía invisible.

## Objetivo y alcance autorizado

**Mostrar declaraciones literales detectables de `node.define_signal()` aunque tengan cero conexiones**, indicando propietarios, conflictos y diferencias entre información estática y runtime. Sin ejecutar código, callbacks, Function/eval, ni inspeccionar cada fotograma. Sin modificar la persistencia o ejecutar Scripts de Nodo en Edit Mode.

**Producción permitida:** `src/engine/runtime/scene/node-scripts.js` y `src/components/SignalConnectionsPanel.vue`; `src/engine/runtime/nodes/registry.js` solo lectura (sin modificación). Se usa `nodeScriptIds()` como autoridad; `scriptIds[]` prevalece frente a `scriptId` antiguo. El catálogo `getNativeSignal()` identifica nombres reservados.

**Medios incluidos:** pruebas `scripts/test-node-signals-custom-discovery-s03-g001.mjs` y `scripts/test-node-signals-custom-discovery-electron-s03-g001.mjs`, fixture `scripts/fixtures/nodes/node-signals-custom-discovery-s03-g001.html`, documentación contractual/implementación/QA y `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas). No se agregan módulos ni dependencias de producción.

## Semántica de descubrimiento

- Lexer de solo lectura reconoce exclusivamente llamadas directas `node.define_signal('nombre')` o `node.define_signal("nombre")` con un único argumento literal sin secuencias de escape. Omite comentarios, strings, plantillas, literales regex en posiciones inequívocas y acceso mediante otros objetos. Es **análisis conservador, no ejecución JavaScript ni un parser completo**.
- Una declaración literal se muestra como **«Detectada en código · pendiente de validar en Play»**, nunca «Activa» solo por estar en el archivo. Puede estar dentro de una función o condición que nunca se ejecute.
- `node.define_signal(nombreCalculado)`, interpolaciones, literales con escapes, acceso dinámico o formas ambiguas no se reconocen como activas; se muestra diagnóstico «Argumento dinámico, no literal o no compatible» cuando la llamada directa puede identificarse. No se inventa metadata.
- La unión de señales detectadas y conexiones guardadas preserva nombres y autoría. Un enlace sin declaración detectada se muestra **«Conexión guardada · declaración no confirmada»**. No se eliminan conexiones.
- Colisiones con señales nativas, duplicación entre varios scripts y referencias de Script de Nodo ausentes o inválidas aparecen como **diagnósticos**. La existencia estática no resuelve la propiedad runtime `signalOwners/conflictedSignals` ni sustituye su validación.
- El Inspector reacciona a cambios en `project.scripts[].code`, `objects[].scriptIds`, selección, historial y `signalConnections` mediante `computed` Vue. No se introducen caches globales, escaneos de escena ni nuevo EventBus.
- Los métodos públicos receptores siguen sujetos a `node.expose()` y a la validación de conexión real durante Play. No se modifica el diálogo de conexión más allá del catálogo disponible y las etiquetas de origen.

## Exclusiones

No se implementa aún el rediseño visual completo estilo Godot ni señales no respaldadas por emisores; quedan pendientes el Sprint UX Signals, integración final Editor/Player, Terreno dentro de Inspector y limpieza final de Consola. No se actualizan dependencias ni se aplica refactor de otros subsistemas.

**Cierre:** requiere pruebas Node, Electron embebido (Vue + WebGL2/Jolt), builds Editor y Player, QA local usuario, aprobación y registro de evidencia. Compilación no equivale a QA visual.
