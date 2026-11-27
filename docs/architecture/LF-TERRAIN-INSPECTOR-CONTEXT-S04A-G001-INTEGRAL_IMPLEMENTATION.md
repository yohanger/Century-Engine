# LF-TERRAIN-INSPECTOR-CONTEXT-S04A-G001-INTEGRAL — Implementación

## Diagnóstico

**OBSERVADO:** `selectTerrain()` deseleccionaba el nodo normal con `selectObject(null)` y activaba `terrainSel`. El dock derecho mantenía `Terreno` como pestaña funcional distinta, y la herramienta y el comando desviaban navegación a esa pestaña. Los Scripts de Nodo y Signals consultaban `selectedId`, por lo que no compartían selección con Terrain.

**CAUSA RAÍZ:** selección basada en una ruta de estado distinta a `selectedId`, con panel especializado montado fuera del Inspector contextual.

## Corrección

- Selección de pieza a través del ID del nodo; conservación del sistema físico de piezas y su gizmo especializado.
- Integración única del `TerrainPanel` existente en `Inspector.vue`, con cabecera de identidad del nodo, `TagLayerRow` y Scripts de Nodo compartidos.
- Visibilidad y nombre sincronizados a través de los métodos específicos de Terrain para no alterar solo el nodo espejo.
- Eliminación de la pestaña del dock; normalización no destructiva de preferencias anteriores.
- Ajuste de la herramienta y del comando para seleccionar el terreno real y abrir Inspector; sin creación implícita.
- Reconstrucción de selección al detener Play y tras Undo/Redo; si el historial adjuntó gizmos o BoxHelpers de objeto sobre la pieza, se retiran y solo permanece el gizmo físico especializado.
- Actualización de la expectativa documental histórica S01 y de su fixture Electron, cuyo objetivo cambió por contrato autorizado S04A. El harness histórico de migración S01 ahora incluye validadores del proyecto añadidos en Signals, sin cambiar la lógica de migración de producción.

## Sin cambios

No se tocaron geometría, `Terrain`, pintura, agua física, vegetación, Jolt, Player, física ni cálculo de alturas. El panel original conserva sus operaciones; no se crearon gestores genéricos, árboles paralelos ni servicios globales.
