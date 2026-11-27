# LF-FILMMAKER-ANIM-S00-G001 · QA contractual y evidencia

**Fecha:** 2026-10-29. Estado: AUDITADO, DOCUMENTADO, APROBADO POR EL USUARIO; SIN IMPLEMENTACIÓN EN S00. Compilación, pruebas funcionales y QA de características futuras: **NO EJECUTADOS / NO APLICABLES A S00**.

## Evidencia del Gate S00

1. SOURCE_BASELINE verificado: `LevelForge_FILMMAKER_UX_S01_G002_CORR-001_SOURCE_BASELINE.zip`, 1.058 entradas; CRC ZIP PASS.
2. Archivos de motor modificados: **0**; archivos de producto/UI modificados: **0**.
3. Auditoría estática de rutas reales de Cinemáticas, Animaciones, NLE, formato `.nfm`, FPS/Jolt y guardado.
4. Diagnóstico de pistas fijas y `normalizeEdit()` confirmado en código; la propuesta de nuevas pistas NO se declara implementada.
5. Se mantuvo la versión actual `.nfm` v2 y el estado de todos los Gates previos.

## Checklist de aceptación documental (S00)

- [x] Se distingue montaje de edición de animación de nodos.
- [x] Reutilización exacta de `sampleTrack()`, `evalNode()`, `TimelineRunner` y patrón Auto-key existente.
- [x] Identidad por `nodeId`, no por nombre.
- [x] Política de edición con transformación local y segundos absolutos.
- [x] Política de referencia base, restauración y no contaminación de `overrides`.
- [x] Diferencia entre `seek(t)` puro y ejecución de eventos/comandos.
- [x] Separación de animación manual y física Jolt con bake.
- [x] Migración `.nfm` y contratos de Undo/Redo definidos.
- [x] Gates futuros delimitados sin autorizarlos.
- [x] Revisión/aceptación expresa del contrato por el usuario (2026-10-29).

## Pruebas obligatorias para Gates futuros (no realizadas)

| ID | Objetivo | Gate estimado |
|---|---|---|
| ANIM-01 | Crear pista al seleccionar nodo; ID persistente | S01-G002 |
| ANIM-02 | Registrar posición/rotación a T=0 y T=0.6 sin generar override | S01-G002 |
| ANIM-03 | Seek en orden T=1→0→0.6 equivale a evaluar T=0.6 directo | S01-G001 |
| ANIM-04 | Parar restaura pose base, jerarquía y selección | S01-G001 |
| ANIM-05 | Renombrar nodo conserva vínculo; eliminarlo marca pista huérfana | S01-G001 |
| ANIM-06 | Round-trip `.nfm` y compatibilidad v1/v2; versión futura se rechaza | S01-G001 |
| ANIM-07 | Undo/Redo de clips y pistas del film, sin afectar escena | S01-G002 |
| ANIM-08 | Animar dos nodos y reproducir con cortes de cámara | S01-G001 / G002 |
| ANIM-09 | No ejecutar eventos al arrastrar cabezal | S01-G001 |
| ANIM-10 | RigidBody3D no tiene doble control de Transform | S02-G001 |
| ANIM-11 | Bake Jolt: reproduce caída/rebote igual hacia delante/atrás | S02-G001 |
| ANIM-12 | Export/import de animaciones mantiene IDs y curvas | S02-G002 |
| ANIM-13 | QA 1440×900, 1280×720, 1024×768, 4GB RAM | S01-G002 |
| ANIM-14 | Regresión UX G002-CORR, Film Frame G001 y Player | Todos |

## Nota de límites

No se declaran PASS de pruebas de animación ni se garantizan capacidades inexistentes. Este Gate no requiere lanzar Electron, Player o Jolt, porque su única entrega es contractual. Antes de S01 se deberán crear fixtures de proyecto NFM v1/v2 y un caso de nodos repetidos/renombrados; el ejemplo de vaso es fixture de QA local, no preset publicado.
