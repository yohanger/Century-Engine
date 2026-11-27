# LF-NODE-CUSTOM-SIGNALS-S04-G001 — Contrato técnico

**Versión:** LevelForge 0.26.13  
**Autorización:** `Listo. LF-NODE-CUSTOM-SIGNALS-S04-G001 autoriza comenzar`  
**SOURCE_BASELINE parent:** `LevelForge_NODE_GROUP_CALL_S03_G001_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO · Node 19/19 nuevos PASS · suite focal 163/163 PASS · QA LOCAL PASS DECLARADO POR USUARIO · APROBADO.

## Objetivo y ownership

Las señales personalizadas pertenecen a la **instancia activa** de un Script de Nodo. La API no sustituye `game.on/once/emit/waitFor`, páginas de eventos ni `NodeLifecycle`. Usa `NodeScriptRuntime.instances`, métodos explícitamente publicados de S02, la identidad/vigencia de S01 y la limpieza previa de suscripciones. No hay EventBus adicional, persistencia de conexiones editoriales ni trabajo por fotograma.

## API y reglas

- `node.define_signal(name: string): void` declara una señal del Script de Nodo propietario. El nombre distingue mayúsculas; se rechaza cadena vacía, espacios periféricos y duplicados.
- `emisor.connect(signal, receptor: NodeHandle, method: string): boolean` conecta a un método publicado con `node.expose()` por el receptor. Devuelve `true` si crea la conexión y `false` si ya existe una idéntica. Rechaza señal inexistente, receptor inválido y método no publicado. La identidad incluye instancias originales de emisor/receptor y nombre de método, no solo IDs.
- `emisor.disconnect(signal, receptor, method): boolean` elimina una conexión y devuelve `true`. Devuelve `false` si ya no existe; no repite eliminación.
- `node.emit_signal(signal, ...args): void` emite una señal previamente declarada del propio Script de Nodo. No se expone en handles generales.

Los métodos `connect/disconnect` sí se exponen mediante `game.node()` y `get_node()`. Las operaciones que dependan de instancias se rechazan si el nodo ha entrado en salida del árbol o su Script de Nodo ha sido sustituido.

## Despacho, excepciones y asincronía

La entrega es síncrona, en orden de conexión, con instantánea de receptores. Una conexión creada durante la emisión no recibe el evento actual; una retirada antes de su turno no se ejecuta. Las emisiones anidadas obtienen su propia instantánea. Cada llamada utiliza `NodeScriptRuntime.callPublic()` con los argumentos originales (sin serialización).

Los fallos de receptores se reportan por `game.report` (o el fallback de `_report`) sin detener la entrega restante. Las Promises no bloquean el despacho y sus rechazos se observan y reportan. No se cancela una Promise ya ejecutándose.

## Vigencia y limpieza

Al ejecutar `_release()`, se retiran las conexiones **salientes y entrantes** de la instancia, además de las suscripciones globales y las esperas existentes. La liberación funciona ante destrucción, reemplazo del registro, cambio de script, reparentado con salida/reentrada, descarga de escena y Stop. Una instancia persistente conserva conexiones solo mientras ambos extremos permanecen activos.

Un nuevo nodo que reutilice el mismo ID no recupera conexiones anteriores. Las operaciones normales validan el registro original, `scriptId` y vigencia del handle; no mantienen índice adicional del SceneGraph ni recorren señales durante `_process`.

## Límites y exclusiones

No se implementan señales físicas de Area3D (S05), interfaz visual Signals (S06), cambios de Jolt, comandos narrativos, consola ni serialización de conexiones. `NodeHandle.object3D` extraído sigue sujeto al límite de S01. QA Electron/Player y compilación deben registrarse separadamente de las pruebas Node.
