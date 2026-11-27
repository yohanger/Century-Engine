# Evidencia técnica del Gate S07 integral

- **Fecha:** 2026-11-05.
- **Fuente:** `LF_FILMMAKER_S02_CA002_SOURCE_BASELINE.zip`.
- **Autorización exacta recibida:** `Listo. LF-CINEMATICS-FILMMAKER-TIMELINE-S07-G001-INTEGRAL autoriza comenzar`.
- **Node focal + regresión:** 116 pruebas, **114 PASS, 2 SKIP, 0 FAIL**; ejecutadas en el entorno del asistente mediante `node --test`.
- **SKIP:** dependencias de ejecución externa no disponibles (incluye empaquetado `.nfm` real con JSZip).
- **Pruebas nuevas S07:** 14 PASS, 0 FAIL; incluyen pistas reales derivadas, ausencia de mutaciones, idempotencia de importación, validación de película vacía y delegación en PlayMode.
- **Compilación Vue/Vite/Electron:** NO VERIFICADA (`node_modules` no disponible en entorno de entrega).
- **Player con assets reales, Jolt, audio, entorno y Camera Shake:** NO VERIFICADO.
- **Película real proporcionada por el usuario:** no adjuntada para análisis binario en este Gate.
- **QA visual del usuario:** PENDIENTE.
- **Cierre del Gate:** PENDIENTE; no confundir pruebas unitarias con QA de película real.

## 2026-11-05 — CORR-001 (QA rechazado parcialmente)

- El usuario rechazó la representación inicial: Timeline genérica/vacía, integración visual insuficiente y UX deficiente.
- El usuario validó el rechazo explícito de un `.nfm` sin tomas/montaje; la corrección conserva esa validación.
- Implementada descripción consultiva derivada del montaje real y guardada con la procedencia de FilmMaker. Reimportación recupera los metadatos sin duplicar pistas.
- Implementada nueva disposición visual de Cinematics, con espacio, lectura por carriles, cabezal y controles existentes.
- Las regresiones automatizadas y el resumen de ejecución se adjuntan en `docs/qa/evidence/LF-CINEMATICS-FILMMAKER-TIMELINE-S07-G001-INTEGRAL_CORR001/`.
- Compilación Vite/Electron y QA del usuario **NO VERIFICADOS**. **GATE ABIERTO.**
