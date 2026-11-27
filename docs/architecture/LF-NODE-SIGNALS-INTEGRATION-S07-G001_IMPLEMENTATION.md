# LF-NODE-SIGNALS-INTEGRATION-S07-G001 — Auditoría e implementación

## Evidencia del SOURCE_BASELINE anterior

1. `src/core/project.js` declara `SCENE_KEYS = ['objects','environment','terrain','signalConnections']`; `splitProject` guarda conexiones dentro de la escena, no en metadatos.
2. `src/core/state/game.js` llama a `writePackage({data:meta, scenes:data, files})`, con `scenes[].data` procedente del contenido guardado de cada escena.
3. `src/engine/runtime/package/format.js` escribe `scenes/<id>.json` como `JSON.stringify(s.data)`; el lector devuelve esa escena completa.
4. **Defecto observado en `src/engine/runtime/package/host.js`:** `attach` y `switchScene` copiaban `objects`, `environment`, `terrain`, `activeSceneId`, pero **no** `signalConnections`. `NodeScriptRuntime.syncSceneConnections` lee exclusivamente `this.play.project.signalConnections || []`. En Player, las conexiones visuales faltaban, podían permanecer ausentes o proceder incorrectamente de metadatos.
5. `NodeLifecycle.sync` prepara receptores antes de conectar `tree_entered` y el resto antes de `ready`. Sus contratos previos y pruebas se mantienen intactos.
6. `src/core/exporter.js` prohíbe explícitamente exportar a Godot escenas con conexiones sin conversión; el paquete Player LevelForge usa su propio formato. No eliminar dicha prohibición.

**CAUSA RAÍZ CONFIRMADA:** falta de propagación de `signalConnections` desde escena deserializada al proyecto reactivo del host del Player. No requiere cambiar el schema ni NodeScriptRuntime.

## Corrección mínima

Única modificación productiva: `src/engine/runtime/package/host.js`.

- Inicializar `project.signalConnections` en `[]`, sin adoptar un valor global accidental de `pkg.game`.
- Al iniciar, cargar las conexiones de la escena elegida.
- En cada cambio, reemplazarlas por las conexiones de la escena entrante; el ciclo de vida que ya existe desmonta los listeners anteriores y crea los nuevos.
- Si un paquete histórico no incluye `signalConnections`, considerarlo lista vacía.
- Si un paquete sí incluye el campo pero no es una lista, rechazarlo con un error diagnóstico, sin falsear una lista válida.

No se alteraron archivos de producción de editor, SceneGraph, runtime de señales, historial, exportador o geometría.

## Pruebas

- `scripts/test-node-signals-integration-s07-g001.mjs`: 16 casos ejecutados con el host del paquete y `NodeLifecycle`/`NodeScriptRuntime` reales, incluso publicación de callback, autoría por escena, salida, reentrada y compatibilidad.
- `scripts/fixtures/nodes/node-signals-integration-s07-g001.html`: fixture de Electron que empaqueta el Player con `writePackage`, lo lee mediante `readPackage`, comprueba conexiones por escena, WebGL2 y carga Jolt WASM; usa runtime real de nodos y `nodesMethods`.
- `scripts/test-node-signals-integration-electron-s07-g001.mjs`: runner reutilizando `qa-electron-webgl-runner.mjs`, sin navegador externo.
- 24 suites relacionadas con Signals/Multiscript/Area3D: **463 PASS, 0 FAIL, 1 SKIP** (solo compilador Vue histórico ausente).
- Electron fixture y `npm run build`: intento realizado; bloqueados por Vite ausente, **NO VERIFICADOS**.
- `node scripts/gen-docs.mjs --check`: PASS.

## QA local y alcance incompleto

No declarar **SIGNALS CERRADO** antes del QA local con Editor y Player, incluidos cambio real de escena, audio terminado naturalmente, animación terminada naturalmente, Area3D con sensor Jolt y preservación de conexión/operación Undo. En especial, el test Node de host simula la representación 3D para aislar el contrato; la fixture Electron prueba el empaquetado real, pero no sustituye la revisión visual del usuario.

El resultado de este Gate corrige un defecto concreto y deja pendiente la verificación de la integración completa por el usuario. No implica resolución de los errores externos de Edit Mesh.
