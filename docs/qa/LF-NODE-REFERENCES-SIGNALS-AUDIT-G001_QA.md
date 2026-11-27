# LF-NODE-REFERENCES-SIGNALS-AUDIT-G001 — QA y trazabilidad

**Alcance del Gate:** AUDITORÍA DOCUMENTAL, sin modificaciones de `src/`, `scripts/`, runtime ni UI.

## Evidencia automatizada ejecutada en el baseline nominal de auditoría

Desde la raíz del SOURCE_BASELINE Lifecycle:

```bash
node --test scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs scripts/test-node-script-s05-g001.mjs scripts/test-node-script-s05-corr001.mjs scripts/test-groups-api-s03-g001.mjs
```

**Resultado observado:** 90 PASS / 0 FAIL / 0 SKIP, estado de salida 0. Incluye regresiones de ciclo de vida, señales globales de propietario, Groups, Script de Nodo y carga. No prueba nuevas firmas de Node Signals o llamada a métodos privados.

## QA documental

- SOURCE_BASELINE Lifecycle: 1.476 entradas, ZIP íntegro, 5 nuevas/3 modificadas/0 eliminadas respecto a Groups S03. El árbol de auditoría parte de copia idéntica.
- Fuentes inspeccionadas: `play-nodes.js`, `play-steps.js`, `play-host.js`, `events/interpreter.js`, `node-scripts.js`, `node-lifecycle.js`, `physics/node-spatial.js`, tipos `game-api.d.ts`, referencias y contratos S04–S05–S06.
- Distinción comprobada de API: `NodeHandle` general vs `NodeScriptHandle` dueño; señales de `Game` vs señales locales ausentes; métodos globales `game.define/call` vs función privada de Script de Nodo.
- Fuentes de Godot utilizadas como referencia conceptual, no como fuente de código ni como contrato del motor.
- No se ha ejecutado nueva prueba Electron, build ni Player durante este Gate. Resultados anteriores de un directorio Terrain Extents no validan equivalencia binaria con este SOURCE_BASELINE.

## Pruebas de futuros Gates (NO EJECUTADAS y NO APROBADAS)

- `get_node` absoluto/relativo, nombre duplicado, rutas inválidas, reparent, escena inactiva, destrucción y referencia guardada.
- Invocación de funciones personalizadas entre scripts de instancia, estado privado aislado, retorno y errores asíncronos.
- `call_group` con orden estable, uno/múltiples grupos, mutación de composición durante despacho.
- Señal de nodo a dos receptores, emisión tras desconexión, limpieza de emisor y receptor, reentrada, cambios de escena y nodos destruidos.
- Editor/Player, Prefabs, Jolt WASM para Area3D (en Gate separado) y regresión completa de señales narrativas.

**Evidencia que aún se necesita para cerrar futuros Gates:** test Node específicos, runner Electron embebido, capturas y QA local usuario, build Editor/Player y Play/Stop; no registrar PASS mientras falten.

**Estado de este Gate:** AUDITORÍA DOCUMENTAL EJECUTADA · QA DEL INFORME POR REVISAR/ACEPTAR POR USUARIO · NO IMPLEMENTACIÓN DE API · NO CERRADO.
