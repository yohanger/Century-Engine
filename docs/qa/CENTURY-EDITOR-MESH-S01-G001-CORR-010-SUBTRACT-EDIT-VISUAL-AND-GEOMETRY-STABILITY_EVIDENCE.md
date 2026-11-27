# Evidencia QA — Substract editable: geometrías compartidas

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-010-SUBTRACT-EDIT-VISUAL-AND-GEOMETRY-STABILITY`

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Reproductor sobre CORR-009 sin cambios | 1/8 PASS; 7/8 FAIL | `baseline-reproduction.log` |
| Reproductor sobre CORR-010 | **8/8 PASS** | `new-tests.log` |
| Runner dedicado (nueva prueba + compatibilidad Edit Mesh/CSG/TriMesh) | **62/62 PASS** | `directed.log` |
| Runner de CORR-009 | **69/69 PASS** | `previous-directed.log` |
| Regresión amplia | **425 PASS / 56 FAIL**, 481 total (incluye nuevas pruebas) | `regression.log` |
| Comparación de fallos nominales | **0 fallos nuevos** respecto de CORR-009: mismos 56 nombres | `regression.log` y referencia del SOURCE_BASELINE anterior |
| Smoke | **29 PASS / 1 FAIL** preexistente | `smoke.log` |
| Validación sintáctica JS | PASS | Comprobación con `node --check` |
| `npm run build` | **EXIT 127**: `vite: not found` | `build.log` |
| QA Electron/Player y escenas reales | **NO VERIFICADO** | Falta compilación y validación visual local |
| Artefactos verdes del screencast | **CAUSA NO VERIFICADA / RESOLUCIÓN NO VERIFICADA** | Vídeo del usuario; no existe prueba comparativa visual posterior |

## Cobertura dirigida

- Dos instancias Substract comparten geometrías de catálogo sin que editar una invalide la otra.
- Repetir la reconstrucción de Edit Mesh libera una sola vez el buffer propio y conserva los mapas de caras.
- Alternar Caja, Escalera y Cilindro no libera buffers cacheados.
- Restaurar forma predefinida libera la geometría personalizada sustituida.
- El ciclo de vida de eliminación y reconstrucción libera recursos visuales propios sin operaciones duplicadas.
- El recálculo BSP no elimina una geometría cacheada de Escalera; sí libera un buffer temporal personalizado.
- El comportamiento de mallas ordinarias continúa liberando su geometría propia.

## QA visual que debe completar el usuario

En Electron actualizado, abrir la escena real; entrar a Edit Mesh desde Substract; mover/extruir caras; cambiar Caja/Escalera/Cilindro; salir y volver a entrar; repetir sin reiniciar el editor; comprobar abertura CSG en Editor y Player y probar Undo/Redo y guardar/reabrir. Verificar si los artefactos verdes también aparecen fuera del screencast y tomar una captura fija si persisten. Registrar el resultado antes de aprobar o cerrar.

**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA VISUAL NO VERIFICADO · NO APROBADO · NO CERRADO.
