# LF-TERRAIN-CAMERA-FRAME-S04-G001-INTEGRAL — Contrato

**Autorización literal:** `Listo. LF-TERRAIN-CAMERA-FRAME-S04-G001-INTEGRAL autoriza comenzar`.
**Base vinculante:** `LevelForge_TERRAIN_INSPECTOR_CONTEXT_S04A_G001_INTEGRAL_SOURCE_BASELINE.zip` (1.641 archivos; ZIP íntegro).

## Contrato y alcance

El botón **Aplicar tamaño** del `TerrainPanel.vue` original continúa haciendo un **remuestreo destructivo** de la pieza activa a dimensiones cuadradas y la resolución solicitada, previo `askConfirm`. Cancelar no debe modificar ni la pieza ni la cámara. Aceptar conserva `resize(S,N)`, `stitch`, `syncPieces`, `syncEnvironment`, `syncSettings`, `applyView` y un único `commitTerrain('Redimensionar terreno')`.

**Corrección S04:** quitar el reencuadre no solicitado `store.editor.frameAll()` de `applySize()`. La cámara del Editor conserva posición, orientación, objetivo de órbita y distancia; no se debe sustituir la llamada por `focus`, `frameBox` u otra operación equivalente.

**Conservación explícita:** `frameAll()` sigue disponible para el enfoque manual en `src/core/editor/selection.js`. La llamada `ed.frameAll()` de `addTerrainPiece()` se conserva y **no** está incluida en esta corrección. El ajuste por bordes X±/Z± del Sprint S03 sigue siendo una operación diferente. Undo/Redo, confirmación, terreno rectangular, dimensiones Y, datos de alturas/pintura, vegetación e hidrología mantienen sus respectivos contratos.

**Producción permitida:** `src/components/TerrainPanel.vue` únicamente. Se permiten actualizaciones de expectativas históricas S01–S03 que todavía exigían la llamada antigua, nuevos tests y fixture Electron, documentos/QA y ledger completo de seis hojas. Quedan fuera de alcance geometría, física Jolt, selección, Inspector, Player, exportación, Consola, Edit Mesh y refactors relacionados.

## Límites y evidencia

Las pruebas Node ejecutan el cuerpo real de `applySize` con colaboradores simulados y verifican ausencia de `frameAll` y reordenamientos; no demuestran la cámara visual real ni el remuestreo GPU. La fixture Electron utiliza Vue/Inspector reales, geometría Terrain, WebGL2 y Jolt WASM y comprueba cancelación, aceptación y conservación de cámara. La compilación de Editor/Player, Electron y QA local deben declararse por separado. El Gate no se cierra antes del QA local del usuario.
