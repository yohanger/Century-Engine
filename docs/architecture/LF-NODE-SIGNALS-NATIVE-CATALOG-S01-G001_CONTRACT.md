# LF-NODE-SIGNALS-NATIVE-CATALOG-S01-G001 — Contrato

**Fecha:** 2026-11-02. **Autorización:** `Listo. LF-NODE-SIGNALS-NATIVE-CATALOG-S01-G001 autoriza comenzar`. **Estado:** IMPLEMENTADO, QA LOCAL PENDIENTE, NO CERRADO.

**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_GODOT_COMPARATIVE_AUDIT_S00_G001_SOURCE_BASELINE.zip` (1.557 archivos). Parent: `LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001`; auditoría comparativa S00 como insumo documental. El usuario autorizó explícitamente G001 sin declarar por separado QA contractual de S00: conservar S00 como entregado/documentado, no inventar su aprobación.

## Objetivo y mecanismo

Unificar la metadata verificable de señales nativas del tipo `area3d` en el **registro de tipos existente** (`src/engine/runtime/nodes/registry.js`) y consumirla desde `nodes/physics.js`, `scene/node-scripts.js`, `physics/node-spatial.js` y `SignalConnectionsPanel.vue`. Los nombres de señales y la firma se definen una sola vez y se consumen desde `getNativeSignal`/`getNativeSignals`. `registerNode` normaliza/valida y expone `nativeSignals` en la definición existente; no existe otro registro ni EventBus.

## Contrato físico actual (no equivalencia Godot)

| Tipo | Señales nativas registradas | Fuente | Fase | Argumento |
|---|---|---|---|---|
| `area3d` | `body_entered`, `body_exited`, `area_entered`, `area_exited` | `NodeSpatialRuntime`/sensor Jolt | `physics` | `event: Area3DEvent` |
| Otros tipos | Ninguna en G001 | No hay emisor probado | — | — |

`Area3DEvent` incluye `areaId` del sensor emisor, `type` (`body` o `area`) y `id` de la otra entidad. Es un **objeto de evento**, no un `NodeHandle` de Godot. La emisión real procede de `_pollAreas()` → `_notify()` → listeners registrados con `onArea()`. Requiere monitoreo activo; `area_entered/area_exited` exigen otra Area3D `monitorable`. El registro no instancia Jolt ni llama a JS del usuario en Edit Mode.

## Invariantes

1. Solo las señales con emisor existente aparecen como nativas; `getNativeSignals` para otros tipos retorna lista vacía. No crear `ready`, `tree_*`, señales de `StaticBody3D`, Audio o VFX en este Gate.
2. La validación de `NodeScriptRuntime.connectSignal()`/`disconnectSignal()`, la reserva de `node.define_signal()` y la validación de `NodeSpatialRuntime.onArea()` consultan la misma metadata. El runtime físico sigue siendo el único productor y gestor de listeners.
3. Cada definición describe `name`, `source`, `phase`, `condition` y `args`. Los nombres/firma son inmutables; metadata defectuosa/duplicada se rechaza antes de registrar el tipo.
4. `NodeScriptRuntime` conserva `nativeSources`, `sceneConnections`, despachador S04–S06 y limpieza bilateral de conexiones. La metadata no crea listeners cuando se consulta; la conexión los crea bajo demanda y los libera al desconectar/Stop.
5. El Inspector continúa en el componente existente, sin rediseñar su UX ni ejecutar scripts para descubrir señales. La tabla `signalConnections` y persistencia no cambian.
6. Multiscript conserva listas `scriptIds`, resolución de métodos públicos, colisiones, limpieza y orden. Ningún ciclo adicional por fotograma.
7. `registerNode({type:'area3d', ...})` hereda la metadata física estándar si omite `nativeSignals`, preservando compatibilidad con fixtures/registradores antiguos. Una lista vacía **explícita** elimina la publicación nativa y requiere no usar ese tipo como emisor Jolt; no es el registro de producción.

## Alcance autorizado y exclusiones

Producción: exclusivamente los cinco archivos indicados en la declaración de G001. Medios: dos test Node/Electron, fixture HTML y mantenimiento del harness histórico `scripts/test-node-character-area-s04-g001.mjs` para importar la metadata al cargar un módulo mediante `data:`, documentación contractual/implementación/QA y ledger seis hojas. Ningún otro archivo de producción autorizado. Prohibido añadir nuevos emisores, alterar `NodeLifecycle`, cambiar el payload o añadir Deferred/One Shot/bind. Terreno y Consola permanecen para Gates posteriores.

## Criterios de aceptación

18 pruebas Node nuevas, regresión focal S04–S06/Multiscript, suite Electron con Jolt WASM/WebGL2 utilizando el runner ya existente, compilación Editor+Player, QA local del usuario, dos ZIP completos con comparación. **No declarar PASS de Electron/build si faltan dependencias en el entorno.**
