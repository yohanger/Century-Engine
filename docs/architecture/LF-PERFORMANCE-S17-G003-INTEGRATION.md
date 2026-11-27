# S17-G003 — contrato de integración, simplificación y visibilidad

## Propiedad de las responsabilidades
- **Terrain** conserva alturas, pintura, físicas, persistencia y fuente editable. `terrainBakePlan` calcula un *plan de selección de índices*. Los `ClusterMeshes` existentes son la autoridad de selección/partición de Terrain; el `LodManager` comparte la planificación solo para la ruta de compatibilidad existente.
- **Nodos** conservan la propiedad `visible` editorial. La visibilidad interna de batches nunca debe convertirse en `visible=true` de autoría durante desmontaje.
- **CloudField + CloudVolume + World** conservan identidad, volumen atmosférico, viento y transmisión solar. No crear un renderizador de nubes alternativo, ni nubes mesh trianguladas por defecto.
- **Viewport + PerfPanel** publican presupuestos y métricas calculadas en sus fuentes; separar los presupuestos CPU de tiempos GPU medidos. Los diagnósticos conservan su semántica existente.
- **PolyMesh** conserva las caras n-gon editables; `ops-edit` debe validar el contorno, y su triangulación para GPU es distinta del modelo de autoría.

## Limitaciones conocidas
- Conservación de bordes impone mínimos geométricos superiores a 50 triángulos para una pieza densamente subdividida; reducir la fuente original requiere otra decisión contractual.
- El horneado actual conserva la fuente y reconstituye índices en cada carga, lo cual evita mantener copias experimentales. No incluye streaming asíncrono del resultado ni precomputación de colisiones.
- Culling de nubes fuera de frustum y por oclusión de sólidos no está acreditado en WebGL2/Player. Se implementó solo omisión segura del campo totalmente vacío y exposición del coste estimado.
- Los presets de altura nuevos no alteran escenas existentes por detrás. Los cambios a la meteorología de proyectos anteriores requieren decisión explícita tras QA.

## Flujo de regeneración
`Hornear Mapa` → validar tolerancias → calcular índices/errores en cada pieza → registrar tolerancias y `version` → invalidar páginas de clústeres → consumir índices en Editor/Play. Undo/Redo y persistencia conservan configuración, no sustituyen los `heights` originales.
