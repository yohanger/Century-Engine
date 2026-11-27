# LF-WEATHER-TORNADO-NATURAL-S04-G001_CORR-002 — Coherencia atmosférica

**Autorización:** `Listo. LF-WEATHER-TORNADO-NATURAL-S04-G001_CORR-002 autoriza comenzar`.
**Base:** `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_CORR_001_SOURCE_BASELINE.zip`.
**Alcance:** coherencia de sol visible, niebla del cielo y horizonte bajo tormenta. No modifica física, clima simulado, Jolt, VFX ni nube madre.

## Diagnóstico observado en código

1. `World.frame()` ya suministra nubes, densidad, cobertura, tono y niebla interpolados. La modalidad **Manual** de `_effectiveEnv` conserva la paleta del Inspector, incluida la claridad del horizonte. La tormenta no oscurecía esa bóveda aunque sí existieran nubes meteorológicas.
2. `physicalSky()` sumaba un disco emisivo (`sunE * 19000.0`) sin modularlo por la cubierta, mientras el resto de la iluminación sí distinguía aporte directo y nublado.
3. La niebla sencilla era `FogExp2` aplicada a la geometría de Three.js. La esfera Sky utiliza un `ShaderMaterial` que no incorpora el chunk de niebla y no recibía esa extinción. El pase físico alternativo `AtmosphericFogPass` sí procesa el cielo cuando está activo. Aplicar ambos produciría doble niebla.

## Corrección

- `stormCoverFromFrame(frame)` deriva un peso 0–1 de **nubes activas, tipo, densidad y cobertura ya interpoladas** por World; no crea un estado meteorológico. Los climas sin condiciones cumulonimbo densas permanecen intactos.
- `setWorld` transmite ese peso a `uStormCover`. El `SKY_FRAG` atenúa el disco solar **visible** (no la luz direccional del juego) y las fuentes celestes, y aplica una cubierta atmosférica del mismo tinte de nube y luz ambiente a toda la bóveda, incluso cuando la iluminación celestial está en Manual.
- `_applyFog` entrega a Sky el color y densidad ya determinados por `World`/entorno. La opción `FogExp2` utiliza la misma fórmula de Three.js a distancia de cielo (`2400 m`) y no depende del ángulo de cámara. Cuando el compositor usa niebla física, el uniforme de Sky pasa a cero y **el pase existente conserva la autoridad** sobre la dispersión y la altura. No se modifican las ecuaciones de `AtmosphericFogPass`.

## Compatibilidad

Sin nuevos ajustes serializados, sin migración de proyecto, sin nuevos VFX, sin segundo cielo ni rutas adicionales de raymarch. El tornado sigue usando la raíz S01, la integración S02 y el polvo S03. La luz solar direccional y la gestión de intensidades del mundo permanecen intactas. El HDRI también recibe la cubierta cuando hay una tormenta fuerte; sin tormenta conserva su apariencia normal.

## Evidencia y limitaciones

- Pruebas Node nuevas: **12/12 PASS**.
- Regresión Node del área (sin Electron/WebGL): **269/269 PASS**.
- Electron/WebGL, build Editor/Player, comparaciones en el equipo y QA visual: **NO VERIFICADOS** en el entorno de implementación. La fixture GPU `tornado-natural-s04-corr002.html` incluye controles de sol, horizonte y niebla al mirar arriba/abajo.
- La desaparición perceptiva del artefacto y el rendimiento real dependen del QA local. No declarar CERRADO.
