# S17-G002 — Informe de implementación y evidencia

**Gate:** `LF-PERFORMANCE-S17-G002-INTEGRAL-ADAPTIVE-HIGH-FIDELITY-RD` autorizado el 2026-11-12. **CA-001:** RATIFICADO.

## Resultado

Se ha completado una **prueba de concepto opt-in** de reconstrucción espacial anti-ringing sobre el pipeline existente. No se alteran el runtime de gameplay, proyectos anteriores, formato de escenas, física, Timeline ni exportador. Presets existentes conservan ruta Catmull; TAA y resolución dinámica siguen desactivados. La nueva alternativa exige evaluación visual y en hardware real antes de aprobar su adopción.

## Evidencias reproducibles

| Prueba | Resultado | Evidencia |
|---|---|---|
| 10 pruebas nuevas, mock de shader/render y configuración | **10/10 PASS** | `01-experimental-contract-node.log` |
| Regresión extendida S16/Three/render/Perf | **400 PASS, 1 FAIL, 10 SKIP** | `02-selected-regression-node.log` |
| Repetición en baseline original de `scripts/test-three-s04.mjs` | **10 PASS, 1 FAIL, 1 SKIP** (misma prueba fallida sobre firma textual `syncFlare`) | `03-baseline-historical-failure.log` |
| `npm run build` | **NO VERIFICADO**: falta Vite (exit 127) | `04-build-unavailable.log` |
| Confirmación de tests nuevos/perf/selector/batching | **42 PASS, 1 SKIP** | `05-confirm-new-and-render-contract.log` |
| GLSL compilado en GPU, QA visual comparado, NGM Runtime | **NO VERIFICADO** | `LF-PERFORMANCE-S17-G002_QA-LOCAL.md` |
| Rendimiento UHD 605 / memoria de proceso | **NO MEDIDO** | pendiente evidencia del usuario |

**OBSERVADO:** no cambió el número de pases ni de render targets, pero la rama experimental hace 4 muestras adicionales de textura por píxel reconstruido. **INFERENCIA:** el recorte de overshoot puede atenuar halos alrededor de bordes. **CAUSA RAÍZ de FPS:** ninguna demostrada.

La prueba heredada fallida `S04: efecto y material de iluminación tienen responsabilidades separadas` ya falla exactamente igual en el baseline S17-G001; no es regresión añadida por el prototipo. Los 10 SKIP del conjunto extendido se deben a integraciones con dependencias ausentes (Node Modules/WebGL), no a validación de GPU. No confundir PASS de un mock con rendering compilado.

## Alcance e integración

- `render/config.js`: contrato y normalización, sin migraciones ni TAA.
- `core/templates/renderParams.js`: selector experimental en el formulario común existente.
- `render/upscale.js`: 4 muestras extra con límite de sobreoscilación en contraste alto, sin recursos nuevos.
- `render/look.js`: pasa la opción al mismo `TemporalUpscaler` espacial, usa el mismo `PerfMonitor`.
- `scripts/test-performance-s17-g002-spatial-reconstruction.mjs`: 10 contratos automatizados.
- `docs/...` y ledger: auditoría, QA, estado y evidencia.

## Decisión de Gate

**IMPLEMENTADO experimental / TEST AUTOMATIZADO focal PASS / COMPILACIÓN NO VERIFICADA / QA LOCAL PENDIENTE / NO APROBADO / NO CERRADO**. No se declara mejora de FPS, calidad superior ni compatibilidad móvil. Las cuatro lecturas adicionales deben justificar su costo en el Pentium N5030 antes de plantear un rollout. G003 podrá investigar otras técnicas después de la decisión empírica; no se activa automáticamente.
