# CF-CA-005 — CHUNKED SPATIAL AUTHORITY AND VOXEL MASS REPRESENTATION

**RATIFICADO por el usuario:** 2026-11-20.
**CONT-002 autorizado literalmente:** `Listo. CENTURY-FLUIDS-S09-G001-CONT-002-REGIONAL-PHYSICS-SCHEDULING autoriza comenzar`.
**Autoridad superior:** CF-CA-002/003/004 y contratos compatibles, S09 CONT-001 CORR-001 aprobado.

## Nueve decisiones ratificadas

1. `ParticleStore` es autoridad exclusiva del estado físico; voxels solo derivados de sus partículas.
2. Extender chunks existentes, evitando índices espaciales físicos paralelos.
3. Chunk puede estar activo, candidato a reposo o en reposo solo tras certificación física.
4. Conservar presión/viscosidad/movimiento entre chunks vecinos dentro del radio SPH.
5. Reactivar por movimiento, fuerzas, gravedad, emisión, drenaje, contactos y Jolt.
6. Velocidad baja por sí sola nunca acredita equilibrio físico.
7. Ante incertidumbre procesar física completa; errores no publican estados parciales.
8. Conservar API, único timestep, Jolt opcional, independencia de Century/Three.
9. A/B numérico, masa, presión, contacto, CPU y memoria contra baseline anterior.

**Representación A ratificada:** voxels de ocupación/masa derivados, NO un segundo solver de voxels. Los 11 Sprints S00–S10 y Gates principales no cambian. **S08 EN PAUSA.**
