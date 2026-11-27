# QA — LF-NODE-ARCH-AUDIT-S00-G001

**Fecha:** 2026-10-28. **Estado:** documentación completada; QA documental/aprobación del usuario pendientes. Sin modificaciones a producción.

## Fuente y control

- Entrada: `LevelForge_EDITOR_WINDOWS_LAYOUT_CORR_G001_SOURCE_BASELINE(1).zip` (905 ficheros; `ZipFile.testzip()` sin errores).
- Ámbito permitido: documentación `docs/architecture/`, este QA y `docs/qa/LevelForge_DB_Ledger.xlsx`.
- Inventario activo: 24 nodos, 23 módulos registradores; `sprite.js` registra sprite2d y sprite3d.
- ECMAScript Node registry, SceneGraph, physics Jolt, PlayMode, Player exportado inspeccionados por lectura real de código.

## Pruebas ejecutadas en baseline limpio

```bash
node --test \
  scripts/test-event-order.mjs \
  scripts/test-event-match.mjs \
  scripts/test-gameplay-physics.mjs \
  scripts/test-gameplay-object.mjs \
  scripts/test-runtime-persist-g001.mjs \
  scripts/test-scene-clipboard-g001.mjs \
  scripts/test-project-safe.mjs \
  scripts/test-game-manager-g001.mjs
```

**Resultado:** 173 PASS, 0 FAIL, 0 SKIP, 0 CANCELLED, ocho archivos de test. Todas las suites enumeradas son históricas: documentan comportamiento vigente, no prueban la implementación futura.

## Evidencia por criterio

| Código | Resultado | Evidencia |
|---|---|---|
| N-S00-01 | PASS | ZIP íntegro, 905 entradas |
| N-S00-02 | PASS DOCUMENTAL | NodeRegistry y NodeDefs registrados en `nodes/index.js`, `registry.js` |
| N-S00-03 | PASS DOCUMENTAL | Ownership actual `makeObject`, `mesh`, `Inspector`, `play.js`, `play-bodies.js` |
| N-S00-04 | PASS DOCUMENTAL | `events/play-controls.js::_simStep` y orden protegido |
| N-S00-05 | PASS DOCUMENTAL | `package/game.js::openGame` reutiliza `PlayMode` con `runtime=true` |
| N-S00-06 | PASS DOCUMENTAL | Tabla de contratos S01–S07 y prerrequisitos |
| N-S00-07 | PASS REGRESIÓN | Node --test: 173 PASS, 0 FAIL, 0 SKIP |
| N-S00-08 | NO VERIFICADO | Electron real, GPU, Jolt real, Player compilado/exportado, Linux/Windows |
| N-S00-09 | PENDIENTE | Aceptación del usuario de contrato y excepción propuesta para integración física futura |
| N-S00-10 | COMPROMISO DE ENTREGA | 0 cambios a producción; dos ZIP comparados contra baseline de entrada |

## Riesgos que S00 NO resuelve

1. `_bodiesTick()` ocurre después de `_events()` y `_inputTriggers()` fuera del bucle de pasos fijos; antes de cambiarlo, verificar Jolt/fixedUpdate/agua/Player con un test específico.
2. Los cuerpos de Event Pages y GameplayObject se relacionan con `_bodyAdd` y `game.physics`; el contrato no permite cambiar sus resultados silenciosamente.
3. Los nombres de clases nuevos son **objetivos**, no nodos ya registrados.
4. Renunciar a compatibilidad antigua no equivale a permitir errores en escenas nuevas, recursos, exportación o runtime.
5. `npm run build` y QA GUI no ejecutados en este Gate; no se deben inferir de Node tests.

## Checklist QA local del usuario — S00

- [ ] Leer tabla de 24 nodos e informar si falta algún caso de uso esencial.
- [ ] Aprobar o corregir el contrato de jerarquías, física y script opcional.
- [ ] Confirmar la excepción *futura y limitada* para integrar física desde módulos `events/`, sin cambiar Event Order Flow.
- [ ] Confirmar orden de sprints y habilitar S01 mediante Gate independiente.

S00 no cambia Editor/Player; no requiere probar visualmente un comportamiento que aún no existe. QA local funcional de la nueva arquitectura corresponde a S01–S07.
