# Contract Amendment LF-WATER-LIQUID-CA-001

**Estado:** APROBADO EN EL ALCANCE DEL GATE `LF-LIQUID-ARCH-S05-G001`, autorizado con `Listo. LF-LIQUID-ARCH-S05-G001 autoriza comenzar` el 2026-10-30.
**Vinculación:** WATER S01–S04 y AMEND-001 conservan su alcance histórico. Este Amendment amplía el contrato de los Sprints S05–S13; no reinterpreta sus resultados ni presenta un solver 3D como implementado.

## Decisiones vinculantes

1. `WaterWorld` continúa como autoridad existente de consulta y transferencias. No se crea `LiquidWorld` ni otro gestor.
2. Toda región finita identifica líquido, unidad y densidad. **En S05 solo se simula agua** (`id=water`, densidad de referencia `1000 kg/m³`); líquidos distintos se rechazan explícitamente hasta disponer de un modelo validado.
3. Las transferencias internas entre regiones finitas deben ser explícitas, con origen, destino, volumen y contabilidad; fuentes meteorológicas, drenajes externos y escape por bordes siguen siendo categorías separadas.
4. Las formas tradicionales `ocean`, `lake`, `pond`, `river` siguen siendo superficies heredadas / condiciones de contorno. No se convierten en volúmenes finitos ni reciben un flujo inventado.
5. `WaterRegion` puede seguir usando aguas someras. Los líquidos en recipientes, chorros y océanos necesitan representaciones distintas, sujetas al mismo contrato de conservación cuando exista masa finita.
6. Render, gotas GPU, shaders, sonido y material visual no pueden añadir masa por su cuenta. `TerrainWaterConnection` sigue siendo la única vía meteorológica de entrada física del modo actual y encola en `WaterWorld`.
7. Mantener API `at(x,z,t)`, compatibilidad con `.lfproj`, proyectos heredados, snapshots anteriores, Player y ciclos de reloj fijo. No introducir migración destructiva.
8. Riesgos futuros: hidrología por material S06; gotas/superficies S07; audio S08; transferencia física a cuerpos tradicionales S09; recipientes y café S10; rayos S11; tornados S12; QA integral S13. Todos **PENDIENTE PLANIFICADO**, no conexión olvidada.

## Resolución de contradicciones

La exclusión histórica de hidrodinámica 3D y recipientes en WATER S04 solo limita aquel Gate. El nuevo programa amplía el alcance **prospectivo**. Las divergencias técnicas no se corregirán cambiando los contratos para justificar el código. Cualquier cambio del formato de proyecto, de los cálculos de un océano heredado o de la semántica de un solver requerirá Amendment específico.

**Aprobación de producto:** la autorización exacta de S05 abarca la formalización de este texto y la implementación de su alcance S05; **no aprueba automáticamente S06–S13** ni cierra S05 sin QA local.
