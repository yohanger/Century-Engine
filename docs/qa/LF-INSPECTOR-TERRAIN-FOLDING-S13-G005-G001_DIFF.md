# Diferencias técnicas · S13-G005-G001

**Entrada:** `LF_INSPECTOR_NODE_SPACING_S13_G011_G001_SOURCE_BASELINE.zip`. Solo se ha aplicado el Gate autorizado de plegado Terrain.

## Producción

- **Modificado** `src/components/TerrainPanel.vue`: siete secciones `.sect.terrain-sect` con IDs semánticos, encabezados y `.body`; preservación del ojo de Vegetación; avisos de costa y resolución visibles; CSS local para encuadre.
- **Sin modificar** InspectorDock, Inspector, ScenePanel, Terrain runtime, física, Player, funciones del Editor, sistema de tooltips y otras interfaces.

## QA histórico

- **Modificado** `scripts/test-terrain-inspector-context-s04a-g001.mjs`: `TER-INSP-12` ya no exige `<h4>`, sino el nuevo `<header>` en el mismo TerrainPanel. Conserva el test de montaje único.

## Ledger y nuevos archivos

- **Modificado** `docs/qa/LevelForge_DB_Ledger.xlsx`: aprobación declarada de G011 (Electron/build no verificados) y estado real de G005-G001 en las seis hojas, solo filas añadidas.
- **Nuevos** test Node, fixture Electron (37 checks), runner Electron, documentos de arquitectura/QA, inventario y logs de evidencia. Ninguna eliminación.

## Reglas de aceptación y exclusiones

Los avisos se mantienen; limpiar textos y scroll de listas no está autorizado en este Gate. No se añade sistema de plegado alternativo ni cambios en los datos de proyecto. Los tests automatizados no sustituyen QA visual del usuario.
