# LF-NODE-MULTISCRIPT-S01-G002 — Autoría y migración a varios scripts

**Baseline vinculante:** `LevelForge_NODE_MULTISCRIPT_S01_G001_SOURCE_BASELINE.zip` (1.542 archivos). **Autorización:** `Listo. LF-NODE-MULTISCRIPT-S01-G002 autoriza comenzar`. **Fecha:** 2026-11-02.

**Estado:** IMPLEMENTADO · pruebas Node específicas 20/20 PASS, regresión focal 276/276 PASS · QA LOCAL PENDIENTE · NO CERRADO. Compilación/Electron del entorno de implementación NO VERIFICADOS.

## 1. Autoría e Inspector

Se reutiliza `Inspector.vue`, su sección de scripts y el sistema de recursos Assets; no se crea un editor ni gestor independiente. El inspector lista los `scriptIds` en orden, muestra nombres y recursos ausentes/incompatibles, permite añadir por selector o drag & drop, abrir un script, quitar solo la asociación sin borrar el recurso y ordenar mediante arrastre y botones accesibles. Rechaza el mismo recurso repetido dentro del mismo nodo y los scripts `execution: 'global'`. Un recurso puede pertenecer a nodos distintos, cada uno con su instancia aislada en runtime G001.

`SceneTree.vue` mantiene el indicador: con una asociación abre el script; con varias muestra la cantidad y selecciona el Inspector. Soltar un Script de Nodo en la Jerarquía añade la asociación y no sustituye otras.

`state/objects.js` centraliza `authoredNodeScriptIds`, `setNodeScriptIds`, `addNodeScript`, `removeNodeScript`, `moveNodeScript`: cada operación válida realiza un solo `updateObject` y commit; duplicados, IDs inválidos y movimientos nulos no generan historial. El Undo/Redo existente conserva `objects`, incluyendo `scriptIds`. No se añade un almacén paralelo.

## 2. Modelo y migración

La **fuente persistente única** es `scriptIds: string[]`, conservando el orden. Los nuevos nodos creados con `makeObject()` la reciben vacía. `migrateScene()` convierte `scriptId` antiguo en `[]` o `[id]`, respeta `scriptIds` previamente válido y elimina `scriptId` en la escena ya migrada. No consulta la existencia del recurso durante la migración: referencias ausentes se preservan, se muestran en Inspector y son corregibles por el usuario. Listas corruptas, repetidas o con tipos inválidos se rechazan explícitamente; no se eliminan silenciosamente.

La función de compatibilidad de **lectura** `nodeScriptIds()` aportada en G001 permanece para pruebas de nodos antiguos aún no migrados. No significa dos campos editables ni dos fuentes persistentes.

## 3. Alcance de formatos y Player

`.lfproj` conserva los objetos de escena con su campo `scriptIds` JSON; la importación/guardado de escenas usa `migrateScene()`. La verificación completa de Prefabs, duplicación, portapapeles y Player empaquetado se reserva para G003, sin prometer aún ese QA.

`.levelpackage` export/import de escenas o Prefabs con `scriptIds` **no vacíos** se bloquea preventivamente con error explícito hasta que G003 verifique todas sus dependencias y remapeos. Los proyectos y recursos sin `scriptIds` conservan sus rutas previas. Esta protección estaba incluida como medio indispensable en la declaración autorizada de G002.

## 4. Exclusiones

No modificar `NodeScriptRuntime`, `NodeLifecycle`, eventos, Groups, Signals, Jolt, Terrain, Prefabs ni Player. No añadir ventanas nuevas, refactors genéricos, versión de proyecto paralela o service locator. La futura comparación de Signals con Godot se realizará antes del Sprint de Signals, no dentro de G002.

## 5. Verificación y riesgo conocido

- Pruebas nuevas `scripts/test-node-multiscript-s01-g002.mjs`, 20 casos.
- Regresión focal de nodos, Lifecycle, métodos, Groups, Signals, portapapeles y duplicación, 276/276 PASS.
- Fixture de Inspector Vue + Electron/WebGL2 y runner Electron incluido, pendiente por no disponer de Vite instalado en el entorno implementador.
- Histórica `NE6-16` de `scripts/test-node-editor-s06-g001.mjs` exige una regla CSS `@container insp (max-width: 340px)` ausente ya en el SOURCE_BASELINE G001. Es una discrepancia **preexistente y fuera de alcance**; no se modificará CSS ni se declarará resuelta por G002.

La aceptación requiere QA local del usuario antes de marcar G002 APROBADO; compilación/Electron automatizados NO VERIFICADOS no se convertirán en PASS por inferencia.
