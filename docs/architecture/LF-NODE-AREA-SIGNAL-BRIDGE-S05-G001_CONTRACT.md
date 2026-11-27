# LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001 — Contrato técnico

**Proyecto:** LevelForge 0.26.13  
**Gate:** `LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001`  
**Autorización:** `Listo. LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001 autoriza comenzar`  
**SOURCE_BASELINE parent:** `LevelForge_NODE_CUSTOM_SIGNALS_S04_G001_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO · NODE 18/18 nuevo PASS · suite focal 236/236 PASS · Electron/WebGL y compilación NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Propiedad y objetivo

`NodeSpatialRuntime` continúa siendo la fuente única de los eventos generados por los sensores Jolt. `NodeScriptRuntime` es el único propietario de las conexiones a métodos publicados de Scripts de Nodo; no se crea otro intérprete ni EventBus. Las conexiones físicas son una especialización de la conexión local S04. El emisor `Area3D` puede carecer de Script de Nodo; el receptor sí debe disponer de un método publicado (`node.expose`).

## API y semántica

`game.node('Zona').connect('body_entered', game.node('Receptor'), 'recibir')` registra una conexión cuando Zona tiene un sensor físico activo. La desconexión usa `disconnect(signal, receptor, metodo)`. Señales físicas admitidas exclusivamente en Area3D: `body_entered`, `body_exited`, `area_entered`, `area_exited`. `node.define_signal()` no puede redeclararlas sobre Area3D; `node.emit_signal()` no puede simularlas. Las señales personalizadas de S04 continúan disponibles con otros nombres.

El receptor obtiene un único `Area3DSignalEvent` que preserva `areaId`, `type` ('body' o 'area') e `id`. No se convierte automáticamente el identificador físico en NodeHandle: podría no corresponder a un nodo lógico válido (por ejemplo, `@player`).

Se devuelve `true` en conexión nueva, `false` para duplicados; desconexión devuelve `true` al quitar una conexión y `false` cuando ya no existe. No se admiten conexiones a sensores inexistentes ni a métodos no publicados. `monitoring`, `monitorable` y los filtros de Jolt siguen gobernando los contactos; no se crean contactos por el mero hecho de conectar un receptor.

## Despacho y limpieza

Cada par emisor/señal tiene **un único** callback registrado mediante `NodeSpatialRuntime.onArea`, con un Set de conexiones propiedad de `NodeScriptRuntime`. Los receptores se despachan síncronamente en el orden de conexión con instantánea; cambios posteriores no alteran la instantánea en curso. Las excepciones síncronas y rechazos Promise se reportan, sin bloquear los demás receptores. No se esperan Promises durante el bucle de física.

`NodeLifecycle` llama `NodeScriptRuntime.exit(obj)` incluso para nodos sin script. Allí se liberan las conexiones nativas salientes; `NodeScriptRuntime._release` libera también las entrantes cuando sale el receptor. La identidad lógica original, el `Object3D` propietario, la sesión Play y la instancia física se comprueban antes de cada entrega. Reutilizar un ID no reanima suscripciones. Durante Stop/cambio de escena se liberan los registros, y `NodeSpatialRuntime.dispose` mantiene la limpieza del sensor.

El bridge no añade bucles, barridos por frame, mundos físicos, sistemas globales de señales ni serialización editorial.

## Exclusiones

Fuera de alcance: cambiar JoltWorld.step, creación dinámica de colisionadores, sincronización de SceneGraph, eventos narrativos, Inspector, señales globales, consola y panel visual de Signals (S06).

## Restricciones de verificación

Las pruebas Node incluidas usan un sustituto focal de la fuente física para verificar entrega y limpieza; las pruebas existentes de Area3D verifican `NodeSpatialRuntime`. El nuevo runner Electron utiliza **Jolt WASM real + Three.js real** y requiere `npm ci` local. En este entorno Vite no está instalado y Electron/compilación no están verificados. El usuario debe confirmar QA Editor/Player antes del cierre.
