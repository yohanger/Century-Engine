# LevelForge — LF-MESH-VERTEX-WORKFLOW-CORR-G001

**Autorización literal recibida:** `Listo. LF-MESH-VERTEX-WORKFLOW-CORR-G001 autoriza comenzar`

**SOURCE_BASELINE vinculante:** `LevelForge_TRANSFORM_GLOBAL_LOCAL_CORR_G001_SOURCE_BASELINE.zip`.

**Estado:** IMPLEMENTADO · TEST NODE PASS · ELECTRON/COMPILACIÓN/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Auditoría y mecanismo

El motor ya dispone del tipo `mesh` variante `vertex`, creación automática de Edit Mode en `editor/placement.js`, `PolyMesh`, aristas sueltas `we`, `appendVertex`, `connectVertices`, `closeContour`, Fill y Extrude. Su `EditSession._placeVertexFromScreen()` elegía un plano de altura horizontal XZ y cambiaba por inferencia al plano de cámara únicamente para rayos casi horizontales. Esa condición impedía elegir de manera predecible un plano para construir paredes. El overlay `this.preview` ya existía y estaba sin uso en el trazado de vértices.

Se extiende **la misma sesión y panel existentes**:

- `MeshPanel.vue`: selector XZ (suelo), XY y YZ (paredes), sin otra ventana; texto de ayuda. La sesión sigue entrando en Edit Mode al añadir Vértice.
- `state.js`: `store.edit.vertexPlane`, preferencia **transitoria no persistida** con valor inicial `XZ`. No altera el esquema del proyecto ni el recurso de malla.
- `session.js`: `setVertexPlane()`, `_vertexPlacement()` único para preview y clic. El plano pasa por el vértice activo (o por el origen de la malla cuando no hay selección). En espacio global la normal utiliza X/Y/Z mundial; en local utiliza la matriz normal real de `visual.matrixWorld`. El Snap se aplica a **los dos ejes dentro del plano** sin alterar la profundidad fija. Shift suspende Snap en el cálculo mientras se mantiene (Shift+clic conserva el comportamiento de selección existente).
- `session.js`: el overlay `preview` reutiliza una geometría `LineSegments` con atributo BufferAttribute de tamaño fijo; muestra la arista provisional y una pequeña cruz donde caerá el vértice; al mover el cursor **no se modifican `PolyMesh` ni Undo**. El preview desaparece si se cancela, cambia de modo, entra a selección/navegación, cambia el plano o se confirma el clic.
- `session-input.js`: conecta la actualización de preview al pointermove y respeta selección con modificadores, navegación, Paint y Escape. Cada clic confirmado invoca el `O.appendVertex()` y el historial existentes; no se generan caras desde contornos abiertos.
- Se conserva `closeContour`, Fill y Extrude existentes, incluyendo serialización de aristas y UV. No se ha introducido un nuevo tipo de nodo, esquema, renderer, gestor de geometría ni sistema de Undo.

## Evidencia ejecutada

- `node --test scripts/test-mesh-vertex-workflow-corr-g001.mjs`: **18/18 PASS**. Evalúa métodos reales de `EditSession` con rayos y matrices controladas y `appendVertex`/`PolyMesh` reales: planos XZ/XY/YZ, padre rotado, Snap global/local, profundidad, intersección paralela, preview temporal, aristas, único commit y serialización.
- Regresión ampliada de 12 suites `test-mesh-*` y `test-transform-global-local-corr-g001.mjs`: **274 PASS, 0 FAIL, 0 SKIP**.
- Verificación sintáctica de módulos JavaScript, fragmento `<script setup>` Vue y fixture Electron: **PASS**.
- `scripts/test-mesh-vertex-workflow-electron-corr-g001.mjs` y fixture Vue/Three.js real: **NO VERIFICADO**. Falta instalación de Vite/Electron en este entorno (`Falta Vite; ejecutar npm ci antes del QA`). La fixture declara **16 verificaciones internas** de `MeshPanel`, planos, selección, proyección, preview, commit y GPU.
- `npm run build`: **NO VERIFICADO**. Resultado real `vite: not found`. No consta compilación exitosa del Editor ni Player para este Gate.

## QA local necesario (Linux)

Extrae el nuevo SOURCE_BASELINE en carpeta independiente. Desde su raíz:

```bash
npm ci
node --test scripts/test-mesh-vertex-workflow-corr-g001.mjs
node --test scripts/test-mesh-vertex-g001.mjs scripts/test-mesh-polyshape-g001.mjs
node --test scripts/test-mesh-vertex-workflow-electron-corr-g001.mjs
npm run build
npm run electron
```

Esperado: **18/18 Node nuevos PASS**, suites históricas PASS, **1/1 Electron con al menos 16 comprobaciones internas**, compilación Vite Editor/Player correcta.

### Prueba visual de integración: habitación

1. **Shift+A → Herramientas de modelado → Vértice:** entra al modo edición del mismo nodo `mesh`; activar «Colocar vértice».
2. Seleccionar **XZ** y dibujar suelo desde el vértice existente. Comprobar la arista amarilla de preview antes de cada clic. Cerrar contorno y utilizar Fill (F) para crear una cara plana.
3. Seleccionar **XY**, comenzar otra cadena desde un vértice del suelo, dibujar la pared vertical. Usar cierre de contorno y Fill; alternativamente aplicar la extrusión existente para crear volumen. Repetir en **YZ** para la pared perpendicular.
4. Rotar un padre 45° y alternar **Global/Local**. Confirmar que el plano se orienta correctamente y la posición de la arista coincide con la previsualización.
5. Activar Snap; comprobar puntos alineados con rejilla, incluyendo altura de origen no entera. Mantener Shift durante el movimiento para visualizar sin Snap, pero sin cambiar la semántica histórica de Shift+clic de selección. Repetir en cámara perspectiva y ortográfica.
6. Verificar que mover el cursor no ensucia el proyecto ni añade entradas Undo. Confirmar vértices y utilizar Undo/Redo para recuperar la topología.
7. Guardar, cerrar y reabrir escena. Comprobar vértices, aristas, caras, normales, materiales, Play y Player exportado. Verificar que una cadena abierta no genera superficies invisibles ni colisiones.
8. Salir de Edit Mode y volver: la herramienta de trazado queda desactivada de forma segura, sin segundas sesiones ni restos visuales.

**Evidencia a devolver:** salidas Node/Electron/build, captura del plano XY con línea de previsualización, una habitación con suelo/pared y resultado Play/Player. Solo el usuario puede confirmar QA visual. No declarar CERRADO sin aceptación y evidencia.

## Fuera del Gate

- Un segundo sistema de mallas, un nuevo tipo de archivo o nodo, otro renderer, generación automática de caras, modificaciones en materiales o colisiones.
- Unificación del Inspector de Terrain `LF-TERRAIN-INSPECTOR-UNIFICATION-S03-G001` sigue PENDIENTE.
- Correcciones de Jolt, exportación y problemas meteorológicos fuera de esta unidad técnica.

**Entrega LevelForge:** exactamente dos ZIP, CHANGE con archivos nuevos/modificados y SOURCE_BASELINE íntegro acumulado. Sin builds, dependencias, temporales, scripts `.sh` o SHA-256 separado. Ledger en sus seis hojas sincronizado con evidencia real.
