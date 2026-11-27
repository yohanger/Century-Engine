# LF-TERRAIN-CAMERA-FRAME-S04-G001-INTEGRAL — Auditoría e implementación

## Diagnóstico

**OBSERVADO:** `applySize()` en `TerrainPanel.vue` remuestreaba mediante `t().resize(S,N)` y sincronizaba el terreno; inmediatamente ejecutaba `store.editor.frameAll()`. `selection.js` implementa `frameAll()` mediante `vp.frameBox(...)`, cambiando encuadre. `state/terrain.js` contiene otra llamada diferente al **añadir una pieza**. Los tests S01, S02 y S03 preservaban expresamente la llamada antigua porque su retirada estaba reservada para S04.

**CAUSA RAÍZ:** reencuadre explícito después del remuestreo en el componente original, no en el solver de terreno, cámara genérica o cambios de escena.

## Intervención

Se retira exclusivamente la llamada a `store.editor.frameAll()` dentro de `applySize()`. Las ocho operaciones restantes de control y sincronización, incluidas confirmación destructiva y commit, conservan su orden. Se actualizan cuatro tests históricos para esperar que **no** exista esa llamada en el panel S04, sin modificar el mecanismo de geometría. El código de `addTerrainPiece()` y el método de enfoque manual no cambian.

Se añade una suite Node que ejecuta el `applySize()` real con colaboradores de prueba, y una fixture Electron que monta el Inspector real, modifica el tamaño desde la UI y confirma/cancela remuestreo sobre una pieza `Terrain`. Ninguna fixture o runner externo a Electron se introduce.

## Dependencias fuera de alcance

No se intervino Edit Mesh ni se limpiaron sus errores `snapModalValue`, `_cancelPaintStroke` o `setPointerCapture`. No se alteraron consola, Jolt, agua, Player ni exportación. Advertencias y defectos históricos conservan su estado; este Gate no constituye una reparación general del sistema de cámaras.
