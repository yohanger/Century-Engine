# LevelForge — LF-EDITOR-ADDMENU-CATEGORIES-CORR-G001

**Autorización:** `Listo. LF-EDITOR-ADDMENU-CATEGORIES-CORR-G001 autoriza comenzar`

**SOURCE_BASELINE:** `LevelForge_EDITOR_HIERARCHY_REORDER_G001_SOURCE_BASELINE.zip`

**Estado:** IMPLEMENTADO · TEST NODE PASS en las pruebas pertinentes · BUILD/ELECTRON/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Diagnóstico real

El menú de Shift+A convertía el conjunto de nodos de categoría `Geometría` en la etiqueta `Primitivas`, aunque `water`, `road`, `subtract`, `decal`, `text` y `sprite3d` compartían esa categoría. El menú de acciones Añadir tomaba categorías del mismo registro. `add.terrain` tenía una definición manual adicional que duplicaba la generada automáticamente desde `allDefs()`.

## Contrato ejecutado

- **Primitivas:** exclusivamente variantes del tipo `primitive`.
- **Ambiente:** agua (océano, lago/piscina, estanque y río), terreno, volúmenes atmosféricos y postprocesado.
- **Herramientas de modelado:** Carretera, Subtract y variantes no redundantes de malla (Vértice, Rejilla, Círculo, Toro, etc.).
- **Efectos:** Calcomanía y VFX 3D.
- **Visuales:** Texto 3D, Sprite 3D y lienzo de píxeles 3D.
- **Interfaz:** Sprite 2D y Canvas existentes.

La clasificación reside en las definiciones de nodo existentes. La proyección de Shift+A y las acciones de Añadir conservan las mismas identidades `type`/`kind`, los iconos y los callbacks de creación. Se eliminó la definición manual duplicada de `add.terrain`; la entrada generada por registro sigue usando la creación física de Terrain. No se alteró la definición de ningún nodo, su geometría, runtime, Inspector, base de datos, escenas ni Player.

## Evidencia disponible

- `scripts/test-editor-addmenu-categories-corr-g001.mjs`: **18/18 PASS**. Comprueba grupos, rutas, deduplicación, IDs de variantes, creación existente, Vértice y ausencia de segundo catálogo.
- Regresión focal `test-add-menu`, `test-editor-add-menu-corr-g001`, `test-csg-subtract-node-corr-g001`, `test-editor-hierarchy-reorder-g001` y nuevo test: **84/84 Node PASS** (antes del ajuste final de entrada duplicada; la regresión posterior del menú y barra superior **53/53 PASS**).
- Regresión ampliada de menús, nodos, audio, terrain y jerarquía: **328 PASS, 3 FAIL**. Dos FAIL son runners Jolt WASM sin dependencias instaladas. El tercero es `NE6-16`, una aserción heredada de CSS del Inspector (`@container insp`), con fuente/test idénticos al baseline; no fue modificado aquí. **No declarar esa regresión integral PASS.**
- Suite Electron de catálogo `scripts/test-editor-addmenu-categories-electron-corr-g001.mjs`, fixture con `AddModal.vue` y registro real: **NO VERIFICADA**, faltan Vite/Electron (`Falta Vite; ejecutar npm ci`).
- Build Editor/Player: **NO VERIFICADO**, falla el intento con `vite: not found`.
- QA de usuario: **PENDIENTE**.

## QA local (Linux, dentro del SOURCE_BASELINE de este Gate)

```bash
npm ci
node --test scripts/test-editor-addmenu-categories-corr-g001.mjs
node --test scripts/test-editor-add-menu-corr-g001.mjs scripts/test-add-menu.mjs
node --test scripts/test-editor-addmenu-categories-electron-corr-g001.mjs
npm run build
npm run electron
```

Resultados esperados: **18/18** nuevas Node; **30/30** entre `test-editor-add-menu-corr-g001` y `test-add-menu`; **1/1** Electron con 18 controles internos; build Editor y Player exitoso.

### Escenarios visuales y funcionales

1. Abrir Shift+A → **Primitivas**: únicamente formas geométricas, nunca Agua, Carretera, Subtract, Calcomanía, Texto 3D o Sprite 3D.
2. Verificar **Ambiente** (Océano, Lago/Piscina, Río y Terreno), **Herramientas de modelado** (Carretera, Subtract, Vértice), **Efectos** (Calcomanía/VFX) y **Visuales** (Texto/Sprite 3D).
3. Buscar «Océano», «Carretera», «Vértice», «Texto», «Cubo» y «Terreno». La búsqueda debe encontrar una entrada correcta por tipo/variante, sin duplicados.
4. Crear un ejemplar de cada tipo afectado. Comprobar Inspector, Undo/Redo, guardar/cargar, cambio de escena y el mismo resultado con el menú de acciones «Añadir».
5. Entrar a **Edit Mode** y confirmar que Shift+A continúa usando el catálogo de creación de geometría anterior, sin regresión.
6. En Play y Player exportado, comprobar que los nodos de agua, carreteras, terreno y efectos creados conservan comportamiento y datos; esta edición de metadatos no debe cambiar su ejecución.

**Evidencia para cierre:** salida Node, Electron y build, capturas del menú y resultados de creación/guardado y Player. La aprobación/CIERRE solo procede después de QA local suficiente y confirmación del usuario.

## Dependencias futuras registradas sin anticipación

- `LF-TRANSFORM-GLOBAL-LOCAL-CORR-G001`: verificación física y de API de coordenadas locales/mundiales y gizmos.
- `LF-MESH-VERTEX-WORKFLOW-CORR-G001`: consolidar la edición mediante vértices en Edit Mode existente, sin crear otro sistema de malla.
- `LF-TERRAIN-INSPECTOR-UNIFICATION-S03-G001`: trasladar el panel Terrain al Inspector del nodo; Gate separado.
