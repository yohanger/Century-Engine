# LF-NODE-MULTISCRIPT-S01-G001 — Contrato técnico de runtime multinstancia

**Motor:** LevelForge 0.26.13.  **Autorización:** `Listo. LF-NODE-MULTISCRIPT-S01-G001 autoriza comenzar`.  **Fecha:** 2026-11-02.

**Baseline parent:** `LevelForge_NODE_SIGNALS_MULTISCRIPT_CONTRACT_AMEND_G001_SOURCE_BASELINE.zip`, 1.536 archivos íntegros.

**Estado:** IMPLEMENTADO · 21/21 pruebas específicas y 205/205 regresión conjunta Node PASS · Electron/compilación NO VERIFICADOS · QA LOCAL PASS DECLARADO POR USUARIO · APROBADO · BUILD/ELECTRON NO VERIFICADOS EN ENTORNO IMPLEMENTADOR.

## 1. Alcance aprobado

Este Gate extiende únicamente `src/engine/runtime/scene/node-scripts.js` y `src/engine/runtime/scene/node-lifecycle.js`. La entrada `scriptIds: string[]` se **interpreta en runtime**, sin modificar todavía esquemas persistentes, Inspector, SceneTree, Assets, formatos ni Player. G002 incorpora autoría y migración de formato; G003 integra serialización, Prefabs y QA final.

## 2. Fuente de verdad y compatibilidad

`nodeScriptIds(obj)` usa `obj.scriptIds` si es una lista, incluso vacía; si no existe, lee `scriptId` como arreglo de un elemento. No escribe los dos campos. G001 no crea ni modifica ninguna entrada persistida. La lista define orden, admite solo recursos `execution: 'node'` y rechaza repetidos o IDs inválidos con diagnóstico, sin borrar datos. Reutilizar un recurso en nodos diferentes crea cierres independientes.

`NodeLifecycle` conserva el único árbol y registro de nodos y detecta diferencias en el orden/contenido de los IDs, además de los cambios de nodo, padre y tipo. Cambiar `scriptIds` durante Play provoca salida/reentrada de ese nodo conforme al mecanismo existente y recrea sus instancias; no se permite reorientar métodos o señales a objetos obsoletos.

## 3. Propiedad y orden de ejecución

`NodeScriptRuntime.instances` mantiene **un registro por nodo**. Dentro contiene `slots` privados en orden, cada uno con el recurso script, su handle, funciones de ciclo de vida, suscripciones `game.on/once` y cancelaciones `waitFor`. No se agrega otro intérprete, API global ni EventBus. El código fuente se evalúa una vez por script y por nodo en cada entrada al árbol.

Los callbacks no periódicos se despachan por nodo y en el orden configurado. `NodeLifecycle` conserva padre→hijos para `_enter_tree`, hijos→padre para `_ready`, y salida hijos→padre. Dentro del nodo, `_exit_tree` se ejecuta en orden inverso de los scripts para liberar dependencias, sin alterar el orden de salida de nodos. Los callbacks `_process` y `_physics_process` se registran solamente si existen, con tablas de slots preparadas durante el montaje; no se revisan scripts sin callbacks en cada fotograma.

Si un script no existe, es global o falla al evaluarse, se diagnostica el recurso y se libera únicamente su slot; los válidos restantes continúan. Si falla un callback, se reporta con ID de recurso sin detener a sus vecinos. Stop y cambio de escena liberan todas las instancias, suscriptores, esperas y conexiones runtime por la limpieza existente.

## 4. Métodos públicos, grupos y señales

La API `node.expose()` mantiene **un único espacio de métodos públicos por nodo**. Cada método tiene propietario de script. Un nombre duplicado entre scripts **invalida esa publicación para ambos**: se elimina el método visible, se marca como ambiguo y se reportan ambos IDs; no se elige al primero ni al último. `node.call()` y `game.call_group()` continúan resolviendo el método único por el mismo `NodeScriptRuntime` y preservan retornos y Promises.

`node.define_signal()` declara señales en el espacio de nombres del nodo. Dos scripts que declaran el mismo nombre lo invalidan con error y liberan los listeners correspondientes; `node.emit_signal()` y `node.connect/disconnect()` utilizan el despachador S04, las conexiones editoriales S06 y la fuente física Area3D S05 sin nuevos buses. No se alteran las señales físicas ni sus payloads. Las conexiones al salir de árbol mantienen garantías de identidad y limpieza.

## 5. QA y límites

- **Node:** `scripts/test-node-multiscript-s01-g001.mjs`, 21 casos: compatibilidad antigua, orden, estado, callbacks, señales, métodos ambiguos, datos inválidos, eliminación, Stop/Play, cancelación de `game.on/once/waitFor`, rendimiento sin callbacks. Regresión S01–S06.
- **Electron:** `scripts/test-node-multiscript-electron-s01-g001.mjs` con `scripts/fixtures/nodes/node-multiscript-s01-g001.html`, Three.js/WebGL2 real en Electron embebido; sin Chrome/Brave externos.
- **Compilación y Player:** solo los estados probados pueden marcarse PASS. En este entorno falta Vite, por lo que Electron/build permanecen NO VERIFICADOS. QA local del usuario pendiente.
- **Exclusiones:** no implementar slot múltiple del Inspector (G002), no escribir `scriptIds` en escenas aún, no rediseñar Signals ni Terrain, no modificar Jolt, exportaciones ni Prefabs (G003), no nuevos gestores ni refactors.

La aprobación del usuario del Amendment documental se registra como QA CONTRACTUAL PASS declarado por el usuario, sin convertir su estado histórico en prueba de este runtime nuevo.

## Aprobación del usuario (2026-11-02)

El usuario confirmó «Aprobado» tras la entrega de G001. QA LOCAL PASS declarado por usuario; G001 funcionalmente APROBADO. No confundir con Electron ni compilación automatizados en el entorno implementador.
