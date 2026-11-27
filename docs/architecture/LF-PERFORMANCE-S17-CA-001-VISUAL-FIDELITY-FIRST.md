# S17 — Contract Amendment CA-001: Visual Fidelity First

**Estado: RATIFICADO por el usuario el 2026-11-12.** Texto de ratificación: `Ratifico LF-PERFORMANCE-S17-CA-001-VISUAL-FIDELITY-FIRST`.

**Autoridad:** modifica la prioridad del plan S17 posterior a G001, sin anular sus resultados de auditoría ni los contratos de sistemas existentes.

## Decisión vinculante

LevelForge investigará cómo mejorar la **fidelidad percibida por unidad de presupuesto de CPU/GPU/RAM**, antes de recurrir únicamente a recortes indiscriminados de calidad. Se prioriza la experimentación de renderizado adaptativo, con benchmarks comparables, fallback y respeto a la intención visual. Esto no autoriza promesas de 60 FPS universales ni sustituir el render de Three.js.

Se reorganiza G002 como I+D experimental de fidelidad adaptativa, desplazando a un Gate posterior las optimizaciones de CPU que exijan un perfil específico. Se preservan `PerfMonitor`, LOD, instancing, batching, Jolt, perfiles de render, exportación y el ledger existente. No integrar ejecutables ni fuentes de paquetes comerciales Unity sin licencia apropiada y compatibilidad técnica demostrada.

**Gate autorizado:** `Listo. LF-PERFORMANCE-S17-G002-INTEGRAL-ADAPTIVE-HIGH-FIDELITY-RD autoriza comenzar` (2026-11-12). El permiso cubre prototipo integrado reversible, escenarios de benchmark, QA, documentación y actualización del ledger. No autoriza activar globalmente técnicas experimentales.

## Criterio de éxito

Demostrar con imágenes de referencia, tiempo GPU cuando haya extensión disponible, p50/p95, memoria y ausencia de artefactos que una técnica conserva/mejora detalle perceptible con coste competitivo. Cualquier implementación sin esas evidencias permanece experimental; nunca se convierte en `APROBADO` por una prueba Node de contrato.
