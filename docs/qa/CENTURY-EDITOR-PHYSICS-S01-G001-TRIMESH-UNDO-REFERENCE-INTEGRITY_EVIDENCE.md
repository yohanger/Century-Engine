# Century Engine — QA de integridad TriMesh y Undo/Redo

**Gate:** `CENTURY-EDITOR-PHYSICS-S01-G001-TRIMESH-UNDO-REFERENCE-INTEGRITY`  
**Fecha:** 2026-11-21  
**SOURCE_BASELINE de entrada:** `CENTURY-EDITOR-STAIRS-S01-G001-STEP-COUNT-INSPECTOR-CORRECTION_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA LOCAL NO VERIFICADO · NO APROBADO · NO CERRADO.

## Pruebas verificadas

| Comando / escenario | Resultado | Registro |
|---|---|---|
| `node scripts/qa-suite.mjs trimesh-integrity` | **35/35 PASS**; incluye 11 pruebas nuevas y 24 de portapapeles | `directed-runner.log` |
| 10 suites existentes de física, TriMesh, jerarquía, escena y QA visual estática, más 11 pruebas nuevas | 189 PASS, 5 FAIL explícitos y 1 fallo a nivel de archivo, sin fallos adicionales respecto al baseline | `regression.log` |
| Las mismas 10 suites existentes sobre el SOURCE_BASELINE original | 176 PASS, los mismos 5 FAIL explícitos y 1 fallo a nivel de archivo | `baseline-regression.log` |
| `node scripts/qa-suite.mjs smoke` | 29/30 PASS, 1 FAIL preexistente | `smoke.log` |
| Smoke sobre SOURCE_BASELINE original | 29/30 PASS, mismo FAIL | `baseline-smoke.log` |
| `npm run build` | EXIT 127: `sh: 1: vite: not found` | `build.log` |

La diferencia de 13 pruebas entre la regresión actual y el baseline es resultado de 11 pruebas nuevas y 2 casos adicionales del portapapeles. Los fallos de las suites antiguas se compararon sobre la misma fuente de entrada y no se adjudican a este Gate.

## Cobertura dirigida

1. Impedir eliminar una malla que sigue referenciada, sin modificar historial, selección ni proyecto.
2. Permitir eliminar `StaticBody3D` completo y eliminar conjuntamente fuente y forma.
3. Rechazar atómicamente selecciones múltiples con una fuente referenciada desde una colisión superviviente.
4. Permitir borrar solo la forma sin eliminar su malla.
5. Duplicar el cuerpo con `sourceId` interno redirigido a la nueva malla, preservando el original.
6. Rechazar reparentar una fuente a otro cuerpo físico.
7. Restaurar IDs y `sourceId` mediante Undo/Redo de snapshots de escena; rechazar un snapshot inválido sin sustitución parcial.
8. Preservar referencias al serializar y recuperar la escena.
9. Copiar y pegar jerarquías de colisión remapeando su fuente; rechazar pegados con fuente ausente sin dejar copias parciales.

## QA Electron pendiente

- Abrir un proyecto de prueba aislado con un `StaticBody3D`, malla o primitiva fuente y `CollisionShape3D` de tipo TriMesh.
- Intentar borrar solo la fuente y confirmar que se bloquea y la escena no cambia; probar igualmente el botón de eliminar del Inspector.
- Seleccionar conjuntamente fuente y colisión, eliminar, deshacer y rehacer; verificar la jerarquía, las fuentes y la ausencia de errores repetidos.
- Duplicar y pegar el cuerpo; verificar que cada colisión apunta a su malla correspondiente y que la geometría física se comporta correctamente en Play.
- Probar eliminación de cuerpo completo, unión de mallas, selección múltiple, escenas guardadas y reabiertas, y física real Jolt.
- Repetir la secuencia exacta del proyecto del usuario si está disponible. Sin ella, la incidencia original no se considera reproducida.
- Ejecutar build y Electron cuando estén disponibles las dependencias locales; no se ha aplicado `npm install` ni alterado el entorno del usuario.

La carpeta `docs/qa/evidence/CENTURY-EDITOR-PHYSICS-S01-G001-TRIMESH-UNDO-REFERENCE-INTEGRITY/` conserva los logs. El código fuente, los tests y los runners no contienen comentarios de historial añadidos por este Gate. No se ejecutaron operaciones Git.
