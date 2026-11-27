# LF-WATER-LIQUID-CA-003 — Recipientes y perfiles de líquido

**Estado contractual: APROBADO para S10** por la autorización literal `Listo. LF-LIQUID-CONTAINERS-S10-G001 autoriza comenzar` (2026-10-30).

**Padres vinculantes:** LF-WATER-LIQUID-CA-001, LF-WATER-LIQUID-CA-002 y WATER/LIQUID S01–S09. Este Amendment es prospectivo; no altera ni reinterpreta los cierres históricos.

## Decisiones vinculantes

1. La autoridad de inventario continúa siendo `WaterWorld`, extendido con recipientes finitos. No habrá `LiquidWorld` paralelo ni otro simulador global.
2. Se permite un recurso reutilizable `.liquid` en Assets con identidad única, densidad [kg/m³], viscosidad relativa, color y opacidad; los materiales visuales no reemplazan el inventario físico.
3. Los recipientes abiertos con interior **caja/cilindro** tienen capacidad en m³ e inventario finito. La autoría reside en `obj.props.liquidContainer`; el volumen que cambia en Play pertenece solo a `WaterWorld`.
4. La superficie libre aproxima la orientación del líquido según gravedad mediante cuadratura determinista. Su representación gráfica no es geometría de colisión ni un solver SPH/FLIP.
5. El vertido se calcula por borde y caudal limitado; la masa se deduce del origen y se añade a un destino compatible o se registra como salida exterior.
6. Una región física tiene una sola identidad de líquido; no se mezclan agua y café implícitamente. La región WATER heredada es agua. Otras identidades requieren perfil explícito.
7. Las transferencias de recipiente a región homogénea y recipiente a recipiente son conservativas. Los puertos hidráulicos S05/S09 entre regiones siguen definidos para agua; **no** se amplían automáticamente a otros líquidos.
8. No se alteran cuerpos heredados ni escenas antiguas: por defecto ningún nodo es recipiente, ningún .liquid aparece en proyectos antiguos y `WaterWorld.at()` conserva su contrato.
9. Las instantáneas con recipientes usan versión **6**, validan inventario y restablecen volúmenes/poses. Los snapshots v1–v5 siguen válidos para sus escenas anteriores; no pueden restituir inventarios S10 inexistentes.
10. El almacenamiento y los recursos se serializan en `.lfproj` y `.levelpackage` con IDs; la carga rechaza recursos ausentes o incompatibles. Recursos referenciados no se eliminan sin verificación de escenas, prefabs y Terrain.

## Invariantes y límites

- Cada especie cumple `M_inicial + M_entrante = M_actual + M_saliente` dentro de la tolerancia numérica declarada. Las cantidades se expresan en m³; masa = volumen × densidad.
- La densidad y viscosidad son propiedades **macroscópicas**: la viscosidad modifica la amortiguación del flujo y la velocidad de vertido, pero no constituye una simulación constitutiva exhaustiva.
- Los objetos/cámaras no crean masa al cambiar pose. El dibujo de superficie o de chorro no representa masa adicional.
- Sin región física compatible, el derrame se registra como salida del dominio, **no** como charco visual ficticio. Materiales arbitrarios, paredes, textiles, líquidos mezclados, recipientes cerrados y geometrías artísticas arbitrarias permanecen fuera de alcance.
- QA Node PASS no implica compilación Electron/Player ni validación visual o de rendimiento.
