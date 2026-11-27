# LF-NODE-SIGNALS-NATIVE-CATALOG-S01-G001 — Implementación y auditoría de cambios

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · regresión Node PASS · QA local pendiente.

## Antes — observaciones del SOURCE_BASELINE S00

- `registry.js` registraba tipo/base/creación/construcción sin metadata de señales.
- `node-scripts.js` definía `AREA_SIGNALS` como `Set` privado, también validaba esa lista al reservar Custom Signals y conectar/desconectar.
- `node-spatial.js` repetía los cuatro nombres dentro de `onArea()`; emitía por `_pollAreas()` y `_notify()`.
- `SignalConnectionsPanel.vue` duplicaba la lista en el componente Vue.
- `physics.js` registraba Area3D y otras definiciones Jolt sin metadata nativa por tipo.

**Causa raíz:** cuatro copias de nombres sin consulta compartida. No significa que el runtime físico fuera duplicado.

## Después — modificaciones de producción

| Archivo | Cambio mínimo |
|---|---|
| `src/engine/runtime/nodes/registry.js` | Define una vez la metadata Area3D y provee `getNativeSignals`/`getNativeSignal`; valida nombres/firmas al registrar y expone lista inmutable en el registro existente. |
| `src/engine/runtime/nodes/physics.js` | Asocia la metadata Area3D al registro real, sin inventar eventos de otros cuerpos. |
| `src/engine/runtime/scene/node-scripts.js` | Sustituye el `Set` privado por consulta a metadata para reserva, conexión, desconexión y adaptador `jolt-area`. |
| `src/engine/runtime/physics/node-spatial.js` | `onArea()` usa consulta compartida; no cambia `_notify`, tick, contacto ni payload. |
| `src/components/SignalConnectionsPanel.vue` | Lista nombres desde metadata del tipo seleccionado; conserva estructura, diálogo, filtros, conexiones y estados S06. |

## Harness histórico adaptado (solo QA)

`scripts/test-node-character-area-s04-g001.mjs` carga `node-spatial.js` mediante un `data:` URL para evitar dependencias de Three/Jolt reales. Al introducir la importación del registro, ese loader especial no podía resolver el import relativo y tampoco inicializaba las definiciones de nodos. Se corrigieron **solo** esas dos operaciones del harness: resolver la URL `file:` del registro y registrar su `area3d` de prueba. Las 28 pruebas históricas pasan sin cambiar lo que validan. En la aplicación, la definición real la registra `nodes/physics.js`.

## Compatibilidad y límites verificados

- Una definición `area3d` simplificada de pruebas recibe por defecto la misma metadata, sin introducir una tabla paralela. Las definiciones reales usan referencia explícita a la constante.
- `StaticBody3D`, `CharacterBody3D`, `RigidBody3D` y demás tipos no obtienen señales nativas ficticias.
- La metadata `source:'jolt-area'` se verifica antes de crear el listener nativo; una futura señal con otro origen necesitará Gate y adaptador reales.
- No se modificó `NodeLifecycle`, almacenamiento de `signalConnections`, carga de proyecto, Prefabs, Player, consola ni panel Terreno.
- Se conservan los eventos existentes: `Area3DEvent` `{areaId,type,id}`. La equivalencia de payload con Godot no se afirma.

## Siguiente área planificada (sin autorización)

S01-G002: señales del ciclo de vida y orden de conexiones iniciales con emisores reales. S01-G003: evaluar tipos con fuentes efectivamente disponibles. Después, descubrir Custom Signals sin ejecutar JS en Edit Mode y rediseñar Signals tipo Godot. Terreno y Consola al final según prioridad del usuario.
