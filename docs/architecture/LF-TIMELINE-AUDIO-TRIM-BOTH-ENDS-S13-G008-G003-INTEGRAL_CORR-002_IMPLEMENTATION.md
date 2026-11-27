# LF-TIMELINE-AUDIO-TRIM-BOTH-ENDS-S13-G008-G003-INTEGRAL_CORR-002 — Implementación

Fecha local de referencia: 2026-11-08. Estado: IMPLEMENTADO · NODE PASS · ELECTRON/BUILD NO VERIFICADOS EN ENTORNO DE PREPARACIÓN · QA USUARIO PENDIENTE.

## Observado

- G008-G003 CORR-001: el usuario obtuvo 31/31 Node PASS y dos ejecuciones 46/46 PASS de Electron principal.
- El test histórico S11-G003 falló en «El contorno conserva su escala al ampliar y desplazar».
- El test histórico S11-G007 falló en «El PCM y el clip conservan su origen», aunque las demás 35 comprobaciones indicaron PASS.
- G008-G002 introdujo origen temporal de 24 px; el test antiguo de automatización esperaba una posición absoluta de 70 px para t=1, zoom=70, cuando corresponde 94 px.
- `TimelineAudioSource.vue` virtualiza la ventana PCM y ajusta número de columnas tras zoom o scroll, por lo que el trazado SVG completo no tiene por qué permanecer idéntico.

## Mecanismo

1. Fixture S11-G003: obtiene el PCM real por `requestTimelineAudioAnalysis`, calcula pico global con `audioWaveformPeak` y el trazado esperado con `audioWaveformPath` utilizando ventana visible, columnas, ancho y offset reales. Conserva la verificación original de escala, pero sustituye la expectativa de igualdad literal de cadenas SVG entre zooms por la comprobación de cada ventana con los mismos algoritmos de producción. Añade comprobaciones explícitas de ventana inicial, zoom/scroll y una escala de pico incorrecta detectable.
2. Fixture S11-G007: localiza el tick etiquetado `0` en la regla; compara el clip relativo a este origen con `t*zoom` y verifica alineación visual del SVG PCM con el clip.
3. Nuevo test Node CORR-002: verifica contrato temporal, fixture, comprobaciones posteriores, sintaxis, y propiedades negativas de escala PCM con datos sintéticos.

## Alcance

Modificadas: dos fixtures Electron históricas y el ledger. Agregados: test Node de este Gate, documentación y evidencia. **No se modifica código de producción, Player, audio DSP, serialización ni recursos existentes**.

## Riesgos conservados

- Ninguna fixture histórica puede declararse PASS en Electron sin ejecución del usuario.
- La comparación del trazado esperado utiliza el mismo generador PCM existente: valida el cableado de duración, ventana, columnas, pico y offset, no reemplaza QA auditiva/visual.
- Las advertencias de build previas de chunks/importaciones mixtas quedan fuera de este Gate.
- El nombre de carpeta local del usuario mantiene sufijo G005-G001; la integridad de sus cambios locales no se deduce del nombre de carpeta.

## Salida

Exactamente CHANGE y SOURCE_BASELINE actualizado; pruebas/cobertura incorporadas; QA local pendiente antes de aprobar o cerrar.
