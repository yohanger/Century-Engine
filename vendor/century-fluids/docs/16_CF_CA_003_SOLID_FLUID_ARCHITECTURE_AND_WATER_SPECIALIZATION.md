# CF-CA-003 — SOLID FLUID ARCHITECTURE AND WATER SPECIALIZATION

**Autoridad:** Amendment ratificado expresamente por el usuario el 19 de noviembre de 2026.  
**Gate de implementación:** `CENTURY-FLUIDS-S07-G001-INTEGRAL-FLUID-SURFACE-EXTRACTION`, autorizado literalmente por el usuario.  
**Prioridad:** sustituye únicamente las disposiciones incompatibles de S01–S06. Conserva historia, capacidades y evidencias. **Madurez PRE-1.0**; no requiere migraciones genéricas de datos experimentales.

## D01 — Núcleo genérico

`src/world.ts`, `src/config.ts`, `src/liquid.ts`, `src/particles.ts`, `src/spatial.ts`, `src/boundaries.ts` y `src/contacts.ts` pertenecen al núcleo de simulación. Ninguno puede importar un tipo particular de fluido, Jolt, Century ni un renderizador. La configuración física y del solver se especifica explícitamente; no hay parámetros de agua por omisión.

## D02 — Agua como especialización

`src/fluids/water/` contiene presets (`waterPhysicalConfig`, `waterSolverConfig`), fábrica (`createWaterWorld`), política de flotabilidad (`WaterHydrodynamics`) y extracción adaptada (`extractWaterSurface`, `waterSurfaceConfig`). **No** contiene otro solver, copia del estado de partículas ni autoridad física. Publicada en `@century/fluids/water`.

## D03 — Superficie genérica

`src/surface/` aloja `SurfaceConfig`, `extractSurface`, `SurfaceMesh` y contratos de extracción sobre `ParticleSnapshot`. El extractor no sabe qué sustancia se representa, no llama a `step`, no crea partículas y no tiene referencia a Three.js/Brave/WebGL/Century/Jolt. La especialización proporciona la política de campo/muestreo; la triangulación se comparte. Publicada en `@century/fluids/surface`.

## D04 — Jolt neutral

`src/adapters/jolt.ts` conserva la propiedad del puente **bidireccional**, `BodyInterface`, ID con generación y envío de impulsos lineales/angulares. La flotabilidad específica de agua ya **no está embebida**: recibe una política opcional `HydrodynamicPolicy`, mediante la interfaz neutral `src/coupling/hydrodynamics.ts`. Cuando se solicita flotabilidad o arrastre sin política, el registro falla antes de mutar el mundo; nunca devuelve flotabilidad falsa ni reintroduce una dependencia a `water`.

## D05 — API pública

La raíz `@century/fluids` sigue siendo genérica. Contrato sustituido: `new FluidWorld()` ya no genera por omisión un mundo de agua; requiere `FluidConfig` validado. `FluidWorld.step` requiere `LiquidSolverConfig` previamente configurado. Se eliminan `FluidConfig.referenceWater()` y `LiquidSolverConfig.referenceWater()`; sus valores se conservan en las fábricas de agua. Consumidores S01–S06, pruebas de empaquetado, Vite y Jolt se actualizan al nuevo contrato. No se habilitan alias o redirectors pre-1.0.

## D06 — SOLID y dependencias

La dirección permitida es especializaciones/adaptadores → contratos comunes → núcleo; la geometría también consume `ParticleSnapshot` pero no el backend. `fluids/water` NO importa `adapters/jolt` y el adaptador Jolt NO importa agua. No se introducen clases abstractas para gases/nubes ni un registro de plugins hipotético.

## D07 — Continuidad y evidencia

Preservar los tests y escenarios autorizados de S01–S06; las expectativas obsoletas de presets de agua en raíz se sustituyen por expectativas equivalentes en la especialización. El usuario acreditó S06 con 80/80 Node y 3/3 Jolt WASM real; esas cifras pertenecen a la versión S06 y **no** acreditan automáticamente el Jolt WASM después de estos cambios de API. Repetir `qa/verify_s07.py --jolt` en el entorno del usuario para verificar la nueva organización. Mantener las limitaciones conocidas de S04 (`iteration_limit`) sin falsear estabilidad.

## D08 — Roadmap

Se conservan exactamente S00–S10 (11 Sprints) y 11 Gates integrales. S07 incluye separación SOLID y extracción geométrica, **sin subsprints**. S08 — Century Editor/Runtime — continúa EN PAUSA. S09 conserva el playground interactivo de agua; S07 no agrega renderizador ni visualización interactiva.
