# LF-CLOUD-EVOLUTION-CA-001 — Propuesta reconciliada G003

**Estado: BORRADOR RECONCILIADO · NO RATIFICADO · SIN EFECTO SUSTITUTIVO.**
**Origen:** G002 draft conservado; revisión de autoridad G003. No es una copia ni reconstrucción de `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001`.

## Preámbulo de autoridad

La ratificación histórica de `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001` se reconoce, pero no se dispone de su texto íntegro. Por tanto, **ninguna cláusula concreta de ese instrumento se declara SUPERSEDIDA** mediante esta propuesta. La revisión solo conserva las cláusulas íntegramente verificadas y presenta las nuevas decisiones para ratificación posterior.

## Cláusulas propuestas para ratificación, sin vigencia hoy

**CA-01 — Autoridad World.** World será el único responsable del tiempo y forzado meteorológico, viento y fases de los fenómenos. CloudField distribuirá regiones; CloudVolume mantendrá el condensado; Sky renderizará el volumen. No habrá segundos sistemas meteorológicos, de tornado ni de nube independientes.

**CA-02 — Evolución temporal.** Edit Mode representará un clima estable que responde a cambios autorales pero no avanza condensado por tiempo. PlayMode y Runtime avanzarán la misma simulación. La pausa congelará la evolución atmosférica. `liveFx` mantendrá las otras previsualizaciones autorizadas; cualquier sustitución específica de la ruta `World.update(...,{clock:false})` tendrá que nombrar el contrato vigente que afecta y demostrar no regresión.

**CA-03 — Morfología.** El usuario configurará el clima y su variabilidad, no la forma individual de cada nube. Las categorías meteorológicas seguirán disponibles para consultas y diagnósticos compatibles, sin ordenar sustitución de la topología visible al cruzar un umbral.

**CA-04 — `cloudModel`.** `classic`/`cells`, el campo `game.weather.cloudModel` y sus consumidores continúan vigentes hasta que se apruebe la retirada o consolidación exacta. Se protegerán escenas/proyectos existentes. No se exigirá migración de versiones hipotéticas.

**CA-05 — Tormentas y efectos.** Preservar cláusulas 1-8 de Weather/Tornado CA-001, lifecycle, la sustitución exacta de VFX cl. 4 restringida al embudo, la semántica de Jolt, lluvia, relámpagos, agua, vegetación, fuego y FX genéricos.

**CA-06 — Datos/Render.** Preferir el volumen y textura temporal existentes como primer candidato; canales y recursos adicionales requieren A/B WebGL2 medido. World y el renderer deben compartir datos temporales coherentes. No se declara oclusión certificada ni rendimiento de 60 FPS sin datos reales.

**CA-07 — Persistencia y continuidad.** Restauración del condensado y transición meteorológica sin sustituciones visuales; proteger partidas y trabajo actual. Las técnicas para teletransporte/residencia son candidatas sujetas a QA, no obligación de guardar todo el mundo.

**CA-08 — QA de admisión.** Pruebas de formación, crecimiento, unión/disipación, clima, lluvia, iluminación, rayo/tornado, Edit/Play/Stop, teletransporte, guardado/carga, Runtime/Player y Compatibility/Mobile/Forward+ con evidencia real. G001 y G002 no representan QA del algoritmo nuevo.

## Tabla explícita de precedencia

- Weather/Tornado CA-001 cl. 1-8: preservar, incluida la supersesión limitada ya redactada en su cl. 4.
- Lifecycle CA-001: preservar.
- VFX Weather-Decoupling CA-001: preservar el régimen genérico, excepto la cl. 4 ya supersedida en el ámbito definido por Weather/Tornado CA-001.
- `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001`: **pendiente de texto auténtico**. No se asignan nuevas supersesiones exactas hasta obtenerlo o disponer de una ratificación nueva explícita que resuelva la ausencia.
- G002: diseño técnico propuesto, no autoridad aprobada por esta entrega.

## Condiciones previas a ratificación

1. Recuperar un ejemplar verificable del texto original P07 o aprobar un instrumento específico de recuperación de autoridad que fije expresamente cómo se resuelve la ausencia, sin fingir conocer su formulación.
2. Aprobar G002 como diseño, distinguir las decisiones condicionales GPU/residencia.
3. Ratificar expresamente estas cláusulas y sus supersesiones concretas después de cotejo, sin borrar histórico.

**Hasta entonces: NO RATIFICADO, NO IMPLEMENTAR.**
