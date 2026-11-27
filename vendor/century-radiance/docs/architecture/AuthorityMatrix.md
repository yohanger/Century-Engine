# Authority matrix

| Responsabilidad | S00 | Autoridad objetivo | Consumidor futuro |
|---|---|---|---|
| Contexto WebGL 2 | Host de Playground | Host consumidor | Radiance backend |
| Recursos de diagnóstico GPU | Radiance | Radiance | QA / diagnóstico |
| Rasterización PBR | Three.js en Playground | Three.js | Radiance policy + host |
| Ciclo de vida y errores | Radiance | Radiance | Editor y Century Runtime |
| Worker y transferencias | Radiance | Radiance | Construcción futura |
| Escena, nodos, IDs, transforms | No implementado | Century Engine | Adaptador Radiance S09 |
| Física, scripts, eventos | No implementado | Century Engine | Century Runtime |
| Clima y estado atmosférico | No implementado | World | Radiance optical inputs |
| Directa y sombras | No implementado | Radiance S02 | Three.js backend |
| Bake | No implementado | Editor solicita, Radiance construye S03 | Recursos publicados |
| Lightmaps e indirecta | No implementado | Radiance S04–S05 | Runtime query |
| Sky Light y reflejos | No implementado | Radiance S06 | Composición óptica |
| Post/composición óptica | No implementado | Radiance S07 | Vista/cámara del host |

No existe durante S00 un segundo proveedor activo dentro de Century Engine porque no hay integración. El Playground demuestra compatibilidad de frontera, no transferencia de autoridad.
