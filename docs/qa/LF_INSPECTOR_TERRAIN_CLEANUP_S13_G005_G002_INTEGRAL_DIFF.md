# LF_INSPECTOR_TERRAIN_CLEANUP_S13_G005_G002_INTEGRAL · Comparación contra SOURCE_BASELINE

**Origen:** `LF_INSPECTOR_TERRAIN_FOLDING_S13_G005_G001_CORR002_SOURCE_BASELINE.zip` (2744 archivos; ZIP íntegro).

## Modificados (6)

- `src/components/TerrainPanel.vue`: solamente plantilla y CSS: documentación retirada, métricas y avisos conservados, tres listas extensas con scroll limitado, ajuste de espaciado.
- `src/core/editor/keys.js`: elimina el flujo S numérico de Object Mode (CA-TRANSFORM-S-OBJECTMODE-001), manteniendo S de Edit Mesh, Ctrl+S, R y rutas de Inspector.
- `scripts/test-transform-uniform-scale-s04-g001.mjs`: actualiza únicamente S04-14/21/22 supersedidos, preservando todos los tests matemáticos.
- `scripts/test-editor-top-hud-layout-corr-g001.mjs`: adapta únicamente HUD-09 supersedido, preservando HUD de Edit Mesh.
- `scripts/test-inspector-terrain-folding-s13-g005-g001.mjs`: reemplaza exclusivamente TERR-FOLD-13 sobre documentación retirada; mantiene 7 secciones y tests de plegado.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: agrega registros en seis hojas, sin alterar contenido ni fórmulas históricos.

## Añadidos

- Amendment CA-TRANSFORM-S-OBJECTMODE-001, documento de implementación, QA, comparación, inventario y evidencias.
- Node focal y fixture/runner Electron de Inspector de Terreno y scroll.

## Preservación y límites

- `TerrainPanel.vue` **script setup idéntico** al original.
- `InspectorDock.vue`, `ScenePanel.vue`, `src/core/mesh`, `src/core/state/objects.js`, `Player`, Jolt, Audio y recursos de proyecto: **sin cambios**.
- No se eliminó ningún archivo. Sin cambios en scripts externos, plugins ni tooltips globales.
- Regresión focal: **74 PASS**; compatible: **210 PASS, 1 SKIP, 0 FAIL**. Electron/build: **NO VERIFICADOS** por Vite ausente.
- La enmienda se ratificó por autorización literal del Gate, no se aplica a otros comandos ni workflows.
